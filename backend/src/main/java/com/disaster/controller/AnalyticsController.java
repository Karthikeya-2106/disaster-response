package com.disaster.controller;

import com.disaster.entity.IncidentTimelineEntry;
import com.disaster.repository.IncidentTimelineRepository;
import com.disaster.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final IncidentTimelineRepository timelineRepo;

    @GetMapping("/dashboard")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> dashboard() {
        return ResponseEntity.ok(analyticsService.getDashboardAnalytics());
    }

    @GetMapping("/incident/{id}/timeline")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<IncidentTimelineEntry>> timeline(@PathVariable Long id) {
        return ResponseEntity.ok(timelineRepo.findByIncidentIdOrderByChangedAtAsc(id));
    }
}
