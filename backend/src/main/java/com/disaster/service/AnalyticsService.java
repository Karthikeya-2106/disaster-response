package com.disaster.service;

import com.disaster.entity.Incident;
import com.disaster.enums.DisasterType;
import com.disaster.enums.IncidentStatus;
import com.disaster.enums.Severity;
import com.disaster.repository.IncidentRepository;
import com.disaster.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final IncidentRepository incidentRepo;
    private final UserRepository userRepo;

    public Map<String, Object> getDashboardAnalytics() {
        List<Incident> all = incidentRepo.findAll();

        // Daily trends - last 14 days
        List<Map<String, Object>> dailyTrends = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMM dd");
        for (int i = 13; i >= 0; i--) {
            LocalDate date = now.minusDays(i).toLocalDate();
            long count = all.stream()
                    .filter(inc -> inc.getCreatedAt().toLocalDate().isEqual(date))
                    .count();
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("date", date.format(fmt));
            point.put("incidents", count);
            dailyTrends.add(point);
        }

        // Severity distribution
        List<Map<String, Object>> severityDist = new ArrayList<>();
        for (Severity s : Severity.values()) {
            long count = all.stream().filter(i -> i.getSeverity() == s).count();
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("name", s.name());
            entry.put("value", count);
            severityDist.add(entry);
        }

        // Disaster type distribution
        List<Map<String, Object>> typeDist = new ArrayList<>();
        for (DisasterType t : DisasterType.values()) {
            long count = all.stream().filter(i -> i.getDisasterType() == t).count();
            if (count > 0) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("name", t.name());
                entry.put("count", count);
                typeDist.add(entry);
            }
        }

        // Status distribution
        List<Map<String, Object>> statusDist = new ArrayList<>();
        for (IncidentStatus s : IncidentStatus.values()) {
            long count = all.stream().filter(i -> i.getStatus() == s).count();
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("name", s.name().replace("_", " "));
            entry.put("value", count);
            statusDist.add(entry);
        }

        // Average response time (reported -> resolved), in hours
        OptionalDouble avgResponseHours = all.stream()
                .filter(i -> i.getStatus() == IncidentStatus.RESOLVED && i.getUpdatedAt() != null)
                .mapToLong(i -> ChronoUnit.HOURS.between(i.getCreatedAt(), i.getUpdatedAt()))
                .average();

        // Resolution rate
        long total = all.size();
        long resolved = all.stream().filter(i -> i.getStatus() == IncidentStatus.RESOLVED).count();
        double resolutionRate = total > 0 ? Math.round((resolved * 100.0 / total) * 10.0) / 10.0 : 0.0;

        // Critical incidents still active
        long criticalActive = all.stream()
                .filter(i -> i.getSeverity() == Severity.CRITICAL
                        && i.getStatus() != IncidentStatus.RESOLVED
                        && i.getStatus() != IncidentStatus.CANCELLED)
                .count();

        // Incidents this week vs last week
        LocalDate weekStart = LocalDate.now().minusDays(6);
        LocalDate prevWeekStart = LocalDate.now().minusDays(13);
        long thisWeek = all.stream()
                .filter(i -> !i.getCreatedAt().toLocalDate().isBefore(weekStart))
                .count();
        long lastWeek = all.stream()
                .filter(i -> !i.getCreatedAt().toLocalDate().isBefore(prevWeekStart)
                        && i.getCreatedAt().toLocalDate().isBefore(weekStart))
                .count();

        // Top reporters (volunteer leaderboard by resolved count)
        Map<String, Long> resolvedByVolunteer = all.stream()
                .filter(i -> i.getStatus() == IncidentStatus.RESOLVED && i.getAssignedVolunteerName() != null)
                .collect(Collectors.groupingBy(i -> i.getAssignedVolunteerName(), Collectors.counting()));
        List<Map<String, Object>> leaderboard = resolvedByVolunteer.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", e.getKey());
                    m.put("resolved", e.getValue());
                    return m;
                })
                .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("dailyTrends", dailyTrends);
        result.put("severityDistribution", severityDist);
        result.put("typeDistribution", typeDist);
        result.put("statusDistribution", statusDist);
        result.put("avgResponseHours", Math.round(avgResponseHours.orElse(0) * 10.0) / 10.0);
        result.put("resolutionRate", resolutionRate);
        result.put("criticalActive", criticalActive);
        result.put("totalIncidents", total);
        result.put("resolvedIncidents", resolved);
        result.put("thisWeekCount", thisWeek);
        result.put("lastWeekCount", lastWeek);
        result.put("volunteerLeaderboard", leaderboard);
        return result;
    }
}
