package com.disaster.service;

import com.disaster.exception.AppException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.*;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class FileStorageService {

    @Value("${app.upload-dir}") private String uploadDir;

    private static final List<String> ALLOWED = List.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_SIZE = 10L * 1024 * 1024;

    @PostConstruct
    public void init() throws IOException { Files.createDirectories(Paths.get(uploadDir)); }

    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new AppException("File is empty", 400);
        if (file.getSize() > MAX_SIZE) throw new AppException("File too large (max 10MB)", 400);
        if (!ALLOWED.contains(file.getContentType()))
            throw new AppException("Only JPEG/PNG/WEBP allowed", 400);
        try {
            String ext = "";
            String orig = file.getOriginalFilename();
            if (orig != null && orig.contains(".")) ext = orig.substring(orig.lastIndexOf('.'));
            String filename = UUID.randomUUID() + ext;
            Path target = Paths.get(uploadDir).resolve(filename);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return "/uploads/" + filename;
        } catch (IOException e) {
            log.error("Upload failed", e);
            throw new AppException("Upload failed", 500);
        }
    }

    public byte[] bytes(MultipartFile file) {
        try { return file.getBytes(); } catch (IOException e) { return new byte[0]; }
    }

    /** Only URLs this service itself minted — blocks path traversal via client-supplied imageUrl. */
    private static final Pattern OWN_URL = Pattern.compile("^/uploads/([0-9a-f\\-]{36}\\.(?:jpe?g|png|webp|gif))$",
            Pattern.CASE_INSENSITIVE);

    /** Store the AI analysis beside the image so incident creation can pick it up server-side. */
    public void saveSidecar(String imageUrl, String json) {
        Path p = sidecarPath(imageUrl);
        if (p == null) return;
        try {
            Files.writeString(p, json);
        } catch (IOException e) {
            log.warn("Could not write AI sidecar for {}: {}", imageUrl, e.toString());
        }
    }

    public Optional<String> readSidecar(String imageUrl) {
        Path p = sidecarPath(imageUrl);
        if (p == null || !Files.exists(p)) return Optional.empty();
        try {
            return Optional.of(Files.readString(p));
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    private Path sidecarPath(String imageUrl) {
        if (imageUrl == null) return null;
        Matcher m = OWN_URL.matcher(imageUrl);
        if (!m.matches()) return null;
        return Paths.get(uploadDir).resolve(m.group(1) + ".ai.json");
    }
}
