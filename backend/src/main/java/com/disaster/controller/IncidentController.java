package com.disaster.controller;

import com.disaster.dto.AppDtos.*;
import com.disaster.enums.Severity;
import com.disaster.security.UserPrincipal;
import com.disaster.service.AiVisionService;
import com.disaster.service.FileStorageService;
import com.disaster.service.PhotoAnalysisService;
import java.util.LinkedHashMap;
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
    private final AiVisionService vision;
    private final PhotoAnalysisService photos;
    private final com.fasterxml.jackson.databind.ObjectMapper mapper;

    @PostMapping
    @PreAuthorize("hasAnyRole('CITIZEN','VOLUNTEER','ADMIN')")
    public ResponseEntity<IncidentResponse> create(
            @Valid @RequestBody CreateIncidentRequest req,
            @AuthenticationPrincipal UserPrincipal user) {
        // The score comes from the server-side analysis of the uploaded photo, never from the
        // request body — otherwise any citizen could mark their report 1.0 and jump the queue.
        PhotoAnalysisService.Lookup before = photos.lookup(req.getImageUrl());
        boolean analysed = before.status() == PhotoAnalysisService.Status.DONE && before.score() != null;
        double score = analysed ? before.score() : vision.baselineFor(req.getSeverity());
        IncidentResponse created = incidentService.create(req, user, score, analysed ? before.analysisJson() : null);

        // The analysis may have finished while we were saving. The worker writes its result
        // before looking for incidents, and we look again only after saving — so one of the two
        // always catches it. attachAiAnalysis skips incidents that already have one.
        if (!analysed && req.getImageUrl() != null) {
            PhotoAnalysisService.Lookup after = photos.lookup(req.getImageUrl());
            if (after.status() == PhotoAnalysisService.Status.DONE && after.score() != null) {
                incidentService.attachAiAnalysis(req.getImageUrl(), after.score(), after.analysisJson());
                created = incidentService.findById(created.getId());
            }
        }
        return ResponseEntity.ok(created);
    }

    /**
     * Stores the scene photo and returns straight away. The vision assessment runs in the
     * background (it can take minutes on a local CPU model); poll {@code /image-analysis} for it.
     * An incident filed before it finishes gets the analysis attached automatically.
     */
    @PostMapping("/upload-image")
    @PreAuthorize("hasAnyRole('CITIZEN','VOLUNTEER','ADMIN')")
    public ResponseEntity<Map<String, Object>> uploadImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "severity", defaultValue = "MEDIUM") Severity severity,
            @RequestParam(value = "description", required = false) String description) {
        String url = storage.store(file);   // validates type and size before any AI spend
        byte[] bytes = storage.bytes(file);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("imageUrl", url);
        body.put("aiSeverityScore", vision.heuristicScore(bytes, severity));
        body.put("aiStatus", photos.submit(url, bytes, file.getContentType(), severity, description)
                .name().toLowerCase());   // "pending" or "unavailable"
        return ResponseEntity.ok(body);
    }

    /** Progress of a photo's vision assessment: pending, done (with the analysis) or unavailable. */
    @GetMapping("/image-analysis")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> imageAnalysis(@RequestParam("url") String imageUrl) {
        PhotoAnalysisService.Lookup l = photos.lookup(imageUrl);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", l.status().name().toLowerCase());
        if (l.status() == PhotoAnalysisService.Status.DONE) {
            body.put("aiSeverityScore", l.score());
            try {
                body.put("aiAnalysis", mapper.readTree(l.analysisJson()));
            } catch (Exception e) {
                body.put("status", "unavailable");
            }
        }
        return ResponseEntity.ok(body);
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
