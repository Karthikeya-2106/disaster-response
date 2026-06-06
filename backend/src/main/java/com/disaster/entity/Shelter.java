package com.disaster.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "shelters")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Shelter {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private String name;
    @Column(nullable = false) private String address;
    @Column(nullable = false) private Double latitude;
    @Column(nullable = false) private Double longitude;
    @Column(nullable = false) private Integer capacity;
    @Column(nullable = false) private Integer currentOccupancy;
    private String contactPhone;
    @Column(nullable = false) private Boolean active = true;
}
