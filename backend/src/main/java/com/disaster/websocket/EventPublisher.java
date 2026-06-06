package com.disaster.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import java.util.Map;

/**
 * Pushes events to WebSocket subscribers. In a multi-instance deployment
 * you'd back this with Redis pub/sub, but a single instance can fan out
 * directly through Spring's in-memory broker.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EventPublisher {

    private final SimpMessagingTemplate stomp;

    @Async
    public void incidentCreated(Object payload) {
        stomp.convertAndSend("/topic/incidents",
                Map.of("type", "INCIDENT_CREATED", "payload", payload));
        log.debug("Published INCIDENT_CREATED");
    }

    @Async
    public void incidentUpdated(Object payload) {
        stomp.convertAndSend("/topic/incidents",
                Map.of("type", "INCIDENT_UPDATED", "payload", payload));
    }

    @Async
    public void volunteerLocation(Object payload) {
        stomp.convertAndSend("/topic/volunteers",
                Map.of("type", "VOLUNTEER_LOCATION", "payload", payload));
    }

    @Async
    public void emergencyAlert(Object payload) {
        stomp.convertAndSend("/topic/alerts",
                Map.of("type", "EMERGENCY_ALERT", "payload", payload));
    }
}
