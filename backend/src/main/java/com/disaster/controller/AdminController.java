package com.disaster.controller;

import com.disaster.dto.AppDtos.AlertRequest;
import com.disaster.dto.AppDtos.DashboardStats;
import com.disaster.entity.User;
import com.disaster.enums.Role;
import com.disaster.repository.UserRepository;
import com.disaster.service.IncidentService;
import com.disaster.service.ShelterService;
import com.disaster.service.VolunteerService;
import com.disaster.websocket.EventPublisher;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.disaster.dto.AppDtos.IncidentResponse;
import com.disaster.repository.AuditLogRepository;
import com.disaster.entity.AuditLog;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final IncidentService incidents;
    private final ShelterService shelters;
    private final VolunteerService volunteers;
    private final UserRepository userRepo;
    private final AuditLogRepository auditRepo;
    private final EventPublisher publisher;

    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DashboardStats> stats() {
        return ResponseEntity.ok(incidents.stats(
                volunteers.countAvailable(),
                shelters.findAll().size(),
                shelters.totalCapacity(),
                shelters.totalOccupancy()));
    }

    @GetMapping("/volunteers")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<User>> volunteersList() {
        // strip passwords before returning
        List<User> list = userRepo.findByRole(Role.VOLUNTEER);
        list.forEach(u -> u.setPassword(null));
        return ResponseEntity.ok(list);
    }

    @GetMapping("/export/incidents.csv")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<byte[]> exportIncidentsCsv() {
        List<IncidentResponse> all = incidents.findAll();
        StringBuilder csv = new StringBuilder("ID,Title,Type,Severity,Status,Reporter,Volunteer,Latitude,Longitude,Created\n");
        for (IncidentResponse i : all) {
            csv.append(String.format("%s,\"%s\",%s,%s,%s,%s,%s,%s,%s,%s\n",
                i.getId(), esc(i.getTitle()), i.getDisasterType(), i.getSeverity(),
                i.getStatus(), esc(i.getReporterName()),
                esc(i.getAssignedVolunteerName() != null ? i.getAssignedVolunteerName() : "Unassigned"),
                i.getLatitude(), i.getLongitude(), i.getCreatedAt()));
        }
        byte[] bytes = csv.toString().getBytes();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"incidents.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(bytes);
    }

    @GetMapping("/audit-logs")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AuditLog>> auditLogs() {
        List<AuditLog> logs = auditRepo.findAll();
        logs.sort((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()));
        return ResponseEntity.ok(logs.stream().limit(200).toList());
    }

    private String esc(String s) { return s == null ? "" : s.replace("\"", "\"\""); }

    @PostMapping("/broadcast-alert")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> broadcastAlert(@Valid @RequestBody AlertRequest req) {
        Map<String, Object> payload = Map.of(
                "title", req.getTitle(),
                "message", req.getMessage(),
                "severity", req.getSeverity().name(),
                "timestamp", LocalDateTime.now().toString());
        publisher.emergencyAlert(payload);
        return ResponseEntity.ok(payload);
    }
}
