package com.disaster.dto;

import com.disaster.enums.*;
import jakarta.validation.constraints.*;
import lombok.*;
import java.time.LocalDateTime;

public class AppDtos {

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class CreateIncidentRequest {
        @NotBlank private String title;
        @NotBlank @Size(max = 2000) private String description;
        @NotNull private DisasterType disasterType;
        @NotNull private Severity severity;
        @NotNull private Double latitude;
        @NotNull private Double longitude;
        private String address;
        private String imageUrl;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class UpdateStatusRequest {
        @NotNull private IncidentStatus status;
        private String progressNote;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class AssignRequest {
        @NotNull private Long volunteerId;
        @NotBlank private String volunteerName;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class IncidentResponse {
        private Long id;
        private String title;
        private String description;
        private DisasterType disasterType;
        private Severity severity;
        private IncidentStatus status;
        private Double latitude;
        private Double longitude;
        private String address;
        private String imageUrl;
        private Long reporterId;
        private String reporterName;
        private Long assignedVolunteerId;
        private String assignedVolunteerName;
        private Double aiSeverityScore;
        /** Emitted as a nested JSON object, not an escaped string. */
        @com.fasterxml.jackson.annotation.JsonRawValue
        private String aiAnalysis;
        private String progressNote;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class CreateShelterRequest {
        @NotBlank private String name;
        @NotBlank private String address;
        @NotNull private Double latitude;
        @NotNull private Double longitude;
        @NotNull @Min(1) private Integer capacity;
        private Integer currentOccupancy;
        private String contactPhone;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class VolunteerLocationRequest {
        @NotNull private Double latitude;
        @NotNull private Double longitude;
        @NotNull private Boolean available;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class DashboardStats {
        private long totalIncidents;
        private long activeIncidents;
        private long resolvedToday;
        private long criticalIncidents;
        private long availableVolunteers;
        private long totalShelters;
        private long totalShelterCapacity;
        private long currentOccupancy;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class AlertRequest {
        @NotBlank private String title;
        @NotBlank private String message;
        @NotNull private Severity severity;
    }
}
