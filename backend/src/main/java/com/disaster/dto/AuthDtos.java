package com.disaster.dto;

import com.disaster.enums.Role;
import jakarta.validation.constraints.*;
import lombok.*;

public class AuthDtos {

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class SignupRequest {
        @NotBlank @Email private String email;
        @NotBlank @Size(min = 6, max = 100) private String password;
        @NotBlank private String fullName;
        private String phone;
        @NotNull private Role role;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class LoginRequest {
        @NotBlank @Email private String email;
        @NotBlank private String password;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class RefreshRequest {
        @NotBlank private String refreshToken;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AuthResponse {
        private String accessToken;
        private String refreshToken;
        private Long userId;
        private String email;
        private String fullName;
        private Role role;
    }
}
