package com.disaster.service;

import com.disaster.enums.Severity;
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
public class AiSeverityService {

    @Value("${anthropic.api-key:}")
    private String apiKey;

    @Value("${anthropic.model:claude-haiku-4-5-20251001}")
    private String model;

    private static final String API_URL = "https://api.anthropic.com/v1/messages";
    private static final String ANTHROPIC_VERSION = "2023-06-01";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();
    private final ObjectMapper mapper = new ObjectMapper();

    public double estimate(byte[] imageBytes, Severity reportedSeverity) {
        // Use Claude for fast severity estimation when API key is available
        if (apiKey != null && !apiKey.isBlank()) {
            return estimateWithClaude(reportedSeverity);
        }
        return estimateFallback(imageBytes, reportedSeverity);
    }

    private double estimateWithClaude(Severity reportedSeverity) {
        String prompt = String.format(
            "A disaster incident has been reported with severity level: %s. " +
            "Return ONLY a decimal score between 0.0 and 1.0 representing true urgency " +
            "(1.0 = life-threatening, 0.0 = minor). No explanation, just the number.",
            reportedSeverity.name()
        );
        try {
            Map<String, Object> body = Map.of(
                    "model", model,
                    "max_tokens", 10,
                    "messages", List.of(Map.of("role", "user", "content", prompt))
            );
            String json = mapper.writeValueAsString(body);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_URL))
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", ANTHROPIC_VERSION)
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .timeout(Duration.ofSeconds(10))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                Map<?, ?> resp = mapper.readValue(response.body(), Map.class);
                List<?> content = (List<?>) resp.get("content");
                if (content != null && !content.isEmpty()) {
                    String text = ((String) ((Map<?, ?>) content.get(0)).get("text")).trim();
                    double score = Double.parseDouble(text.replaceAll("[^0-9.]", ""));
                    return Math.max(0.0, Math.min(1.0, score));
                }
            }
        } catch (Exception ignored) {}
        return baselineFor(reportedSeverity);
    }

    private double estimateFallback(byte[] imageBytes, Severity reportedSeverity) {
        double baseline = baselineFor(reportedSeverity);
        if (imageBytes == null || imageBytes.length == 0) return baseline;
        long sum = 0;
        int n = Math.min(imageBytes.length, 4096);
        for (int i = 0; i < n; i++) sum += (imageBytes[i] & 0xFF);
        double normalized = (sum % 1000) / 1000.0;
        double score = (normalized * 0.4) + (baseline * 0.6);
        return Math.max(0.0, Math.min(1.0, score));
    }

    private double baselineFor(Severity s) {
        return switch (s) {
            case CRITICAL -> 0.9;
            case HIGH -> 0.7;
            case MEDIUM -> 0.5;
            case LOW -> 0.25;
        };
    }
}
