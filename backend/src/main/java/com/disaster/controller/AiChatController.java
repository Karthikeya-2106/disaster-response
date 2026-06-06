package com.disaster.controller;

import com.disaster.service.AiChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiChatController {

    private final AiChatService aiChat;

    @PostMapping("/chat")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, String>> chat(@RequestBody Map<String, String> body) {
        String message = body.getOrDefault("message", "").trim();
        if (message.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("reply", "Please enter a message."));
        }
        String reply = aiChat.chat(message);
        return ResponseEntity.ok(Map.of("reply", reply));
    }

    @PostMapping("/analyze-incident")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> analyzeIncident(@RequestBody Map<String, String> body) {
        Map<String, Object> result = aiChat.analyzeIncident(
            body.getOrDefault("title", ""),
            body.getOrDefault("description", ""),
            body.getOrDefault("disasterType", "UNKNOWN"),
            body.getOrDefault("severity", "MEDIUM")
        );
        return ResponseEntity.ok(result);
    }
}
