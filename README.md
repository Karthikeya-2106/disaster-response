# 🚨 Real-Time Disaster Response Coordination System

A full-stack platform for coordinating disaster response: citizens report incidents, volunteers accept rescue tasks, and admins monitor everything live on an interactive map.

**Tech stack:** Spring Boot 3.3 · Java 21 · React 18 · Vite · Tailwind · Leaflet · PostgreSQL · WebSocket (STOMP) · JWT · Docker

---

## ✨ Features

- **JWT authentication** with access + refresh tokens, BCrypt password hashing, role-based access (Citizen / Volunteer / Admin)
- **Citizen flow**: report incidents with geolocation + photo, view nearby shelters, track rescue status, receive emergency alerts
- **Volunteer flow**: see nearby incidents in real time, accept rescues, update progress, share live location
- **Admin flow**: real-time dashboard with stats, live incident map, volunteer assignment, shelter management, emergency broadcast
- **Real-time updates** via WebSocket (STOMP over SockJS) — new incidents and status changes appear instantly for all subscribers
- **AI severity estimation** stub that scores uploaded images 0–1 (pluggable for a real CNN/vision model later)
- **Interactive map** with color-coded incident markers, shelter markers, live volunteer pins, severity radius circles
- **Production-ready basics**: DTOs, service/repository pattern, global exception handler, audit logs, role-based authorization at method level, CORS, input validation, file upload validation, Spring Cache, request logging

---

## 🚀 Quick Start (Docker — recommended)

**Prerequisites:** Docker Desktop installed and running.

```bash
git clone <your-repo>     # or unzip the project folder
cd disaster-response
docker compose up --build
```

Wait ~2 minutes for the first build. When you see `Started DisasterApplication`, open:

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8080/api/health
- **Postgres:** localhost:5432 (user: `disaster`, password: `disaster123`)

### Demo accounts (auto-seeded on first boot)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@disaster.com` | `admin123` |
| Volunteer | `volunteer@disaster.com` | `vol123` |
| Citizen | `citizen@disaster.com` | `cit123` |

---

## 💻 Run Locally Without Docker (for development)

You'll need **Java 21**, **Maven**, and **Node 20+**.

### Backend
```bash
cd backend
mvn spring-boot:run
```
Uses the in-memory **H2 database** by default (profile `dev`) — no Postgres needed. App starts on http://localhost:8080. Visit http://localhost:8080/h2 to browse the DB (JDBC URL: `jdbc:h2:mem:disaster`, user `sa`, no password).

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Opens on http://localhost:3000 with Vite's hot reload. The dev server proxies `/api` and `/ws` to the backend.

---

## 📅 5-Day Execution Plan

| Day | Goal | What to do |
|-----|------|------------|
| **1** | Get it running | Install Docker + Java + Node. Run `docker compose up --build`. Verify all 3 demo accounts log in. Click through every screen. Read the code structure. |
| **2** | Customize | Change branding (colors in `tailwind.config.js`, app title in `index.html`). Update seed data in `DataInitializer.java` with shelters near your city. Test reporting an incident with a photo. |
| **3** | Demo prep | Open three browsers side by side (citizen/volunteer/admin). Practice the demo flow: citizen reports → admin sees instantly → admin assigns volunteer → volunteer updates → citizen sees status change. |
| **4** | Documentation | Take screenshots for your report. Write your project document. Use the API examples below for your "REST API" section. |
| **5** | Polish & submit | Fix any bugs you noticed. Generate the architecture diagram (paste this README into draw.io if helpful). Record a 3-min demo video. Submit. |

---

## 🎬 Demo Script (3 minutes)

1. **Open three browser windows side by side**, each logged in as a different role.
2. **Citizen window:** Click "Report Incident" → fill form → upload a photo → submit. Point out the AI severity score appearing after upload.
3. **Volunteer window:** A toast notification appears within ~1 second. The incident shows up in "Available Incidents". Click "Accept Rescue".
4. **Admin window:** The map updates live. The volunteer pin moves (purple). The incident card changes status to ASSIGNED.
5. **Volunteer window:** Click "Start" → "Resolve".
6. **Admin window:** Broadcast an emergency alert. All three browsers receive a red toast notification.

---

## 🏗️ Architecture

```
┌──────────────┐         ┌──────────────────────────────┐         ┌────────────┐
│              │  HTTP   │                              │   JDBC  │            │
│  React SPA   │ ──────► │   Spring Boot 3.3 backend    │ ──────► │ PostgreSQL │
│  (port 3000) │         │   (port 8080)                │         │            │
│              │ ◄────── │                              │         └────────────┘
└──────────────┘ WS/STOMP│  • REST API   /api/*         │
                         │  • WebSocket  /ws (SockJS)   │
                         │  • Static     /uploads/*     │
                         │                              │
                         │  Layers: Controller → Service│
                         │          → Repository → JPA  │
                         └──────────────────────────────┘
```

