package com.disaster.service;

import com.disaster.ai.AiClient;
import com.disaster.dto.AiDtos.DispatchAssignment;
import com.disaster.dto.AiDtos.DispatchPlan;
import com.disaster.dto.AiDtos.DuplicateVerdict;
import com.disaster.entity.Incident;
import com.disaster.entity.VolunteerLocation;
import com.disaster.enums.IncidentStatus;
import com.disaster.exception.AppException;
import com.disaster.repository.IncidentRepository;
import com.disaster.repository.VolunteerLocationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Two dispatch-desk problems that plain CRUD can't solve:
 *
 * <ul>
 *   <li><b>Duplicate detection</b> — during a real flood, ten citizens photograph the same
 *       submerged road. Without dedup, ten volunteers get sent to one scene.</li>
 *   <li><b>Dispatch planning</b> — matching free volunteers to open incidents by severity
 *       and distance, across the whole board at once rather than first-come-first-served.</li>
 * </ul>
 *
 * <p>Geometry is always computed here, deterministically; the model only makes judgment
 * calls on top of real distances. Every id the model returns is validated against the
 * database before it is trusted, and each method has a heuristic fallback so the feature
 * works with no API key.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiTriageService {

    private final AiClient ai;
    private final IncidentRepository incidents;
    private final VolunteerLocationRepository volunteers;

    /** Reports further apart than this are never the same event. */
    private static final double DEDUP_RADIUS_KM = 2.0;
    /** Reports further apart in time than this are never the same event. */
    private static final Duration DEDUP_WINDOW = Duration.ofHours(24);

    // ------------------------------------------------------------------ duplicates

    public DuplicateVerdict findDuplicate(Long incidentId) {
        Incident target = incidents.findById(incidentId)
                .orElseThrow(() -> new AppException("Incident not found", 404));

        List<Incident> candidates = incidents
                .findNearby(target.getLatitude(), target.getLongitude(), DEDUP_RADIUS_KM).stream()
                .filter(c -> !c.getId().equals(target.getId()))
                // A different disaster type is never the same event. That's an objective rule, so
                // enforce it here rather than trusting the model to — phi3 matched a flood report
                // to a transformer fire 80 m away despite the prompt saying exactly this.
                .filter(c -> c.getDisasterType() == target.getDisasterType())
                .filter(c -> withinWindow(c, target))
                .sorted(Comparator.comparingDouble(c -> km(c, target)))
                .limit(8)
                .toList();

        if (candidates.isEmpty()) {
            return new DuplicateVerdict("No other active " + target.getDisasterType() + " reports within "
                    + DEDUP_RADIUS_KM + " km in the last 24 hours.", false, 0, 1.0);
        }
        if (!ai.enabled()) {
            return heuristicDuplicate(target, candidates);
        }
        try {
            StringBuilder prompt = new StringBuilder("""
                    A new report has come in. Decide whether it describes the same real-world
                    event as any existing report below.

                    Different people describe one event very differently. Reporters routinely
                    disagree on severity and give more or less detail — a severity mismatch or
                    a missing detail on its own never makes a separate event. Judge by:
                    same disaster type, close location, overlapping time, and no concrete
                    detail that clearly contradicts it being the same scene.

                    Two genuinely separate events of the same type nearby (e.g. fires in two
                    different buildings) are NOT duplicates. A different disaster type at the
                    same spot is NOT a duplicate.

                    NEW REPORT
                    """);
            prompt.append(describe(target, null)).append("\nEXISTING REPORTS NEARBY\n");
            for (Incident c : candidates) prompt.append(describe(c, km(c, target))).append('\n');

            Optional<DuplicateVerdict> reply = ai.structured(null, prompt.toString(), null, DuplicateVerdict.class);
            if (reply.isEmpty()) return heuristicDuplicate(target, candidates);
            DuplicateVerdict verdict = reply.get();

            // Never trust an id the model produced: it must be one of the candidates we sent.
            Set<Long> allowed = candidates.stream().map(Incident::getId).collect(Collectors.toSet());
            if (verdict.isDuplicate() && !allowed.contains(verdict.duplicateOfIncidentId())) {
                log.warn("Model named incident {} which was not a candidate; discarding", verdict.duplicateOfIncidentId());
                return heuristicDuplicate(target, candidates);
            }
            double confidence = Math.max(0, Math.min(1, verdict.confidence()));
            if (!verdict.isDuplicate()) {
                // Small local models are inconsistent here (tested: phi3 flipped between runs on
                // an obvious match). When geometry says "same type, same spot, same hours" but
                // the model says "separate", surface it for a human rather than trusting either.
                DuplicateVerdict geometric = heuristicDuplicate(target, candidates);
                if (geometric.isDuplicate()) {
                    return new DuplicateVerdict("Possible duplicate — flagged for review. "
                            + geometric.reasoning() + " The model judged it separate: " + verdict.reasoning(),
                            true, geometric.duplicateOfIncidentId(), 0.5);
                }
                return new DuplicateVerdict(verdict.reasoning(), false, 0, confidence);
            }
            return new DuplicateVerdict(verdict.reasoning(), true, verdict.duplicateOfIncidentId(), confidence);
        } catch (Exception e) {
            log.warn("Duplicate check failed, using heuristic: {}", e.toString());
            return heuristicDuplicate(target, candidates);
        }
    }

    private DuplicateVerdict heuristicDuplicate(Incident target, List<Incident> candidates) {
        for (Incident c : candidates) {
            boolean sameType = c.getDisasterType() == target.getDisasterType();
            double d = km(c, target);
            long hours = Math.abs(Duration.between(c.getCreatedAt(), target.getCreatedAt()).toHours());
            if (sameType && d <= 0.5 && hours <= 6) {
                return new DuplicateVerdict(String.format(
                        "Same disaster type %.0f m away, reported within %d h (heuristic match).", d * 1000, hours),
                        true, c.getId(), 0.6);
            }
        }
        return new DuplicateVerdict("Nearby reports differ in type, distance or timing (heuristic).",
                false, 0, 0.5);
    }

    // ------------------------------------------------------------------ dispatch

    public DispatchPlan planDispatch() {
        List<Incident> open = incidents.findByStatus(IncidentStatus.REPORTED).stream()
                .filter(i -> i.getAssignedVolunteerId() == null)
                .toList();
        List<VolunteerLocation> free = volunteers.findByAvailableTrue().stream()
                .filter(v -> v.getLatitude() != null && v.getLongitude() != null)
                .toList();

        if (open.isEmpty()) {
            return new DispatchPlan("No unassigned incidents — nothing to dispatch.", List.of(), List.of());
        }
        if (free.isEmpty()) {
            return new DispatchPlan("No volunteers are currently available.", List.of(),
                    open.stream().map(i -> "#" + i.getId() + " " + i.getTitle()).toList());
        }
        if (!ai.enabled()) {
            return greedyPlan(open, free);
        }
        try {
            StringBuilder prompt = new StringBuilder("""
                    You are the dispatch coordinator. Assign available volunteers to open
                    incidents. Each volunteer can take at most one incident. Prioritise threat
                    to life first, then severity score, then travel distance. It is better to
                    leave a LOW incident unassigned than to send the only nearby volunteer
                    away from a CRITICAL one. Distances below are exact great-circle km.

                    OPEN INCIDENTS
                    """);
            for (Incident i : open) prompt.append(describe(i, null)).append('\n');
            prompt.append("\nAVAILABLE VOLUNTEERS (km to each incident)\n");
            for (VolunteerLocation v : free) {
                prompt.append("- volunteerId=").append(v.getVolunteerId())
                      .append(" name=").append(v.getVolunteerName()).append(" distances: ");
                prompt.append(open.stream()
                        .map(i -> "#" + i.getId() + "=" + String.format("%.1f", km(v, i)))
                        .collect(Collectors.joining(", ")));
                prompt.append('\n');
            }

            Optional<DispatchPlan> plan = ai.structured(null, prompt.toString(), null, DispatchPlan.class);
            if (plan.isEmpty()) return greedyPlan(open, free);
            return validate(plan.get(), open, free);
        } catch (Exception e) {
            log.warn("Dispatch planning failed, using greedy plan: {}", e.toString());
            return greedyPlan(open, free);
        }
    }

    /**
     * Drop anything that references an unknown id or double-books a volunteer. The model is
     * usually right, but a dispatch plan is the one place a hallucinated id sends a real
     * person to the wrong address.
     */
    private DispatchPlan validate(DispatchPlan plan, List<Incident> open, List<VolunteerLocation> free) {
        Map<Long, Incident> incidentById = open.stream().collect(Collectors.toMap(Incident::getId, i -> i));
        Map<Long, VolunteerLocation> volunteerById = free.stream()
                .collect(Collectors.toMap(VolunteerLocation::getVolunteerId, v -> v));
        Set<Long> usedVolunteers = new HashSet<>();
        Set<Long> usedIncidents = new HashSet<>();
        List<DispatchAssignment> kept = new ArrayList<>();

        for (DispatchAssignment a : Optional.ofNullable(plan.assignments()).orElse(List.of())) {
            VolunteerLocation v = volunteerById.get(a.volunteerId());
            if (!incidentById.containsKey(a.incidentId()) || v == null) {
                log.warn("Discarding assignment with unknown ids: incident {} volunteer {}", a.incidentId(), a.volunteerId());
                continue;
            }
            if (!usedVolunteers.add(a.volunteerId()) || !usedIncidents.add(a.incidentId())) {
                log.warn("Discarding double-booked assignment: incident {} volunteer {}", a.incidentId(), a.volunteerId());
                continue;
            }
            // Use the real name from the DB, not whatever the model echoed back.
            kept.add(new DispatchAssignment(a.incidentId(), a.volunteerId(), v.getVolunteerName(),
                    a.rationale(), a.priority()));
        }
        kept.sort(Comparator.comparingInt(DispatchAssignment::priority));

        List<String> unassigned = open.stream()
                .filter(i -> !usedIncidents.contains(i.getId()))
                .map(i -> "#" + i.getId() + " " + i.getTitle())
                .toList();
        return new DispatchPlan(plan.overallStrategy(), kept, unassigned);
    }

    /** Most urgent incident first, each takes the nearest volunteer still free. */
    private DispatchPlan greedyPlan(List<Incident> open, List<VolunteerLocation> free) {
        List<Incident> byUrgency = open.stream()
                .sorted(Comparator.comparingDouble(this::urgency).reversed())
                .toList();
        Set<Long> used = new HashSet<>();
        List<DispatchAssignment> out = new ArrayList<>();
        List<String> unassigned = new ArrayList<>();
        int priority = 1;

        for (Incident i : byUrgency) {
            Optional<VolunteerLocation> nearest = free.stream()
                    .filter(v -> !used.contains(v.getVolunteerId()))
                    .min(Comparator.comparingDouble(v -> km(v, i)));
            if (nearest.isEmpty()) {
                unassigned.add("#" + i.getId() + " " + i.getTitle());
                continue;
            }
            VolunteerLocation v = nearest.get();
            used.add(v.getVolunteerId());
            out.add(new DispatchAssignment(i.getId(), v.getVolunteerId(), v.getVolunteerName(),
                    String.format("%s %s incident; nearest free volunteer at %.1f km (heuristic).",
                            i.getSeverity(), i.getDisasterType(), km(v, i)),
                    priority++));
        }
        return new DispatchPlan(
                "Greedy plan: incidents ranked by severity, each matched to the nearest free volunteer. "
                        + "Configure a free AI provider (GEMINI_API_KEY or AI_PROVIDER=ollama) for model-driven triage.",
                out, unassigned);
    }

    // ------------------------------------------------------------------ helpers

    private double urgency(Incident i) {
        if (i.getAiSeverityScore() != null) return i.getAiSeverityScore();
        return switch (i.getSeverity()) {
            case CRITICAL -> 0.9;
            case HIGH -> 0.7;
            case MEDIUM -> 0.5;
            case LOW -> 0.25;
        };
    }

    private boolean withinWindow(Incident a, Incident b) {
        if (a.getCreatedAt() == null || b.getCreatedAt() == null) return true;
        return Duration.between(a.getCreatedAt(), b.getCreatedAt()).abs().compareTo(DEDUP_WINDOW) <= 0;
    }

    private String describe(Incident i, Double distanceKm) {
        return String.format("- id=%d type=%s severity=%s aiScore=%s status=%s reported=%s%s%n  title: %s%n  description: %s%n  address: %s",
                i.getId(), i.getDisasterType(), i.getSeverity(),
                i.getAiSeverityScore() == null ? "n/a" : String.format("%.2f", i.getAiSeverityScore()),
                i.getStatus(), i.getCreatedAt(),
                distanceKm == null ? "" : String.format(" distanceFromNew=%.2fkm", distanceKm),
                i.getTitle(), i.getDescription(), i.getAddress());
    }

    private static double km(Incident a, Incident b) {
        return haversine(a.getLatitude(), a.getLongitude(), b.getLatitude(), b.getLongitude());
    }

    private static double km(VolunteerLocation v, Incident i) {
        return haversine(v.getLatitude(), v.getLongitude(), i.getLatitude(), i.getLongitude());
    }

    static double haversine(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371.0 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }
}
