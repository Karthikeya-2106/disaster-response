package com.disaster.service;

import com.disaster.ai.AiClient;
import com.disaster.ai.ImagePrep;
import com.disaster.dto.AiDtos.VisionAssessment;
import com.disaster.enums.Severity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.Set;

/**
 * Damage assessment that actually looks at the uploaded photograph.
 *
 * <p>The previous implementation accepted the image bytes and then asked the model to score
 * the reported severity enum as text — the picture was never sent, so the "AI score" was a
 * lookup table with extra steps. This sends the real pixels to a vision model and returns a
 * structured assessment a responder can act on.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiVisionService {

    private final AiClient ai;

    private static final Set<String> SUPPORTED = Set.of("image/jpeg", "image/png", "image/webp");

    private static final String SYSTEM_PROMPT = """
            You are a disaster damage assessor supporting an emergency dispatch desk.
            You are shown a photograph taken at an incident scene together with what the
            reporter claims is happening.

            Judge the scene from the image itself. The reporter's severity is a claim, not
            a fact — civilians under stress over- and under-report constantly. If the photo
            shows something materially less or more severe than reported, say so in your
            score rather than deferring to the claim.

            For the score, weigh in order: immediate threat to human life, people visibly
            trapped or exposed, dangers that will get worse, and blocked access for responders.
            Visible evidence of an emergency whose source is out of frame still counts toward
            urgency — do not score zero just because the cause itself isn't in the picture.

            Hazards: list every dangerous thing you can actually see, including evidence of
            an emergency whose source is out of frame. Do not list anything you cannot see —
            responders will prepare for every hazard you name, and one that isn't there sends
            them the wrong equipment. Leave the list empty only when nothing dangerous is visible.

            Set imageMatchesReport to false when the photograph does not depict the reported
            disaster type at all — that flags a mis-tagged or junk report for human review.
            """;

    /**
     * @param imageBytes  raw upload bytes
     * @param contentType MIME type from the multipart upload
     * @param reported    severity the citizen selected
     * @param context     free text describing the report, may be blank
     */
    /** Whether {@link #assess} would actually call a model for this upload. */
    public boolean canAssess(String contentType) {
        return ai.enabled() && SUPPORTED.contains(normaliseMime(contentType));
    }

    private static String normaliseMime(String contentType) {
        String mime = contentType == null ? "" : contentType.toLowerCase();
        return mime.equals("image/jpg") ? "image/jpeg" : mime;
    }

    public Optional<VisionAssessment> assess(byte[] imageBytes, String contentType,
                                             Severity reported, String context) {
        if (!ai.enabled() || imageBytes == null || imageBytes.length == 0) return Optional.empty();
        String mime = normaliseMime(contentType);
        if (!SUPPORTED.contains(mime)) return Optional.empty();

        String prompt = """
                Reported severity: %s
                Reporter's description: %s

                Assess the scene in the photograph.
                """.formatted(reported.name(), context == null || context.isBlank() ? "(none given)" : context);

        return ai.structured(SYSTEM_PROMPT, prompt, ImagePrep.forModel(imageBytes, mime), VisionAssessment.class)
                .map(this::normalise);
    }

    /** Deterministic score used when AI is off or the call fails. */
    public double heuristicScore(byte[] imageBytes, Severity reported) {
        double baseline = baselineFor(reported);
        if (imageBytes == null || imageBytes.length == 0) return baseline;
        long sum = 0;
        int n = Math.min(imageBytes.length, 4096);
        for (int i = 0; i < n; i++) sum += (imageBytes[i] & 0xFF);
        double normalized = (sum % 1000) / 1000.0;
        return clamp01((normalized * 0.4) + (baseline * 0.6));
    }

    public double baselineFor(Severity s) {
        return switch (s) {
            case CRITICAL -> 0.9;
            case HIGH -> 0.7;
            case MEDIUM -> 0.5;
            case LOW -> 0.25;
        };
    }

    /**
     * A schema constrains shape, not values, so tidy what the model returns:
     * <ul>
     *   <li>Score pinned into 0..1.</li>
     *   <li>Label <b>derived from the score</b>, never taken from the model. Asked for both, a
     *       small model contradicts itself — tested: qwen2.5vl:3b returned score 0.7 with label
     *       MEDIUM. One source of truth; thresholds put each reported-severity baseline
     *       (0.9 / 0.7 / 0.5 / 0.25) in its own band.</li>
     *   <li>Filler entries like "none visible" dropped from lists — the model pads lists with
     *       them even alongside real hazards.</li>
     * </ul>
     */
    private VisionAssessment normalise(VisionAssessment a) {
        double score = clamp01(a.severityScore());
        return new VisionAssessment(
                a.summary(),
                withoutFiller(a.hazards()),
                a.peopleAtRisk(),   // "none visible" is a real answer here — keep it
                a.accessNotes() == null || FILLER.matcher(a.accessNotes().trim()).matches() ? null : a.accessNotes(),
                a.imageMatchesReport(),
                withoutFiller(a.recommendedResources()),
                score,
                labelFor(score));
    }

    static String labelFor(double score) {
        if (score >= 0.85) return "CRITICAL";
        if (score >= 0.6) return "HIGH";
        if (score >= 0.4) return "MEDIUM";
        return "LOW";
    }

    private static final java.util.regex.Pattern FILLER =
            java.util.regex.Pattern.compile("^(none( visible)?|n/?a|not (visible|applicable)|nothing|unknown|-)\\.?$",
                    java.util.regex.Pattern.CASE_INSENSITIVE);

    static java.util.List<String> withoutFiller(java.util.List<String> items) {
        if (items == null) return java.util.List.of();
        return items.stream()
                .filter(s -> s != null && !s.isBlank() && !FILLER.matcher(s.trim()).matches())
                .map(String::trim)
                .toList();
    }

    private static double clamp01(double v) {
        return Math.max(0.0, Math.min(1.0, v));
    }
}
