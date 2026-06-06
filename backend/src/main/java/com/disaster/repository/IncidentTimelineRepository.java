package com.disaster.repository;

import com.disaster.entity.IncidentTimelineEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IncidentTimelineRepository extends JpaRepository<IncidentTimelineEntry, Long> {
    List<IncidentTimelineEntry> findByIncidentIdOrderByChangedAtAsc(Long incidentId);
}
