package com.disaster.dto;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import java.util.List;

/**
 * Schemas for the AI layer. {@code AiClient} derives a JSON schema from each record and
 * passes it to the provider, which constrains generation to that shape — so replies parse
 * reliably instead of relying on "return only JSON" in the prompt.
 *
 * <p><b>Component order is deliberate.</b> Models generate fields in schema order, so every
 * record puts observations and reasoning before the verdict fields that depend on them. With
 * the verdict first, a model commits to an answer and then rationalises it — in testing, a
 * small local model returned {@code isDuplicate=false} alongside reasoning that said "same
 * event". {@code JsonSchemas} pins this order explicitly for providers that would otherwise
 * sort properties.
 */
public final class AiDtos {

    private AiDtos() {}

    /** Text-only assessment of a report, for the "analyze" button on the report form. */
    public record IncidentAnalysis(
            @JsonPropertyDescription("Two-sentence situation assessment")
            String assessment,

            @JsonPropertyDescription("Exactly three short, concrete actions for the reporter or responders")
            List<String> recommendations,

            @JsonPropertyDescription("Short estimate of how many people are affected, based only on the report; say 'unknown' if it gives no basis")
            String estimatedAffected,

            @JsonPropertyDescription("Urgency from 0.0 (minor) to 1.0 (life-threatening)")
            double score
    ) {}

    /** What the vision model reports after actually looking at the uploaded photo. */
    public record VisionAssessment(
            @JsonPropertyDescription("Two-sentence description of what the image actually shows")
            String summary,

            // No examples here on purpose. This description used to give 'submerged vehicles' and
            // 'live power line down' as examples, and qwen2.5vl:3b returned both verbatim for a
            // flood photo that has no power line in it. Small models echo prompt examples as findings.
            @JsonPropertyDescription("Every dangerous thing actually visible in the photo, including evidence of an emergency whose source is out of frame. Never list something that is not visible")
            List<String> hazards,

            @JsonPropertyDescription("People visible and their apparent risk, or 'none visible'")
            String peopleAtRisk,

            @JsonPropertyDescription("How responders can reach the scene, and what blocks access")
            String accessNotes,

            @JsonPropertyDescription("False if the photo does not depict the reported disaster type — possible spam or mis-tagged report")
            boolean imageMatchesReport,

            @JsonPropertyDescription("Equipment, vehicles or specialists the scene calls for")
            List<String> recommendedResources,

            @JsonPropertyDescription("Urgency from 0.0 (trivial) to 1.0 (immediate threat to life)")
            double severityScore,

            @JsonPropertyDescription("One of CRITICAL, HIGH, MEDIUM, LOW")
            String severityLabel
    ) {}

    /** Whether a fresh report describes an event already in the system. */
    public record DuplicateVerdict(
            @JsonPropertyDescription("One sentence comparing the new report with the closest candidate: location, type, timing, details")
            String reasoning,

            @JsonPropertyDescription("True if, per the reasoning, the new report describes the same real-world event as a candidate")
            boolean isDuplicate,

            @JsonPropertyDescription("Id of the incident it duplicates, or 0 when isDuplicate is false")
            long duplicateOfIncidentId,

            @JsonPropertyDescription("Confidence in the isDuplicate decision, from 0.0 to 1.0")
            double confidence
    ) {}

    /** One volunteer matched to one incident. */
    public record DispatchAssignment(
            long incidentId,
            long volunteerId,
            String volunteerName,

            @JsonPropertyDescription("Why this volunteer for this incident, citing distance and severity")
            String rationale,

            @JsonPropertyDescription("1 is dispatch first; larger numbers are lower priority")
            int priority
    ) {}

    /** A full triage plan across every open incident and available volunteer. */
    public record DispatchPlan(
            @JsonPropertyDescription("Two-sentence summary of the overall triage strategy")
            String overallStrategy,

            List<DispatchAssignment> assignments,

            @JsonPropertyDescription("Incidents left unassigned because no suitable volunteer was free")
            List<String> unassignedNotes
    ) {}
}
