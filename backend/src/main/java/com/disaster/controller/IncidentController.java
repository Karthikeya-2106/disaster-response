package com.disaster.controller;

import com.disaster.dto.AppDtos.*;
import com.disaster.enums.Severity;
import com.disaster.security.UserPrincipal;
import com.disaster.service.AiSeverityService;
import com.disaster.service.FileStorageService;
import com.disaster.service.IncidentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;
    private final FileStorageService storage;
    private final AiSeverityService ai;

    @PostMapping
    @PreAuthorize("hasAnyRole('CITIZEN','VOLUNTEER','ADMIN')")
    public ResponseEntity<IncidentResponse> create(
            @Valid @RequestBody CreateIncidentRequest req,
            @AuthenticationPrincipal UserPrincipal user) {
        double score = ai.estimate(null, req.getSeverity());
        return ResponseEntity.ok(incidentService.create(req, user, score));
    }

    /** Upload image first, returns URL to use in incident creation. */
    @PostMapping("/upload-image")
    @PreAuthorize("hasAnyRole('CITIZEN','VOLUNTEER','ADMIN')")
    public ResponseEntity<Map<String, Object>> uploadImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "severity", defaultValue = "MEDIUM") Severity severity) {
        byte[] bytes = storage.bytes(file);
        double score = ai.estimate(bytes, severity);
        String url = storage.store(file);
        return ResponseEntity.ok(Map.of("imageUrl", url, "aiSeverityScore", score));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<IncidentResponse>> all() {
        return ResponseEntity.ok(incidentService.findAll());
    }

    @GetMapping("/active")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<IncidentResponse>> active() {
        return ResponseEntity.ok(incidentService.findActive());
    }

    @GetMapping("/nearby")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<IncidentResponse>> nearby(
            @RequestParam double lat, @RequestParam double lng,
            @RequestParam(defaultValue = "10") double radiusKm) {
        return ResponseEntity.ok(incidentService.findNearby(lat, lng, radiusKm));
    }

    @GetMapping("/severity/{severity}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<IncidentResponse>> bySeverity(@PathVariable Severity severity) {
        return ResponseEntity.ok(incidentService.findBySeverity(severity));
    }

    @GetMapping("/my-reports")
    @PreAuthorize("hasAnyRole('CITIZEN','VOLUNTEER','ADMIN')")
    public ResponseEntity<List<IncidentResponse>> myReports(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(incidentService.findByReporter(user.getUserId()));
    }

    @GetMapping("/assigned-to-me")
    @PreAuthorize("hasRole('VOLUNTEER')")
    public ResponseEntity<List<IncidentResponse>> assignedToMe(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(incidentService.findByVolunteer(user.getUserId()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<IncidentResponse> findOne(@PathVariable Long id) {
        return ResponseEntity.ok(incidentService.findById(id));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('VOLUNTEER','ADMIN')")
    public ResponseEntity<IncidentResponse> updateStatus(
            @PathVariable Long id, @Valid @RequestBody UpdateStatusRequest req,
            @AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(incidentService.updateStatus(id, req, user));
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<IncidentResponse> assign(
            @PathVariable Long id, @Valid @RequestBody AssignRequest req,
            @AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(incidentService.assignVolunteer(id, req, user));
    }

    @PostMapping("/{id}/accept")
    @PreAuthorize("hasRole('VOLUNTEER')")
    public ResponseEntity<IncidentResponse> accept(
            @PathVariable Long id, @AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(incidentService.acceptByVolunteer(id, user));
    }

    @PostMapping("/sos")
    @PreAuthorize("hasAnyRole('CITIZEN','VOLUNTEER','ADMIN')")
    public ResponseEntity<IncidentResponse> sos(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal user) {
        double lat = ((Number) body.getOrDefault("latitude", 17.3850)).doubleValue();
        double lng = ((Number) body.getOrDefault("longitude", 78.4867)).doubleValue();
        String address = (String) body.getOrDefault("address", null);
        return ResponseEntity.ok(incidentService.createSos(lat, lng, address, user));
    }
}
