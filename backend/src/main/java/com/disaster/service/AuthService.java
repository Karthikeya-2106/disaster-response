package com.disaster.service;

import com.disaster.dto.AuthDtos.*;
import com.disaster.entity.RefreshToken;
import com.disaster.entity.User;
import com.disaster.exception.AppException;
import com.disaster.repository.RefreshTokenRepository;
import com.disaster.repository.UserRepository;
import com.disaster.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepo;
    private final RefreshTokenRepository refreshRepo;
    private final PasswordEncoder encoder;
    private final JwtUtil jwt;

    @Value("${jwt.refresh-expiration}") private long refreshExpiration;

    @Transactional
    public AuthResponse signup(SignupRequest req) {
        if (userRepo.existsByEmail(req.getEmail()))
            throw new AppException("Email already registered", 409);
        User u = User.builder()
                .email(req.getEmail())
                .password(encoder.encode(req.getPassword()))
                .fullName(req.getFullName())
                .phone(req.getPhone())
                .role(req.getRole())
                .enabled(true)
                .build();
        return buildResponse(userRepo.save(u));
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        User u = userRepo.findByEmail(req.getEmail())
                .orElseThrow(() -> new AppException("Invalid credentials", 401));
        if (!encoder.matches(req.getPassword(), u.getPassword()))
            throw new AppException("Invalid credentials", 401);
        if (!u.isEnabled()) throw new AppException("Account disabled", 403);
        refreshRepo.deleteByUserId(u.getId());
        return buildResponse(u);
    }

    @Transactional
    public AuthResponse refresh(String token) {
        RefreshToken rt = refreshRepo.findByToken(token)
                .orElseThrow(() -> new AppException("Invalid refresh token", 401));
        if (rt.getExpiryDate().isBefore(LocalDateTime.now())) {
            refreshRepo.delete(rt);
            throw new AppException("Refresh token expired", 401);
        }
        User u = userRepo.findById(rt.getUserId())
                .orElseThrow(() -> new AppException("User not found", 404));
        refreshRepo.delete(rt);
        return buildResponse(u);
    }

    private AuthResponse buildResponse(User u) {
        String access = jwt.generateAccessToken(u.getId(), u.getEmail(), u.getRole());
        String refresh = UUID.randomUUID() + "-" + UUID.randomUUID();
        refreshRepo.save(RefreshToken.builder()
                .token(refresh).userId(u.getId())
                .expiryDate(LocalDateTime.now().plusSeconds(refreshExpiration / 1000))
                .build());
        return AuthResponse.builder()
                .accessToken(access).refreshToken(refresh)
                .userId(u.getId()).email(u.getEmail())
                .fullName(u.getFullName()).role(u.getRole())
                .build();
    }
}
