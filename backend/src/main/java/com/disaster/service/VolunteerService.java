package com.disaster.service;

import com.disaster.dto.AppDtos.VolunteerLocationRequest;
import com.disaster.entity.VolunteerLocation;
import com.disaster.repository.VolunteerLocationRepository;
import com.disaster.security.UserPrincipal;
import com.disaster.websocket.EventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class VolunteerService {

    private final VolunteerLocationRepository repo;
    private final EventPublisher publisher;

    @Transactional
    public VolunteerLocation updateLocation(UserPrincipal user, VolunteerLocationRequest req) {
        VolunteerLocation loc = repo.findById(user.getUserId())
                .orElse(VolunteerLocation.builder().volunteerId(user.getUserId()).build());
        loc.setVolunteerName(user.getEmail());
        loc.setLatitude(req.getLatitude());
        loc.setLongitude(req.getLongitude());
        loc.setAvailable(req.getAvailable());
        VolunteerLocation saved = repo.save(loc);
        publisher.volunteerLocation(saved);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<VolunteerLocation> findAvailable() { return repo.findByAvailableTrue(); }

    @Transactional(readOnly = true)
    public List<VolunteerLocation> findAll() { return repo.findAll(); }

    public long countAvailable() { return repo.findByAvailableTrue().size(); }
}
