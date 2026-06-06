package com.disaster.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "incident_timeline")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IncidentTimelineEntry {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private Long incidentId;
    private String fromStatus;
    @Column(nullable = false) private String toStatus;
    private String changedByName;
    private String changedByRole;
    @Column(length = 500) private String note;
    @Column(nullable = false, updatable = false) private LocalDateTime changedAt;
    @PrePersist void onCreate() { this.changedAt = LocalDateTime.now(); }
}
