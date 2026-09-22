# 🚨 Real-Time Disaster Response Coordination System

A full-stack platform for coordinating disaster response: citizens report incidents, volunteers accept rescue tasks, and admins monitor everything live on an interactive map.

**Tech stack:** Spring Boot 3.3 · Java 21 · React 18 · Vite · Tailwind · Leaflet · PostgreSQL · WebSocket (STOMP) · JWT · Docker · Gemini / Ollama (free multimodal AI)

---

## ✨ Features

- **JWT authentication** with access + refresh tokens, BCrypt password hashing, role-based access (Citizen / Volunteer / Admin)
- **Citizen flow**: report incidents with geolocation + photo, view nearby shelters, track rescue status, receive emergency alerts
- **Volunteer flow**: see nearby incidents in real time, accept rescues, update progress, share live location
- **Admin flow**: real-time dashboard with stats, live incident map, volunteer assignment, shelter management, emergency broadcast
- **Real-time updates** via WebSocket (STOMP over SockJS) — new incidents and status changes appear instantly for all subscribers
- **AI vision triage** on free providers (Gemini free tier or local Ollama): reads incident photos, detects duplicate reports, and plans volunteer dispatch — with heuristic fallbacks so it runs with no AI at all
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
- **Backend API:** http://localhost:8081/api/health
- **Postgres:** localhost:5432 (user: `disaster`, password: `disaster123`)

All ports, the database credentials and the JWT secret have working defaults, so no
`.env` file is required. To override any of them, `cp .env.example .env` and edit it.

### Demo accounts (auto-seeded on first boot)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@disaster.com` | `admin123` |
| Volunteer | `volunteer@disaster.com` | `vol123` |
| Citizen | `citizen@disaster.com` | `cit123` |

---

## 💻 Run Locally Without Docker (for development)

You'll need **Java 21**, **Maven**, and **Node 20+**.

On Windows you can start both at once with `./run.ps1`. Otherwise:

### Backend
```bash
cd backend
mvn spring-boot:run
```
Uses the in-memory **H2 database** by default (profile `dev`) — no Postgres needed. App starts on http://localhost:8081. Visit http://localhost:8081/h2 to browse the DB (JDBC URL: `jdbc:h2:mem:disaster`, user `sa`, no password).

Set `SERVER_PORT` to run on a different port — remember to update the proxy targets in `frontend/vite.config.js` to match.

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
2. **Citizen window:** Click "Report Incident" → fill form → upload a photo → submit right away (no need to wait). With AI on, the **"What the AI sees in your photo"** panel appears when the check finishes — seconds on Gemini, a couple of minutes on a CPU-only Ollama box — and the same analysis shows up on the admin and volunteer incident cards live.
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
│  (port 3000) │         │   (port 8081)                │         │            │
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
│       │   ├── ai/              (AiClient — Gemini/Ollama/none, JsonSchemas, ImagePrep)
│       │   ├── config/          (Security, WebSocket, WebMvc, DataInitializer)
│       │   ├── controller/      (Auth, Incident, Shelter, Volunteer, Admin, Health,
│       │   │                     Analytics, AiChat, AiTriage)
│       │   ├── dto/             (AuthDtos, AppDtos, AiDtos)
│       │   ├── entity/          (User, Incident, Shelter, VolunteerLocation, RefreshToken,
│       │   │                     AuditLog, IncidentTimelineEntry)
│       │   ├── enums/           (Role, Severity, DisasterType, IncidentStatus)
│       │   ├── exception/       (AppException, GlobalExceptionHandler)
│       │   ├── repository/      (Spring Data JPA interfaces)
│       │   ├── security/        (JwtUtil, JwtAuthFilter, UserPrincipal)
│       │   ├── service/         (Auth, Incident, Shelter, Volunteer, FileStorage,
│       │   │                     Analytics, AiChat, AiVision, AiTriage, PhotoAnalysis)
│       │   └── websocket/       (EventPublisher)
│       └── resources/application.yml
│   └── src/test/java/com/disaster/  (ImagePrepTest, AiVisionServiceTest)
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── Dockerfile, nginx.conf
│   └── src/
│       ├── main.jsx, App.jsx, index.css
│       ├── api/          (client.js, endpoints.js)
│       ├── components/   (Navbar, PrivateRoute, IncidentCard, IncidentMap,
│       │                  IncidentTimeline, AddressSearch, AiEmergencyChat,
│       │                  NotificationCenter, AiDispatchPanel)
│       ├── context/      (AuthContext)
│       ├── hooks/        (useWebSocket)
│       └── pages/        (Login, Signup, CitizenDashboard, ReportIncident,
│                          VolunteerDashboard, AdminDashboard, AdminVolunteers, MapView,
│                          AnalyticsDashboard, IncidentNavigation)
├── docker-compose.yml
├── .env.example
├── run.ps1              (Windows: starts backend + frontend in two windows)
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
| POST | `/api/incidents/upload-image` (multipart: `file`, `severity`, optional `description`) | All authenticated |
| GET | `/api/incidents/image-analysis?url=` | All authenticated |
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

