package com.disaster.service;

import com.disaster.dto.AiDtos.VisionAssessment;
import com.disaster.enums.Severity;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Runs photo assessments in the background so an emergency report never waits on AI.
 *
 * <p>Measured on a CPU-only laptop, one photo takes 130–170 s on a local vision model. With
 * analysis inline, the photo's URL only reached the report form after the model finished — so
 * a citizen pressing Submit in the meantime filed the incident <em>without</em> the photo.
 * Now the upload returns at once; the form polls {@link #lookup} for the result; and if the
 * incident was filed first, the finished analysis is attached to it and pushed live to the
 * dashboards.
 *
 * <p>A finished analysis lives in a sidecar file beside the image (the source of truth, and it
 * survives restarts). Only in-flight and failed states are held in memory.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PhotoAnalysisService {

    public enum Status { PENDING, DONE, UNAVAILABLE }

    public record Lookup(Status status, Double score, String analysisJson) {}

    private final AiVisionService vision;
    private final FileStorageService storage;
    private final IncidentService incidents;
    private final ObjectMapper mapper;

    /** In-flight and failed uploads only; DONE is read from the sidecar. Bounded so it can't grow forever. */
    private final Map<String, Status> states = Collections.synchronizedMap(new LinkedHashMap<>(64, 0.75f, false) {
        @Override protected boolean removeEldestEntry(Map.Entry<String, Status> e) { return size() > 1000; }
    });

    /**
     * One worker: a local model on CPU processes one image at a time anyway, and parallel
     * requests only fight over RAM. The queue absorbs a burst of reports during a disaster;
     * beyond it, photos simply go unassessed rather than stalling the server.
     */
    private final ThreadPoolExecutor worker = new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(50), r -> {
                Thread t = new Thread(r, "photo-analysis");
                t.setDaemon(true);
                return t;
            });

    /** Queues an assessment. Returns PENDING, or UNAVAILABLE when AI is off / type unsupported / queue full. */
    public Status submit(String imageUrl, byte[] bytes, String contentType, Severity reported, String description) {
        if (!vision.canAssess(contentType)) return Status.UNAVAILABLE;
        states.put(imageUrl, Status.PENDING);
        try {
            worker.execute(() -> analyse(imageUrl, bytes, contentType, reported, description));
            return Status.PENDING;
        } catch (RejectedExecutionException e) {
            log.warn("Photo analysis queue full; {} will not be assessed", imageUrl);
            states.put(imageUrl, Status.UNAVAILABLE);
            return Status.UNAVAILABLE;
        }
    }

    public Lookup lookup(String imageUrl) {
        Optional<String> sidecar = storage.readSidecar(imageUrl);
        if (sidecar.isPresent()) {
            return new Lookup(Status.DONE, scoreOf(sidecar.get()), sidecar.get());
        }
        Status s = states.get(imageUrl);
        return new Lookup(s == Status.PENDING ? Status.PENDING : Status.UNAVAILABLE, null, null);
    }

    private void analyse(String imageUrl, byte[] bytes, String contentType, Severity reported, String description) {
        long started = System.currentTimeMillis();
        try {
            Optional<VisionAssessment> result = vision.assess(bytes, contentType, reported, description);
            if (result.isEmpty()) {
                states.put(imageUrl, Status.UNAVAILABLE);
                return;
            }
            String json = mapper.writeValueAsString(result.get());
            // Order matters: write the sidecar BEFORE looking for incidents to update. Incident
            // creation saves first and then re-reads the sidecar, so whichever side runs second
            // always sees the other's write — no analysis can fall between the two.
            storage.saveSidecar(imageUrl, json);
            states.remove(imageUrl);
            incidents.attachAiAnalysis(imageUrl, result.get().severityScore(), json);
            log.info("Photo analysis for {} finished in {} s ({})", imageUrl,
                    (System.currentTimeMillis() - started) / 1000, result.get().severityLabel());
        } catch (Exception e) {
            log.warn("Photo analysis for {} failed: {}", imageUrl, e.toString());
            states.put(imageUrl, Status.UNAVAILABLE);
        }
    }

    private Double scoreOf(String json) {
        try {
            return mapper.readTree(json).path("severityScore").asDouble();
        } catch (Exception e) {
            return null;
        }
    }

    @PreDestroy
    void shutdown() {
        worker.shutdownNow();
    }
}
