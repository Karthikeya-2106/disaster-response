package com.disaster.ai;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import java.lang.reflect.ParameterizedType;
import java.lang.reflect.RecordComponent;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Derives a response schema from a Java record so each AI result type is declared exactly
 * once. Both free providers constrain generation to a schema, which is what makes the reply
 * reliably parseable instead of "please return only JSON" and hoping.
 *
 * <p>Gemini's {@code responseSchema} uses the OpenAPI type enum (upper-case {@code OBJECT},
 * {@code STRING}, ...); Ollama's {@code format} takes standard lower-case JSON Schema.
 */
final class JsonSchemas {

    private JsonSchemas() {}

    static Map<String, Object> forRecord(Class<?> type, boolean openApiTypes) {
        if (!type.isRecord()) throw new IllegalArgumentException(type + " is not a record");
        Map<String, Object> properties = new LinkedHashMap<>();
        List<String> required = new ArrayList<>();
        for (RecordComponent rc : type.getRecordComponents()) {
            Map<String, Object> prop = new LinkedHashMap<>(forType(rc.getGenericType(), openApiTypes));
            JsonPropertyDescription d = rc.getAccessor().getAnnotation(JsonPropertyDescription.class);
            if (d != null) prop.put("description", d.value());
            properties.put(rc.getName(), prop);
            required.add(rc.getName());
        }
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", t("object", openApiTypes));
        schema.put("properties", properties);
        schema.put("required", required);
        // Gemini otherwise emits properties alphabetically; keep reasoning ahead of verdicts.
        if (openApiTypes) schema.put("propertyOrdering", required);
        return schema;
    }

    private static Map<String, Object> forType(Type type, boolean openApi) {
        if (type instanceof ParameterizedType p && p.getRawType() == List.class) {
            return Map.of("type", t("array", openApi), "items", forType(p.getActualTypeArguments()[0], openApi));
        }
        if (type instanceof Class<?> c) {
            if (c == String.class) return Map.of("type", t("string", openApi));
            if (c == double.class || c == Double.class || c == float.class || c == Float.class)
                return Map.of("type", t("number", openApi));
            if (c == int.class || c == Integer.class || c == long.class || c == Long.class)
                return Map.of("type", t("integer", openApi));
            if (c == boolean.class || c == Boolean.class) return Map.of("type", t("boolean", openApi));
            if (c.isRecord()) return forRecord(c, openApi);
        }
        throw new IllegalArgumentException("Unsupported schema type: " + type);
    }

    private static String t(String name, boolean openApi) {
        return openApi ? name.toUpperCase() : name;
    }
}
