package com.disaster.config;

import com.disaster.entity.Incident;
import com.disaster.entity.Shelter;
import com.disaster.entity.User;
import com.disaster.enums.*;
import com.disaster.repository.IncidentRepository;
import com.disaster.repository.ShelterRepository;
import com.disaster.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepo;
    private final ShelterRepository shelterRepo;
    private final IncidentRepository incidentRepo;
    private final PasswordEncoder encoder;

    @Override
    public void run(String... args) {
        if (userRepo.count() == 0) {
            log.info("Seeding initial data...");
            // Default users
            userRepo.save(User.builder()
                    .email("admin@disaster.com").password(encoder.encode("admin123"))
                    .fullName("System Admin").role(Role.ADMIN).enabled(true).build());
            userRepo.save(User.builder()
                    .email("volunteer@disaster.com").password(encoder.encode("vol123"))
                    .fullName("Sample Volunteer").role(Role.VOLUNTEER).enabled(true).build());
            userRepo.save(User.builder()
                    .email("citizen@disaster.com").password(encoder.encode("cit123"))
                    .fullName("Sample Citizen").role(Role.CITIZEN).enabled(true).build());

            // Sample shelters (around Hyderabad)
            shelterRepo.saveAll(List.of(
                Shelter.builder().name("Central Relief Shelter").address("Hitech City, Hyderabad")
                        .latitude(17.4485).longitude(78.3908).capacity(500).currentOccupancy(120)
                        .contactPhone("+91-9876543210").active(true).build(),
                Shelter.builder().name("Government School Shelter").address("Banjara Hills, Hyderabad")
                        .latitude(17.4126).longitude(78.4392).capacity(300).currentOccupancy(75)
                        .contactPhone("+91-9876543211").active(true).build(),
                Shelter.builder().name("Community Center").address("Secunderabad, Hyderabad")
                        .latitude(17.4399).longitude(78.4983).capacity(200).currentOccupancy(40)
                        .contactPhone("+91-9876543212").active(true).build()
            ));

            // Sample incidents
            incidentRepo.saveAll(List.of(
                Incident.builder().title("Heavy waterlogging on main road")
                        .description("Severe flooding after heavy rains. Vehicles stranded.")
                        .disasterType(DisasterType.FLOOD).severity(Severity.HIGH)
                        .status(IncidentStatus.REPORTED)
                        .latitude(17.4500).longitude(78.3800)
                        .address("Madhapur, Hyderabad")
                        .reporterId(3L).reporterName("citizen@disaster.com")
                        .aiSeverityScore(0.72).build(),
                Incident.builder().title("Building fire reported")
                        .description("Small fire on second floor of residential building.")
                        .disasterType(DisasterType.FIRE).severity(Severity.CRITICAL)
                        .status(IncidentStatus.IN_PROGRESS)
                        .latitude(17.4180).longitude(78.4400)
                        .address("Banjara Hills, Hyderabad")
                        .reporterId(3L).reporterName("citizen@disaster.com")
                        .assignedVolunteerId(2L).assignedVolunteerName("Sample Volunteer")
                        .aiSeverityScore(0.91).build()
            ));
            log.info("Seed data loaded. Login: admin@disaster.com/admin123, volunteer@disaster.com/vol123, citizen@disaster.com/cit123");
        }
    }
}
