package com.disaster.service;

import com.disaster.ai.AiClient;
import com.disaster.dto.AiDtos.IncidentAnalysis;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AiChatService {

    private final AiClient ai;
    private final ObjectMapper mapper;

    private static final String SYSTEM_PROMPT = """
            You are an emergency response AI assistant integrated into a real-time Disaster Response Coordination System.
            Your role:
            1. Provide calm, clear, actionable guidance during emergencies
            2. Help users understand what to do for specific disasters (flood, fire, earthquake, cyclone, etc.)
            3. Explain platform features (reporting incidents, finding shelters, volunteering)
            4. Provide basic first aid and safety tips
            5. Direct people to emergency services when needed

            Indian Emergency Numbers:
            - 112: Universal Emergency
            - 100: Police
            - 101: Fire Department
            - 108: Ambulance/Medical
            - 1070: National Disaster Management Authority
            - 1077: State Disaster Management

            Keep responses concise (3-5 sentences), calm, and actionable. Always prioritize life safety.
            If asked about the platform: users can report incidents via "New Report", find shelters on the Map, and track help status on their dashboard.
            """;

    public String chat(String userMessage) {
        // With no provider, or if the provider fails, the keyword replies still give safe guidance.
        return ai.text(SYSTEM_PROMPT, userMessage).orElseGet(() -> getFallbackResponse(userMessage));
    }

    public Map<String, Object> analyzeIncident(String title, String description, String disasterType, String severity) {
        String prompt = """
                Analyze this disaster incident report.

                Title: %s
                Disaster Type: %s
                Reported Severity: %s
                Description: %s
                """.formatted(title, disasterType, severity, description);

        return ai.structured(null, prompt, null, IncidentAnalysis.class)
                .map(a -> new IncidentAnalysis(a.assessment(),
                        a.recommendations() == null ? List.of() : a.recommendations(),
                        a.estimatedAffected(), Math.max(0, Math.min(1, a.score()))))
                .map(a -> mapper.convertValue(a, new TypeReference<Map<String, Object>>() {}))
                .orElseGet(() -> Map.of(
                        "score", baselineScore(severity),
                        "assessment", ai.enabled()
                                ? "AI analysis unavailable right now. Manual review required."
                                : "AI analysis is off — configure a free provider (GEMINI_API_KEY or AI_PROVIDER=ollama).",
                        "recommendations", List.of(
                                "Follow standard " + disasterType + " response protocol",
                                "Contact emergency services if lives are at risk",
                                "Document the scene safely before responders arrive"),
                        "estimatedAffected", "Under manual assessment"));
    }

    private double baselineScore(String severity) {
        return switch (severity.toUpperCase()) {
            case "CRITICAL" -> 0.9;
            case "HIGH" -> 0.7;
            case "MEDIUM" -> 0.5;
            default -> 0.25;
        };
    }

    private String getFallbackResponse(String message) {
        String lower = message.toLowerCase();
        if (lower.contains("fire")) return "For fire emergencies: Call 101 immediately. Evacuate the building, stay low to avoid smoke, do NOT use elevators. Activate the fire alarm and meet at the assembly point.";
        if (lower.contains("flood")) return "For flood emergencies: Move to higher ground immediately. Avoid walking in moving water — just 15cm can knock you over. Call 1070 and report the incident on this platform using 'New Report'.";
        if (lower.contains("earthquake")) return "For earthquakes: Drop, Cover, and Hold On under a sturdy table. Stay away from windows. After shaking stops, evacuate carefully. Call 108 for injuries.";
        if (lower.contains("cyclone") || lower.contains("storm")) return "For cyclone/storm: Stay indoors away from windows. Go to the lowest floor if wind is severe. Keep emergency supplies ready. Monitor official warnings via 1070.";
        if (lower.contains("shelter")) return "To find shelters: Open the Map view on this platform — blue markers show available shelters with capacity info. You can also call 1070 for shelter assistance.";
        if (lower.contains("report") || lower.contains("incident")) return "To report an incident: Click 'New Report' on your dashboard. Enable location access, describe what's happening, and optionally upload a photo. Your report goes instantly to volunteers and admins.";
        if (lower.contains("volunteer")) return "Volunteers can see and accept active incidents on their dashboard. To become a volunteer, sign up with the VOLUNTEER role. Volunteers share their live location while on duty.";
        return "For any emergency call 112 (Universal Emergency). You can also report incidents using 'New Report', find shelters on the Map, and track your report status on your dashboard. I'm here to help — what's your situation?";
    }
}
