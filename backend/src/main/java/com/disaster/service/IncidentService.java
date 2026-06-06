package com.disaster.service;

import com.disaster.dto.AppDtos.*;
import com.disaster.entity.AuditLog;
import com.disaster.entity.Incident;
import com.disaster.entity.IncidentTimelineEntry;
import com.disaster.enums.DisasterType;
import com.disaster.enums.IncidentStatus;
import com.disaster.enums.Severity;
import com.disaster.exception.AppException;
import com.disaster.repository.AuditLogRepository;
import com.disaster.repository.IncidentRepository;
import com.disaster.repository.IncidentTimelineRepository;
import com.disaster.security.UserPrincipal;
import com.disaster.websocket.EventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentRepository repo;
    private final AuditLogRepository auditRepo;
    private final IncidentTimelineRepository timelineRepo;
    private final EventPublisher publisher;

    @Transactional
    @CacheEvict(value = "incidents", allEntries = true)
    public IncidentResponse create(CreateIncidentRequest req, UserPrincipal user, Double aiScore) {
        Incident i = Incident.builder()
                .title(req.getTitle()).description(req.getDescription())
                .disasterType(req.getDisasterType()).severity(req.getSeverity())
                .status(IncidentStatus.REPORTED)
                .latitude(req.getLatitude()).longitude(req.getLongitude())
                .address(req.getAddress()).imageUrl(req.getImageUrl())
                .reporterId(user.getUserId()).reporterName(user.getEmail())
                .aiSeverityScore(aiScore).build();
        i = repo.save(i);
        audit(user, "CREATE_INCIDENT", "Incident", i.getId(), "Created: " + i.getTitle());
        saveTimeline(i.getId(), null, "REPORTED", user.getEmail(), user.getRole(), "Incident reported");
        IncidentResponse resp = toResponse(i);
        publisher.incidentCreated(resp);
        return resp;
    }

    @Transactional
    @CacheEvict(value = "incidents", allEntries = true)
    public IncidentResponse createSos(double latitude, double longitude, String address, UserPrincipal user) {
        Incident i = Incident.builder()
                .title("🆘 SOS — Emergency Help Needed")
                .description("One-tap SOS alert triggered. Immediate assistance required at this location.")
                .disasterType(DisasterType.OTHER)
                .severity(Severity.CRITICAL)
                .status(IncidentStatus.REPORTED)
                .latitude(latitude).longitude(longitude)
                .address(address != null ? address : "Location shared via SOS")
                .reporterId(user.getUserId()).reporterName(user.getEmail())
                .aiSeverityScore(1.0).build();
        i = repo.save(i);
        audit(user, "SOS_TRIGGERED", "Incident", i.getId(), "SOS by " + user.getEmail());
        saveTimeline(i.getId(), null, "REPORTED", user.getEmail(), user.getRole(), "SOS alert triggered");
        IncidentResponse resp = toResponse(i);
        publisher.incidentCreated(resp);
        return resp;
    }

    @Transactional(readOnly = true)
    public List<IncidentResponse> findAll() {
        return repo.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<IncidentResponse> findActive() {
        return repo.findAll().stream()
                .filter(i -> i.getStatus() != IncidentStatus.RESOLVED && i.getStatus() != IncidentStatus.CANCELLED)
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<IncidentResponse> findBySeverity(Severity s) {
        return repo.findBySeverity(s).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<IncidentResponse> findNearby(double lat, double lng, double radiusKm) {
        return repo.findNearby(lat, lng, radiusKm).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<IncidentResponse> findByReporter(Long id) {
        return repo.findByReporterId(id).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<IncidentResponse> findByVolunteer(Long id) {
        return repo.findByAssignedVolunteerId(id).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public IncidentResponse findById(Long id) {
        return repo.findById(id).map(this::toResponse)
                .orElseThrow(() -> new AppException("Incident not found", 404));
    }

    @Transactional
    @CacheEvict(value = "incidents", allEntries = true)
    public IncidentResponse updateStatus(Long id, UpdateStatusRequest req, UserPrincipal user) {
        Incident i = repo.findById(id).orElseThrow(() -> new AppException("Incident not found", 404));
        String prevStatus = i.getStatus().name();
        i.setStatus(req.getStatus());
        if (req.getProgressNote() != null) i.setProgressNote(req.getProgressNote());
        i = repo.save(i);
        audit(user, "UPDATE_STATUS", "Incident", id, "Status -> " + req.getStatus());
        saveTimeline(id, prevStatus, req.getStatus().name(), user.getEmail(), user.getRole(), req.getProgressNote());
        IncidentResponse resp = toResponse(i);
        publisher.incidentUpdated(resp);
        return resp;
    }

    @Transactional
    @CacheEvict(value = "incidents", allEntries = true)
    public IncidentResponse assignVolunteer(Long id, AssignRequest req, UserPrincipal user) {
        Incident i = repo.findById(id).orElseThrow(() -> new AppException("Incident not found", 404));
        String prevStatus = i.getStatus().name();
        i.setAssignedVolunteerId(req.getVolunteerId());
        i.setAssignedVolunteerName(req.getVolunteerName());
        i.setStatus(IncidentStatus.ASSIGNED);
        i = repo.save(i);
        audit(user, "ASSIGN_VOLUNTEER", "Incident", id, "Assigned to: " + req.getVolunteerName());
        saveTimeline(id, prevStatus, "ASSIGNED", user.getEmail(), user.getRole(), "Assigned to volunteer: " + req.getVolunteerName());
        IncidentResponse resp = toResponse(i);
        publisher.incidentUpdated(resp);
        return resp;
    }

    @Transactional
    public IncidentResponse acceptByVolunteer(Long id, UserPrincipal user) {
        Incident i = repo.findById(id).orElseThrow(() -> new AppException("Incident not found", 404));
        if (i.getAssignedVolunteerId() != null && !i.getAssignedVolunteerId().equals(user.getUserId()))
            throw new AppException("Already assigned to another volunteer", 409);
        String prevStatus = i.getStatus().name();
        i.setAssignedVolunteerId(user.getUserId());
        i.setAssignedVolunteerName(user.getEmail());
        i.setStatus(IncidentStatus.ASSIGNED);
        i = repo.save(i);
        audit(user, "ACCEPT_INCIDENT", "Incident", id, "Volunteer accepted");
        saveTimeline(id, prevStatus, "ASSIGNED", user.getEmail(), user.getRole(), "Volunteer self-assigned");
        IncidentResponse resp = toResponse(i);
        publisher.incidentUpdated(resp);
        return resp;
    }

    public DashboardStats stats(long availableVolunteers, long totalShelters, long capacity, long occupancy) {
        long total = repo.count();
        long active = repo.countByStatus(IncidentStatus.REPORTED)
                    + repo.countByStatus(IncidentStatus.ASSIGNED)
                    + repo.countByStatus(IncidentStatus.IN_PROGRESS);
        long resolvedToday = repo.findByStatus(IncidentStatus.RESOLVED).stream()
                .filter(i -> i.getUpdatedAt() != null && i.getUpdatedAt().toLocalDate().isEqual(LocalDate.now()))
                .count();
        long critical = repo.countBySeverity(Severity.CRITICAL);
        return DashboardStats.builder()
                .totalIncidents(total).activeIncidents(active)
                .resolvedToday(resolvedToday).criticalIncidents(critical)
                .availableVolunteers(availableVolunteers)
                .totalShelters(totalShelters).totalShelterCapacity(capacity)
                .currentOccupancy(occupancy).build();
    }

    private void audit(UserPrincipal user, String action, String type, Long entityId, String details) {
        auditRepo.save(AuditLog.builder()
                .actorId(user.getUserId()).actorRole(user.getRole())
                .action(action).entityType(type).entityId(entityId).details(details).build());
    }

    private void saveTimeline(Long incidentId, String fromStatus, String toStatus,
                               String byName, String byRole, String note) {
        timelineRepo.save(IncidentTimelineEntry.builder()
                .incidentId(incidentId).fromStatus(fromStatus).toStatus(toStatus)
                .changedByName(byName).changedByRole(byRole).note(note).build());
    }

    public IncidentResponse toResponse(Incident i) {
        return IncidentResponse.builder()
                .id(i.getId()).title(i.getTitle()).description(i.getDescription())
                .disasterType(i.getDisasterType()).severity(i.getSeverity()).status(i.getStatus())
                .latitude(i.getLatitude()).longitude(i.getLongitude())
                .address(i.getAddress()).imageUrl(i.getImageUrl())
                .reporterId(i.getReporterId()).reporterName(i.getReporterName())
                .assignedVolunteerId(i.getAssignedVolunteerId())
                .assignedVolunteerName(i.getAssignedVolunteerName())
                .aiSeverityScore(i.getAiSeverityScore()).progressNote(i.getProgressNote())
                .createdAt(i.getCreatedAt()).updatedAt(i.getUpdatedAt()).build();
    }
}