**Why monolith?** A microservices version was originally planned but was simplified to one Spring Boot app for buildability and to keep all the same features running on a laptop without container orchestration overhead. The package boundaries (`controller`, `service`, `repository`, `dto`, `entity`) are clean enough to split into separate services later — each entity could become its own bounded context.

---

## 🗂️ Project Structure

```
disaster-response/
├── backend/
│   ├── pom.xml
│   ├── Dockerfile
│   └── src/main/
│       ├── java/com/disaster/
│       │   ├── DisasterApplication.java
│       │   ├── config/          (Security, WebSocket, WebMvc, DataInitializer)
│       │   ├── controller/      (Auth, Incident, Shelter, Volunteer, Admin, Health)
│       │   ├── dto/             (AuthDtos, AppDtos)
│       │   ├── entity/          (User, Incident, Shelter, VolunteerLocation, RefreshToken, AuditLog)
│       │   ├── enums/           (Role, Severity, DisasterType, IncidentStatus)
│       │   ├── exception/       (AppException, GlobalExceptionHandler)
│       │   ├── repository/      (Spring Data JPA interfaces)
│       │   ├── security/        (JwtUtil, JwtAuthFilter, UserPrincipal)
│       │   ├── service/         (Auth, Incident, Shelter, Volunteer, AiSeverity, FileStorage)
│       │   └── websocket/       (EventPublisher)
│       └── resources/application.yml
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── Dockerfile, nginx.conf
│   └── src/
│       ├── main.jsx, App.jsx, index.css
│       ├── api/          (client.js, endpoints.js)
│       ├── components/   (Navbar, PrivateRoute, IncidentCard, IncidentMap)
│       ├── context/      (AuthContext)
│       ├── hooks/        (useWebSocket)
│       └── pages/        (Login, Signup, CitizenDashboard, ReportIncident,
│                          VolunteerDashboard, AdminDashboard, AdminVolunteers, MapView)
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 📡 API Reference

All endpoints under `/api`. JWT goes in `Authorization: Bearer <token>` header.

### Auth (public)

| Method | Path | Body |
|--------|------|------|
| POST | `/api/auth/signup` | `{ email, password, fullName, phone, role }` |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/refresh` | `{ refreshToken }` |

### Incidents

| Method | Path | Roles |
|--------|------|-------|
| POST | `/api/incidents` | All authenticated |
| POST | `/api/incidents/upload-image` (multipart) | All authenticated |
| GET | `/api/incidents` | All authenticated |
| GET | `/api/incidents/active` | All authenticated |
| GET | `/api/incidents/nearby?lat=&lng=&radiusKm=` | All authenticated |
| GET | `/api/incidents/severity/{CRITICAL\|HIGH\|MEDIUM\|LOW}` | All authenticated |
| GET | `/api/incidents/my-reports` | Citizen |
| GET | `/api/incidents/assigned-to-me` | Volunteer |
| GET | `/api/incidents/{id}` | All authenticated |
| PATCH | `/api/incidents/{id}/status` | Volunteer/Admin |
| POST | `/api/incidents/{id}/assign` | Admin |
| POST | `/api/incidents/{id}/accept` | Volunteer |

### Shelters

| Method | Path | Roles |
|--------|------|-------|
| GET | `/api/shelters` | All authenticated |
| GET | `/api/shelters/nearby?lat=&lng=&radiusKm=` | All authenticated |
| POST | `/api/shelters` | Admin |
| PUT | `/api/shelters/{id}` | Admin |
| DELETE | `/api/shelters/{id}` | Admin |

### Volunteers

| Method | Path | Roles |
|--------|------|-------|
| POST | `/api/volunteers/location` | Volunteer |
| GET | `/api/volunteers/available` | Admin/Volunteer |
| GET | `/api/volunteers` | Admin |

### Admin

| Method | Path | Roles |
|--------|------|-------|
| GET | `/api/admin/stats` | Admin |
| GET | `/api/admin/volunteers` | Admin |
| POST | `/api/admin/broadcast-alert` | Admin |

### WebSocket Topics (STOMP)

Connect to `/ws` with `?token=<jwt>` and subscribe to:

- `/topic/incidents` — incident created / updated events
- `/topic/volunteers` — volunteer location updates
- `/topic/alerts` — emergency broadcasts

---

## 🧪 Sample API Requests (Postman / curl)

```bash
# 1. Login as admin
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@disaster.com","password":"admin123"}'

# Response gives you accessToken — copy it.
export TOKEN="paste_accessToken_here"

# 2. Create an incident
curl -X POST http://localhost:8080/api/incidents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Flooding on highway",
    "description": "Heavy water on NH-44 near exit 12",
    "disasterType": "FLOOD",
    "severity": "HIGH",
    "latitude": 17.4485,
    "longitude": 78.3908,
    "address": "NH-44, Hyderabad"
  }'

# 3. Get active incidents
curl http://localhost:8080/api/incidents/active \
  -H "Authorization: Bearer $TOKEN"

# 4. Broadcast alert (admin only)
curl -X POST http://localhost:8080/api/admin/broadcast-alert \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Cyclone warning","message":"Evacuate coastal areas","severity":"CRITICAL"}'

# 5. Upload image (returns URL + AI score)
curl -X POST http://localhost:8080/api/incidents/upload-image \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./photo.jpg" \
  -F "severity=HIGH"
```

