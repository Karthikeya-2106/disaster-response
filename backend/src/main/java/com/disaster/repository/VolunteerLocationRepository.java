package com.disaster.repository;

import com.disaster.entity.VolunteerLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface VolunteerLocationRepository extends JpaRepository<VolunteerLocation, Long> {
    List<VolunteerLocation> findByAvailableTrue();
}
