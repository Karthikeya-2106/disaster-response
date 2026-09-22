package com.disaster.repository;

import com.disaster.entity.Incident;
import com.disaster.enums.IncidentStatus;
import com.disaster.enums.Severity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface IncidentRepository extends JpaRepository<Incident, Long> {
    List<Incident> findByStatus(IncidentStatus status);
    List<Incident> findBySeverity(Severity severity);
    List<Incident> findByReporterId(Long reporterId);
    List<Incident> findByAssignedVolunteerId(Long volunteerId);
    List<Incident> findByImageUrl(String imageUrl);
    long countByStatus(IncidentStatus status);
    long countBySeverity(Severity severity);

    @Query(value = "SELECT * FROM incidents WHERE " +
            "(6371 * acos(cos(radians(:lat)) * cos(radians(latitude)) * " +
            "cos(radians(longitude) - radians(:lng)) + " +
            "sin(radians(:lat)) * sin(radians(latitude)))) < :radiusKm " +
            "AND status NOT IN ('RESOLVED','CANCELLED')",
            nativeQuery = true)
    List<Incident> findNearby(@Param("lat") double lat, @Param("lng") double lng, @Param("radiusKm") double radiusKm);
}
