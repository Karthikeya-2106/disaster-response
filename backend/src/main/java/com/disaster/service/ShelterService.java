package com.disaster.service;

import com.disaster.dto.AppDtos.CreateShelterRequest;
import com.disaster.entity.Shelter;
import com.disaster.exception.AppException;
import com.disaster.repository.ShelterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ShelterService {

    private final ShelterRepository repo;

    @Transactional(readOnly = true)
    public List<Shelter> findAll() { return repo.findByActiveTrue(); }

    @Transactional(readOnly = true)
    public List<Shelter> findNearby(double lat, double lng, double radiusKm) {
        return repo.findNearby(lat, lng, radiusKm);
    }

    @Transactional
    public Shelter create(CreateShelterRequest req) {
        return repo.save(Shelter.builder()
                .name(req.getName()).address(req.getAddress())
                .latitude(req.getLatitude()).longitude(req.getLongitude())
                .capacity(req.getCapacity())
                .currentOccupancy(req.getCurrentOccupancy() == null ? 0 : req.getCurrentOccupancy())
                .contactPhone(req.getContactPhone()).active(true).build());
    }

    @Transactional
    public Shelter update(Long id, CreateShelterRequest req) {
        Shelter s = repo.findById(id).orElseThrow(() -> new AppException("Shelter not found", 404));
        s.setName(req.getName()); s.setAddress(req.getAddress());
        s.setLatitude(req.getLatitude()); s.setLongitude(req.getLongitude());
        s.setCapacity(req.getCapacity());
        if (req.getCurrentOccupancy() != null) s.setCurrentOccupancy(req.getCurrentOccupancy());
        s.setContactPhone(req.getContactPhone());
        return repo.save(s);
    }

    @Transactional
    public void delete(Long id) {
        Shelter s = repo.findById(id).orElseThrow(() -> new AppException("Shelter not found", 404));
        s.setActive(false);
        repo.save(s);
    }

    public long totalCapacity() {
        return repo.findByActiveTrue().stream().mapToLong(Shelter::getCapacity).sum();
    }

    public long totalOccupancy() {
        return repo.findByActiveTrue().stream().mapToLong(Shelter::getCurrentOccupancy).sum();
    }
}