---

## 🗄️ Database Schema (auto-created by JPA)

```sql
users(id, email UNIQUE, password, full_name, phone, role, enabled, created_at)
refresh_tokens(id, token UNIQUE, user_id, expiry_date)
incidents(id, title, description, disaster_type, severity, status,
          latitude, longitude, address, image_url, reporter_id, reporter_name,
          assigned_volunteer_id, assigned_volunteer_name, ai_severity_score,
          progress_note, created_at, updated_at)
shelters(id, name, address, latitude, longitude, capacity, current_occupancy,
         contact_phone, active)
volunteer_locations(volunteer_id PK, volunteer_name, latitude, longitude,
                    available, updated_at)
audit_logs(id, actor_id, actor_role, action, entity_type, entity_id, details, timestamp)
```

Indices on `incidents(status)`, `incidents(severity)`, `incidents(created_at)`.

---

## 🛠️ Troubleshooting

**`docker compose up` fails with "port already in use"**
Something else is using 3000/5432/8080. Find and kill it, or change the host port in `docker-compose.yml` (e.g. `"3001:80"`).

**Backend container restarts repeatedly**
Postgres usually wasn't ready yet. Wait 30s — the `depends_on: service_healthy` handles this but cold-start can be slow. Check `docker compose logs backend`.

**"CORS error" in browser console**
You're hitting backend (`:8080`) from frontend (`:3000`) without the proxy. Make sure you run frontend via `npm run dev` (uses Vite proxy) or via Docker (uses nginx proxy). Don't open `index.html` directly.

**WebSocket disconnects immediately**
The JWT secret on the backend differs from when you logged in (e.g. you regenerated `.env`). Log out and log back in.

**Leaflet markers don't appear**
Check the browser console. Most likely `npm install` didn't finish — re-run `npm install` in `frontend/`. The Leaflet icon fix is already in `main.jsx`.

**Maven build fails: "release version 21 not supported"**
You're using an older JDK. Install JDK 21 (e.g. via SDKMAN: `sdk install java 21-tem`).

**`npm install` errors on Windows**
Try `npm install --legacy-peer-deps`. If you get `gyp` errors, install Windows Build Tools or use Docker instead.

**H2 console at /h2 shows "Whitelabel error page"**
You're on the `prod` profile. The H2 console is only enabled on `dev`. Run with `mvn spring-boot:run` (defaults to `dev`).

---

## 🔒 Security Notes

- Passwords hashed with **BCrypt** (10 rounds default).
- JWTs signed with **HMAC-SHA256**. The default secret in this repo is **for demo only** — generate a new one for any real use (`openssl rand -base64 64`) and set it via `JWT_SECRET` env var.
- All endpoints except `/api/auth/**`, `/api/health`, `/uploads/**`, `/ws/**` require authentication.
- Method-level `@PreAuthorize` enforces role boundaries (citizen can't assign volunteers, etc).
- File uploads validated: only JPEG/PNG/WEBP, max 10MB.
- CORS is wide-open by default for local development — tighten `corsSource()` in `SecurityConfig.java` for production.

---

## 🧠 The "AI" Severity Score

`AiSeverityService.estimate()` currently uses a deterministic hash of image bytes mixed with the reported severity to give a stable 0–1 score for demo purposes. To plug in a real model:

1. Add a Python service that wraps a vision model (e.g. a CNN trained on disaster imagery, or a vision LLM API).
2. Replace the body of `estimate()` with an HTTP call to that service.

The rest of the code already stores the score, displays it in the UI, and includes it in the WebSocket payload — no other changes needed.

---

## 🎯 What's Intentionally Out of Scope

Originally a 5-service microservice version was planned (gateway / auth / incident / notification / volunteer) with Kafka and MongoDB and Redis. This was descoped to a single Spring Boot service so it builds in one command and runs on a 4GB laptop. Every functional feature from the original spec is present; only the operational complexity was removed. The package layout would let you split it into microservices later by extracting each `controller + service + repository` triple into its own Spring Boot module.

Not included (intentionally) for the 5-day timebox:
- Kafka / message broker — replaced by the in-memory STOMP broker
- Marker clustering plugin — Leaflet works fine for under a few hundred markers
- Offline data sync — would need a PWA service worker + IndexedDB layer
- Distributed rate limiting — single-instance app uses Spring's request limiting only if added; production deployment should use an API gateway (nginx limit_req or Spring Cloud Gateway)
- Full Swagger UI — endpoint list is in this README; add `springdoc-openapi-starter-webmvc-ui` to `pom.xml` if you want interactive docs

---

## 📝 License

MIT — use, modify, learn from it.
