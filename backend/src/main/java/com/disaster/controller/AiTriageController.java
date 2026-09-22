package com.disaster.controller;

import com.disaster.ai.AiClient;
import com.disaster.dto.AiDtos.DispatchPlan;
import com.disaster.dto.AiDtos.DuplicateVerdict;
import com.disaster.service.AiTriageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiTriageController {

    private final AiTriageService triage;
    private final AiClient ai;

    /** Which provider is live, so the UI can label results honestly (AI vs heuristic). */
    @GetMapping("/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of(
                "enabled", ai.enabled(),
                "provider", ai.provider().name().toLowerCase(),
                "model", ai.model()));
    }

    /** Is this report the same real-world event as another active one nearby? */
    @GetMapping("/triage/duplicates/{incidentId}")
    @PreAuthorize("hasAnyRole('ADMIN','VOLUNTEER')")
    public ResponseEntity<DuplicateVerdict> duplicates(@PathVariable Long incidentId) {
        return ResponseEntity.ok(triage.findDuplicate(incidentId));
    }

    /**
     * Proposes volunteer-to-incident assignments across the whole board. Read-only: the
     * admin confirms each one through the existing assign endpoint.
     */
    @PostMapping("/triage/dispatch")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DispatchPlan> dispatch() {
        return ResponseEntity.ok(triage.planDispatch());
    }
}
