package com.disaster.entity;

import com.disaster.enums.*;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "incidents", indexes = {
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_severity", columnList = "severity")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Incident {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private String title;
    @Column(nullable = false, length = 2000) private String description;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private DisasterType disasterType;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Severity severity;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private IncidentStatus status;
    @Column(nullable = false) private Double latitude;
    @Column(nullable = false) private Double longitude;
    private String address;
    private String imageUrl;
    @Column(nullable = false) private Long reporterId;
    private String reporterName;
    private Long assignedVolunteerId;
    private String assignedVolunteerName;
    private Double aiSeverityScore;
    @Column(length = 1000) private String progressNote;
    @Column(nullable = false, updatable = false) private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @PrePersist void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        if (this.status == null) this.status = IncidentStatus.REPORTED;
    }
    @PreUpdate void onUpdate() { this.updatedAt = LocalDateTime.now(); }
}
