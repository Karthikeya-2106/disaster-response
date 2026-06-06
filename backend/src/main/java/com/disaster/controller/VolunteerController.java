package com.disaster.controller;

import com.disaster.dto.AppDtos.VolunteerLocationRequest;
import com.disaster.entity.VolunteerLocation;
import com.disaster.security.UserPrincipal;
import com.disaster.service.VolunteerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/volunteers")
@RequiredArgsConstructor
public class VolunteerController {

    private final VolunteerService service;

    @PostMapping("/location")
    @PreAuthorize("hasRole('VOLUNTEER')")
    public ResponseEntity<VolunteerLocation> updateLocation(
            @Valid @RequestBody VolunteerLocationRequest req,
            @AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(service.updateLocation(user, req));
    }

    @GetMapping("/available")
    @PreAuthorize("hasAnyRole('ADMIN','VOLUNTEER')")
    public ResponseEntity<List<VolunteerLocation>> available() {
        return ResponseEntity.ok(service.findAvailable());
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<VolunteerLocation>> all() {
        return ResponseEntity.ok(service.findAll());
    }
}
