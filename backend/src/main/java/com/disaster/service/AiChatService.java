package com.disaster.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class AiChatService {

    @Value("${anthropic.api-key:}")
    private String apiKey;

    @Value("${anthropic.model:claude-haiku-4-5-20251001}")
    private String model;

    private static final String API_URL = "https://api.anthropic.com/v1/messages";
    private static final String ANTHROPIC_VERSION = "2023-06-01";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper mapper = new ObjectMapper();

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
        if (apiKey == null || apiKey.isBlank()) {
            return getFallbackResponse(userMessage);
        }
        try {
            Map<String, Object> body = Map.of(
                    "model", model,
                    "max_tokens", 400,
                    "system", SYSTEM_PROMPT,
                    "messages", List.of(Map.of("role", "user", "content", userMessage))
            );
            String json = mapper.writeValueAsString(body);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_URL))
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", ANTHROPIC_VERSION)
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .timeout(Duration.ofSeconds(15))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                Map<?, ?> resp = mapper.readValue(response.body(), Map.class);
                List<?> content = (List<?>) resp.get("content");
                if (content != null && !content.isEmpty()) {
                    return (String) ((Map<?, ?>) content.get(0)).get("text");
                }
            }
        } catch (Exception ignored) {}
        return "AI assistant temporarily unavailable. For emergencies call 112.";
    }

    public Map<String, Object> analyzeIncident(String title, String description, String disasterType, String severity) {
        if (apiKey == null || apiKey.isBlank()) {
            return Map.of(
                "score", baselineScore(severity),
                "assessment", "AI analysis unavailable — configure ANTHROPIC_API_KEY for intelligent analysis.",
                "recommendations", List.of(
                    "Follow standard " + disasterType + " response protocol",
                    "Contact emergency services if lives are at risk",
                    "Document the scene safely before responders arrive"
                ),
                "estimatedAffected", "Under manual assessment"
            );
        }
        String prompt = String.format("""
                Analyze this disaster incident report and return a JSON assessment:

                Title: %s
                Disaster Type: %s
                Reported Severity: %s
                Description: %s

                Return ONLY valid JSON with these exact fields (no markdown, no extra text):
                {
                  "score": <decimal 0.0-1.0>,
                  "assessment": "<2-sentence situation assessment>",
                  "recommendations": ["<action1>", "<action2>", "<action3>"],
                  "estimatedAffected": "<estimate, e.g. '20-50 people'>"
                }
                """, title, disasterType, severity, description);
        try {
            Map<String, Object> body = Map.of(
                    "model", model,
                    "max_tokens", 500,
                    "messages", List.of(Map.of("role", "user", "content", prompt))
            );
            String json = mapper.writeValueAsString(body);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_URL))
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", ANTHROPIC_VERSION)
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .timeout(Duration.ofSeconds(20))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                Map<?, ?> resp = mapper.readValue(response.body(), Map.class);
                List<?> content = (List<?>) resp.get("content");
                if (content != null && !content.isEmpty()) {
                    String text = (String) ((Map<?, ?>) content.get(0)).get("text");
                    int start = text.indexOf('{');
                    int end = text.lastIndexOf('}');
                    if (start >= 0 && end > start) {
                        return mapper.readValue(text.substring(start, end + 1), Map.class);
                    }
                }
            }
        } catch (Exception ignored) {}
        return Map.of(
            "score", baselineScore(severity),
            "assessment", "AI analysis encountered an error. Manual review required.",
            "recommendations", List.of("Follow standard emergency protocol", "Contact relevant authorities"),
            "estimatedAffected", "Under assessment"
        );
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
