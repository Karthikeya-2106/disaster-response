# ---- build ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Cache dependencies separately from source so code edits don't re-download the world
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q -DskipTests package

# ---- run ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app
COPY --from=build /build/target/disaster-response-1.0.0.jar app.jar

RUN mkdir -p /app/uploads && chown -R app:app /app
USER app

ENV SERVER_PORT=8081 \
    UPLOAD_DIR=/app/uploads
EXPOSE 8081

HEALTHCHECK --interval=15s --timeout=3s --start-period=60s --retries=5 \
  CMD wget -qO- http://localhost:8081/api/health || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
