package com.disaster.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

/**
 * One entry point for the AI layer, backed by a free provider:
 *
 * <ul>
 *   <li><b>gemini</b> — Google AI Studio free tier. Needs {@code GEMINI_API_KEY}, no card.
 *       Rate-limited; per Google's pricing page, free-tier content is used to improve its products.</li>
 *   <li><b>ollama</b> — a model running locally. No key, no quota, works offline, and photos
 *       never leave the machine.</li>
 *   <li><b>none</b> — every caller falls back to deterministic heuristics.</li>
 * </ul>
 *
 * {@code auto} (the default) picks gemini when a key is present, otherwise none. Ollama must
 * be chosen explicitly because it needs a local install.
 *
 * <p>No method here throws: any failure (network, quota, bad JSON) is logged and returned as
 * an empty Optional so callers can degrade to their heuristic.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AiClient {

    public enum Provider { GEMINI, OLLAMA, NONE }

    /** Image attached to a request. */
    public record Image(byte[] bytes, String mimeType) {}

    private final ObjectMapper mapper;

    @Value("${ai.provider:auto}") private String providerSetting;
    /** 0 = pick per provider in init(): 60 s Gemini, 300 s Ollama (a CPU photo took up to 166 s in testing). */
    @Value("${ai.timeout-seconds:0}") private long timeoutSeconds;
    @Value("${ai.gemini.api-key:}") private String geminiKey;
    @Value("${ai.gemini.model:gemini-3.8-flash}") private String geminiModel;
    @Value("${ai.ollama.base-url:http://localhost:11434}") private String ollamaUrl;
    @Value("${ai.ollama.model:qwen2.5vl:3b}") private String ollamaModel;
    @Value("${ai.ollama.num-ctx:0}") private int ollamaNumCtx;

    @Value("${ai.gemini.base-url:https://generativelanguage.googleapis.com/v1beta/models/}") private String geminiBase;

    private Provider provider = Provider.NONE;
    private HttpClient http;
    private volatile boolean geminiPropertyOrdering = true;

    @PostConstruct
    void init() {
        http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        String setting = providerSetting == null ? "auto" : providerSetting.trim().toLowerCase();
        provider = switch (setting) {
            case "gemini" -> hasGeminiKey() ? Provider.GEMINI : warnNone("AI_PROVIDER=gemini but GEMINI_API_KEY is empty");
            case "ollama" -> Provider.OLLAMA;
            case "none", "off", "disabled" -> Provider.NONE;
            default -> hasGeminiKey() ? Provider.GEMINI : Provider.NONE;
        };
        if (timeoutSeconds <= 0) timeoutSeconds = provider == Provider.OLLAMA ? 300 : 60;
        log.info("AI provider: {}{}", provider,
                provider == Provider.NONE ? " (heuristic fallbacks only)"
                        : " using model " + model() + ", timeout " + timeoutSeconds + " s");
    }

    public boolean enabled() { return provider != Provider.NONE; }

    public Provider provider() { return provider; }

    public String model() {
        return switch (provider) {
            case GEMINI -> geminiModel;
            case OLLAMA -> ollamaModel;
            case NONE -> "none";
        };
    }

    /** Generate a reply constrained to {@code schema}'s record shape and parse it. */
    public <T> Optional<T> structured(String system, String prompt, Image image, Class<T> schema) {
        if (!enabled()) return Optional.empty();
        Optional<String> raw = switch (provider) {
            case GEMINI -> gemini(system, prompt, image, JsonSchemas.forRecord(schema, true));
            case OLLAMA -> ollama(system, prompt, image, JsonSchemas.forRecord(schema, false));
            case NONE -> Optional.empty();
        };
        return raw.flatMap(text -> parse(text, schema));
    }

    /** Free-text reply, for the chat assistant. */
    public Optional<String> text(String system, String prompt) {
        if (!enabled()) return Optional.empty();
        return switch (provider) {
            case GEMINI -> gemini(system, prompt, null, null);
            case OLLAMA -> ollama(system, prompt, null, null);
            case NONE -> Optional.empty();
        };
    }

    // ------------------------------------------------------------------ gemini

    private Optional<String> gemini(String system, String prompt, Image image, Map<String, Object> schema) {
        List<Object> parts = new ArrayList<>();
        if (image != null) {
            parts.add(Map.of("inlineData", Map.of(
                    "mimeType", image.mimeType(),
                    "data", Base64.getEncoder().encodeToString(image.bytes()))));
        }
        parts.add(Map.of("text", prompt));

        Map<String, Object> body = new LinkedHashMap<>();
        if (system != null) body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", system))));
        body.put("contents", List.of(Map.of("role", "user", "parts", parts)));
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("temperature", 0.2);
        if (schema != null) {
            config.put("responseMimeType", "application/json");
            config.put("responseSchema", geminiPropertyOrdering ? schema : withoutPropertyOrdering(schema));
        }
        body.put("generationConfig", config);

        String base = geminiBase.endsWith("/") ? geminiBase : geminiBase + "/";
        String url = base + geminiModel + ":generateContent";
        Map<String, String> headers = Map.of("x-goog-api-key", geminiKey);
        Optional<HttpResponse<String>> resp = send(url, body, headers);

        // propertyOrdering keeps reasoning ahead of verdicts, but if this API version rejects the
        // field, one bad keyword must not disable Gemini entirely: drop it and remember that.
        if (schema != null && geminiPropertyOrdering && resp.isPresent()
                && resp.get().statusCode() == 400 && resp.get().body().contains("propertyOrdering")) {
            log.warn("Gemini rejected propertyOrdering; continuing without it (fields will be emitted alphabetically)");
            geminiPropertyOrdering = false;
            config.put("responseSchema", withoutPropertyOrdering(schema));
            resp = send(url, body, headers);
        }

        return resp.flatMap(this::toJson)
                .map(json -> {
                    StringBuilder out = new StringBuilder();
                    for (JsonNode part : json.path("candidates").path(0).path("content").path("parts")) {
                        if (!part.path("thought").asBoolean(false)) out.append(part.path("text").asText(""));
                    }
                    return out.toString();
                })
                .filter(s -> !s.isBlank());
    }

    // ------------------------------------------------------------------ ollama

    private Optional<String> ollama(String system, String prompt, Image image, Map<String, Object> schema) {
        List<Object> messages = new ArrayList<>();
        if (system != null) messages.add(Map.of("role", "system", "content", system));
        Map<String, Object> user = new LinkedHashMap<>();
        user.put("role", "user");
        // Ollama's `format` only constrains the output grammar — the model never sees the field
        // descriptions (score ranges, "exactly three", ...). Put the schema in the prompt too,
        // as Ollama's own docs recommend. Gemini reads descriptions natively, so it skips this.
        String content = prompt;
        if (schema != null) {
            try {
                content = prompt + "\n\nRespond with JSON matching this schema. Follow each field's description:\n"
                        + mapper.writeValueAsString(schema);
            } catch (Exception ignored) { }
        }
        user.put("content", content);
        if (image != null) user.put("images", List.of(Base64.getEncoder().encodeToString(image.bytes())));
        messages.add(user);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", ollamaModel);
        body.put("messages", messages);
        body.put("stream", false);
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("temperature", 0.2);
        // Ollama silently drops the *start* of an over-long prompt (i.e. the system prompt).
        // 0 keeps Ollama's own default; raise it for big dispatch boards if RAM allows.
        if (ollamaNumCtx > 0) options.put("num_ctx", ollamaNumCtx);
        body.put("options", options);
        if (schema != null) body.put("format", schema);

        String base = ollamaUrl.endsWith("/") ? ollamaUrl.substring(0, ollamaUrl.length() - 1) : ollamaUrl;
        return post(base + "/api/chat", body, Map.of())
                .map(json -> json.path("message").path("content").asText(""))
                .filter(s -> !s.isBlank());
    }

    // ------------------------------------------------------------------ plumbing

    private Optional<JsonNode> post(String url, Object body, Map<String, String> headers) {
        return send(url, body, headers).flatMap(this::toJson);
    }

    /** Raw HTTP exchange; empty only when the request never got a response. */
    private Optional<HttpResponse<String>> send(String url, Object body, Map<String, String> headers) {
        try {
            HttpRequest.Builder req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
            headers.forEach(req::header);
            return Optional.of(http.send(req.build(), HttpResponse.BodyHandlers.ofString()));
        } catch (java.net.ConnectException e) {
            log.warn("{} unreachable at {} — is it running?", provider, provider == Provider.OLLAMA ? ollamaUrl : "Google AI");
        } catch (java.net.http.HttpTimeoutException e) {
            log.warn("{} did not answer within {} s (AI_TIMEOUT_SECONDS) — falling back", provider, timeoutSeconds);
        } catch (Exception e) {
            log.warn("{} request failed: {}", provider, e.toString());
        }
        return Optional.empty();
    }

    private Optional<JsonNode> toJson(HttpResponse<String> resp) {
        if (resp.statusCode() == 429) {
            log.warn("{} rate limit hit (free-tier quota) — falling back to heuristics", provider);
            return Optional.empty();
        }
        if (resp.statusCode() / 100 != 2) {
            log.warn("{} returned HTTP {}: {}", provider, resp.statusCode(), abbreviate(resp.body()));
            return Optional.empty();
        }
        try {
            return Optional.of(mapper.readTree(resp.body()));
        } catch (Exception e) {
            log.warn("{} returned unparseable body: {}", provider, abbreviate(resp.body()));
            return Optional.empty();
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> withoutPropertyOrdering(Map<String, Object> schema) {
        Map<String, Object> copy = new LinkedHashMap<>();
        schema.forEach((k, v) -> {
            if (k.equals("propertyOrdering")) return;
            if (v instanceof Map<?, ?> m) v = withoutPropertyOrdering((Map<String, Object>) m);
            copy.put(k, v);
        });
        return copy;
    }

    private <T> Optional<T> parse(String text, Class<T> type) {
        String json = text.strip();
        // Schema mode should return bare JSON, but local models occasionally fence it anyway.
        if (json.startsWith("```")) {
            int start = json.indexOf('{');
            int end = json.lastIndexOf('}');
            if (start >= 0 && end > start) json = json.substring(start, end + 1);
        }
        try {
            return Optional.of(mapper.readValue(json, type));
        } catch (Exception e) {
            log.warn("{} reply did not match {}: {}", provider, type.getSimpleName(), abbreviate(text));
            return Optional.empty();
        }
    }

    private boolean hasGeminiKey() { return geminiKey != null && !geminiKey.isBlank(); }

    private Provider warnNone(String why) {
        log.warn("{} — AI disabled", why);
        return Provider.NONE;
    }

    private static String abbreviate(String s) {
        if (s == null) return "";
        return s.length() > 300 ? s.substring(0, 300) + "…" : s;
    }
}