### Analytics

| Method | Path | Roles | Returns |
|--------|------|-------|---------|
| GET | `/api/analytics/dashboard` | All authenticated | 14-day incident trend, severity + type distribution, response stats |
| GET | `/api/analytics/incident/{id}/timeline` | All authenticated | Ordered status-change history for one incident |

### AI

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| GET | `/api/ai/status` | All authenticated | Which provider is live (`gemini` / `ollama` / `none`) and its model |
| POST | `/api/ai/chat` | All authenticated | Emergency guidance assistant |
| POST | `/api/ai/analyze-incident` | All authenticated | Text-only assessment of a draft report |
| GET | `/api/ai/triage/duplicates/{id}` | Admin/Volunteer | Is this report the same event as another active one nearby? |
| POST | `/api/ai/triage/dispatch` | Admin | Board-wide volunteer↔incident assignment plan (read-only; admin confirms) |

**Photo assessment is asynchronous.** `POST /api/incidents/upload-image` stores the photo and
returns immediately with `imageUrl` and `aiStatus` (`"pending"`, or `"unavailable"` when AI is
off). Poll `GET /api/incidents/image-analysis?url=<imageUrl>` until `status` is `"done"`
(with `aiAnalysis`) or `"unavailable"`. If the incident is filed first, the analysis is attached
to it when it finishes and an `INCIDENT_UPDATED` event goes out on `/topic/incidents`.

