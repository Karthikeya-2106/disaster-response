package com.disaster.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuditLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private Long actorId;
    private String actorRole;
    private String action;
    private String entityType;
    private Long entityId;
    @Column(length = 1000) private String details;
    @Column(nullable = false, updatable = false) private LocalDateTime timestamp;
    @PrePersist void onCreate() { this.timestamp = LocalDateTime.now(); }
}
