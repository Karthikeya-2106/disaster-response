package com.disaster.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "volunteer_locations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class VolunteerLocation {
    @Id private Long volunteerId;
    private String volunteerName;
    private Double latitude;
    private Double longitude;
    private Boolean available;
    private LocalDateTime updatedAt;
    @PreUpdate @PrePersist void onSave() { this.updatedAt = LocalDateTime.now(); }
}