Every endpoint works with no AI configured — see [The AI layer](#-the-ai-layer).

### WebSocket Topics (STOMP)

Connect to `/ws` with `?token=<jwt>` and subscribe to:

- `/topic/incidents` — incident created / updated events
- `/topic/volunteers` — volunteer location updates
- `/topic/alerts` — emergency broadcasts

---

## 🧪 Sample API Requests (Postman / curl)

```bash
# 1. Login as admin
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@disaster.com","password":"admin123"}'

# Response gives you accessToken — copy it.
export TOKEN="paste_accessToken_here"

# 2. Create an incident
curl -X POST http://localhost:8081/api/incidents \
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
curl http://localhost:8081/api/incidents/active \
  -H "Authorization: Bearer $TOKEN"

# 4. Broadcast alert (admin only)
curl -X POST http://localhost:8081/api/admin/broadcast-alert \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Cyclone warning","message":"Evacuate coastal areas","severity":"CRITICAL"}'

# 5. Upload image — returns at once: {"imageUrl": "...", "aiStatus": "pending", ...}
curl -X POST http://localhost:8081/api/incidents/upload-image \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./photo.jpg" \
  -F "severity=HIGH" \
  -F "description=Street flooded, cars under water"

# 6. Poll for the photo assessment (seconds on Gemini, ~2-3 min on a CPU-only Ollama box)
curl "http://localhost:8081/api/incidents/image-analysis?url=/uploads/<uuid>.jpg" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🗄️ Database Schema (auto-created by JPA)

```sql
users(id, email UNIQUE, password, full_name, phone, role, enabled, created_at)
refresh_tokens(id, token UNIQUE, user_id, expiry_date)
incidents(id, title, description, disaster_type, severity, status,
          latitude, longitude, address, image_url, reporter_id, reporter_name,
          assigned_volunteer_id, assigned_volunteer_name, ai_severity_score,
          ai_analysis /* JSON vision assessment */, progress_note, created_at, updated_at)
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
Something else is using 3000/5432/8081. Either kill it, or copy `.env.example` to `.env` and change `FRONTEND_PORT` / `BACKEND_PORT` / `POSTGRES_PORT`.

**Backend container restarts repeatedly**
Postgres usually wasn't ready yet. Wait 30s — the `depends_on: service_healthy` handles this but cold-start can be slow. Check `docker compose logs backend`.

**"CORS error" in browser console**
You're hitting backend (`:8081`) from frontend (`:3000`) without the proxy. Make sure you run frontend via `npm run dev` (uses Vite proxy) or via Docker (uses nginx proxy). Don't open `index.html` directly.

**WebSocket disconnects immediately**
The JWT secret on the backend differs from when you logged in (e.g. you regenerated `.env`). Log out and log back in.

**Leaflet markers don't appear**
Check the browser console. Most likely `npm install` didn't finish — re-run `npm install` in `frontend/`. The Leaflet icon fix is already in `main.jsx`.

**Maven build fails: "release version 21 not supported"**
You're using an older JDK. Install JDK 21 (e.g. via SDKMAN: `sdk install java 21-tem`).

**`npm install` errors on Windows**
Try `npm install --legacy-peer-deps`. If you get `gyp` errors, install Windows Build Tools or use Docker instead.

**AI photo check never appears**
Check `GET /api/ai/status` (or the badge on the admin dashboard). With `provider: none`, no AI is configured — see [The AI layer](#-the-ai-layer). With Ollama: is `ollama serve` running, and is a *vision* model pulled (`ollama list` should show `qwen2.5vl:3b`)? Text-only models like `phi3` can't read photos. The backend log explains every fallback in one line (`unreachable`, `did not answer within 300 s`, `rate limit hit`, `HTTP 404` for a wrong model name).

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

## 🧠 The AI layer

Runs on **free** providers only, and degrades to deterministic heuristics when none is configured — the app never needs a paid API or an internet connection to work.

### What it does

| Feature | Where | What the model does | Fallback without AI |
|---|---|---|---|
| **Vision damage assessment** | Report form after photo upload; every incident card (admin + volunteer) | Looks at the actual photo: severity score, hazards, people at risk, responder access, resources needed. Flags photos that don't match the reported disaster type. Runs in the background — reporting never waits for it. | Stable score from image bytes + reported severity |
| **Duplicate detection** | Admin → "Check for duplicate reports" | Compares a report with active reports **of the same disaster type** within 2 km / 24 h (the type filter is enforced in code, not left to the model) | Same type, ≤500 m, ≤6 h |
| **Dispatch planning** | Admin → AI Dispatch → "Plan dispatch" | Matches free volunteers to open incidents by threat to life, severity and real distance | Greedy: most urgent first, nearest free volunteer |
| **Assistant** | Chat widget, "Analyze with AI" | Emergency guidance with Indian helpline numbers | Keyword-matched safety replies |

### Choosing a provider

| | Gemini (Google AI Studio) | Ollama (local) |
|---|---|---|
| Cost | Free tier, no card | Free |
| Setup | Get a key at https://aistudio.google.com/apikey | Install Ollama, `ollama pull qwen2.5vl:3b` (8 GB RAM) or `:7b` (16 GB+) |
| Speed | A few seconds | Slow on CPU — measured on an i5-1235U laptop, 8 GB RAM, no GPU: **133–184 s per photo** with `qwen2.5vl:3b`, 20–60 s per text call |
| Limits | Rate-limited free tier | None |
| Privacy | Google's pricing page states free-tier content **is used to improve its products** — that includes citizens' photos | Nothing leaves the machine |
| Offline | No | Yes |

```powershell
# Gemini
$env:GEMINI_API_KEY="your-key"; mvn spring-boot:run

# Ollama (needs a vision model for photo assessment)
ollama pull qwen2.5vl:3b      # or qwen2.5vl:7b with 16 GB+ RAM
$env:AI_PROVIDER="ollama"; mvn spring-boot:run
```

With neither set, the backend logs `AI provider: NONE (heuristic fallbacks only)` and everything still works. `GET /api/ai/status` and the admin dashboard badge show which mode is live.

### Design notes

- **Schema-constrained output.** Each result type is a Java record in `AiDtos`; `JsonSchemas` turns it into a JSON schema that the provider enforces during generation. There's no "please return only JSON" and no parsing JSON out of free text.
- **Field order matters.** Every record puts observations and reasoning *before* the verdict. In testing, the verdict-first order produced `isDuplicate: false` next to reasoning that said "same event". Gemini sorts properties alphabetically unless told otherwise, so the order is pinned with `propertyOrdering`.
- **Never trust model-produced ids.** Dispatch and duplicate results are checked against the database. Unknown ids are discarded, double-booked volunteers are dropped, and names come from the DB rather than the model's echo.
- **Scores can't be forged.** The vision result is stored server-side beside the image (`<uuid>.png.ai.json`). Incident creation reads that file. It ignores any `aiSeverityScore` in the request body, so a citizen can't mark their own report 1.0 to jump the queue.
- **Weak-model safety net.** When the model says "separate event" but location, type and timing match strongly, the report is flagged as a possible duplicate for human review. It isn't silently trusted either way.
- **Reporting never waits on AI.** On a CPU-only laptop a photo takes 2–3 minutes. The first version analysed inline, so the photo URL reached the form only after the model finished — a citizen who pressed Submit in the meantime filed the report *without its photo*. Now the upload returns in under a second, `PhotoAnalysisService` runs the check on a single background worker (a local model handles one image at a time anyway; a 50-deep queue absorbs a burst), and a finished analysis is attached to an already-filed incident and pushed live. The worker writes its result before looking for incidents and incident creation re-checks after saving, so no analysis can slip between the two.
- **Photos are shrunk before the model sees them.** Phone photos are 12+ MP; `ImagePrep` caps the long edge at 768 px (stored original untouched) — measured, reading the image is ~95% of CPU time, and 768 px is also one Gemini billing tile instead of two. It honours the EXIF orientation tag that phones use for portrait shots — `ImageIO` ignores it, so a naive resize would hand the model a sideways picture.
- **One source of truth for severity.** The label is derived from the score in code. Asked for both, the model contradicted itself (score 0.7, label MEDIUM).
- **No examples in prompts.** A field description once gave `'live power line down'` as an example hazard; the 3B model then reported exactly that for a flood photo with no power line in it. Descriptions now ask only for what is visible, and filler like "none visible" is stripped from lists.
- **Ollama doesn't read schema descriptions.** Its `format` only constrains the output grammar, so the schema (with descriptions) is also placed in the prompt. Gemini reads descriptions natively.
- **Timeouts follow measurements.** `AI_TIMEOUT_SECONDS=0` (default) means 60 s for Gemini and 300 s for Ollama; the browser waits 360 s for AI calls so it never gives up before the backend does.

### Tested with real photos (qwen2.5vl:3b, CPU-only laptop)

Openly licensed photos from Wikimedia Commons, judged against what is actually in each picture:

| Photo | Reported as | Final result |
|---|---|---|
| Residential street under deep water, cars submerged, no people | FLOOD / HIGH | Flooded road and submerged vehicles, HIGH, matches report — no invented people or hazards |
| Distant smoke plume behind an office block | FIRE / HIGH | Smoke listed as a hazard, HIGH 0.8, matches report |
| Park bench on a sunny day | FLOOD / HIGH | **Flagged as not matching the report**, LOW 0 — catches junk reports |
| 3008×2000 camera original of the flood photo | FLOOD / HIGH | Same verdict (CRITICAL 0.9); downscaled before sending |

Measured time per photo on that laptop: **133–184 s** (reading the image dominates; writing the answer takes ~15 s). The same photo again takes ~25 s thanks to Ollama's cache.

How the prompts got there — each fix came from a failed run:

| Run | What went wrong | Fix |
|---|---|---|
| 1 | Score 0.7 labelled MEDIUM | Label derived from score in code |
| 2 | Flood photo got "live power line down" and "unstable structures" — both copied from examples in the prompt | Examples removed from prompts |
| 3 | Over-corrected: thick smoke described in the summary, yet no hazards and score 0 | Prompt: evidence of an out-of-frame emergency counts; never list what isn't visible |

**Known limitations:** a 3B model is reliable on the overall verdict (is this the reported disaster, rough severity) but not on every detail. The fire summary still says "warehouse fire", echoing the reporter's text though only smoke is visible. Hazard lists sometimes include negative statements ("No visible trapped people"); they're left in because filtering negations would also drop real hazards like "no exit route". The UI labels all AI output *"verify on scene"*. `qwen2.5vl:7b` (16 GB RAM) or Gemini should do better.

### Tests

```bash
cd backend && mvn test     # also runs as part of mvn package
```

`ImagePrepTest` (downscaling, EXIF rotation checked pixel by pixel, transparency, undecodable input) and `AiVisionServiceTest` (score→label bands, filler removal).

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
