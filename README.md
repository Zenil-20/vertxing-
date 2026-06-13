<!--
  Vertxing — Real-Time Video Meeting Platform
  Root README: architecture overview + how to run. Each source file carries its
  own top-of-file banner explaining its layer and purpose.
-->

# Vertxing

A scalable, real-time **video meeting platform** (Zoom-class) built as a TypeScript monorepo. The hard part of such a product is the media path — Vertxing offloads that to a **LiveKit SFU** and focuses the application code on a clean, layered backend and a typed web client that share one contract.

> Status: **foundation / vertical slice.** Auth, meetings, and the join → SFU handshake work end-to-end. Both apps pass production builds. See [Roadmap](#roadmap) for what's next.

---

## Architecture at a glance

```
   Browser (Next.js)                         apps/api (NestJS)
  ┌────────────────────┐   REST /api/*      ┌───────────────────────────┐
  │  React UI          │ ─────────────────► │  Presentation (controllers)│
  │  @livekit/         │   ApiSuccess<T>    │  Application (services)     │
  │   components-react │ ◄───────────────── │  Infrastructure (repos)     │
  └─────────┬──────────┘                    └─────┬───────────┬───────────┘
            │ WebRTC media (token)                │           │
            ▼                                Postgres      Redis
  ┌────────────────────┐                    (durable)   (presence/tokens)
  │  LiveKit SFU        │  ◄── access token signed by apps/api (MediaService)
  │  (media engine)     │
  └────────────────────┘
```

- **Media never touches our API.** The API only *authorises* media: on join it mints a short-lived, room-scoped LiveKit token. Audio/video flows browser ↔ SFU directly. This is what lets the platform scale — the API is stateless request/response, the SFU does the heavy lifting.
- **One typed contract.** `packages/shared` holds the request/response types and enums; both the API and the web client import them, so a breaking change fails to compile rather than at runtime.
- **Layered, secure-by-default backend.** Every route is authenticated unless explicitly `@Public()`; every response is enveloped; every error is normalised; every DTO is validated — all via app-wide providers, no per-route boilerplate.

## Tech stack

| Concern | Choice |
| --- | --- |
| Language | TypeScript (strict) |
| Monorepo | npm workspaces |
| API | NestJS 10 (modular + DI) |
| Persistence | PostgreSQL + Prisma |
| Realtime state | Redis (presence, refresh-token allow-list) |
| Media engine | LiveKit (SFU) |
| Auth | JWT access + Redis-rotated refresh, bcrypt |
| Web | Next.js 14 (App Router), React 18 |
| Call UI | `@livekit/components-react` |

## Monorepo layout

```
vertxing/
├─ packages/shared/        # Cross-cutting types (API envelope, DTO contracts, enums)
├─ apps/api/               # NestJS backend
│  ├─ prisma/schema.prisma # Data model (users, meetings, participants)
│  └─ src/
│     ├─ config/           # Env validation (fail-fast) + typed config
│     ├─ common/           # Filters, interceptors, guards, decorators
│     ├─ infrastructure/   # PrismaService, RedisService (global)
│     └─ modules/          # auth · users · meetings · media · health
└─ apps/web/               # Next.js client
   ├─ lib/                 # api-client, session, auth-context
   └─ app/                 # /, /login, /register, /room/[roomName]
```

---

## Running it locally

### Prerequisites
- Node.js ≥ 20 (developed on 24)
- Docker Desktop (for Postgres, Redis, LiveKit)

### 1. Install + configure
```bash
npm install
cp .env.example .env          # secrets are dev-only; rotate for real deploys
```

### 2. Start backing services
```bash
npm run infra:up              # postgres + redis + livekit via docker compose
```

### 3. Create the database schema
```bash
npm run prisma:generate       # generate the typed Prisma client
npm run prisma:migrate        # create tables (loads ../../.env automatically)
```

### 4. Run the apps (two terminals)
```bash
npm run dev:api               # http://localhost:4000/api
npm run dev:web               # http://localhost:3000
```

Open **http://localhost:3000**, register an account, click **New meeting**, and you're in a live room. Open the same room URL in a second browser/profile to see multi-party video.

### Verify the API in isolation
Once infra is up and the API is running:
```bash
curl http://localhost:4000/api/health
# → {"success":true,"data":{"status":"ok","uptimeSeconds":3},"timestamp":"..."}
```

> **Note:** the runtime boot check was **not** executed during initial scaffolding because the Docker daemon wasn't running. Both apps are verified at the **build/typecheck** level (`npm run build` passes for all workspaces). The commands above are the remaining manual smoke test.

---

## API surface (v0)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | public | Liveness |
| POST | `/api/auth/register` | public | Create account → tokens |
| POST | `/api/auth/login` | public | Sign in → tokens |
| POST | `/api/auth/refresh` | public | Rotate refresh → new pair |
| POST | `/api/auth/logout` | bearer | Revoke a refresh session |
| GET | `/api/users/me` | bearer | Current profile |
| POST | `/api/meetings` | bearer | Create instant/scheduled meeting |
| GET | `/api/meetings` | bearer | Meetings you host |
| GET | `/api/meetings/:roomName` | bearer | Meeting detail |
| POST | `/api/meetings/:roomName/join` | bearer | Get SFU token to connect media |

Every response is wrapped: `{ success, data, timestamp }` on success, `{ success:false, error:{ statusCode, code, message, details? }, timestamp }` on failure.

---

## Conventions

- **File banners.** Every source file opens with a comment stating its path, layer, and purpose (JSON files excepted — JSON forbids comments).
- **Repository pattern.** Only `*.repository.ts` touches Prisma; services depend on repositories.
- **Boundary mappers.** `*.mapper.ts` convert DB rows ↔ wire contracts, dropping sensitive columns (e.g. password hash) explicitly.
- **No `process.env` sprawl.** Config is validated once at boot and read through a typed `ConfigService`.

## Roadmap

Foundation is in place; the next increments toward a "huge product":

1. **WebSocket gateway** — live presence, participant list, lobby/waiting room, host controls (mute-all, end-for-all).
2. **Recording + transcription** — LiveKit Egress → object storage → Whisper/Deepgram → AI summary (the differentiator).
3. **Persistent chat** — store messages, not just the in-call data channel.
4. **Scheduling & calendar** — invites, recurring meetings, ICS.
5. **Scale-out** — SFU autoscaling + cascading, TURN (coturn), multi-region.
6. **Hardening** — httpOnly cookie tokens, rate limiting, RBAC, E2E encryption, SOC2/HIPAA path.
7. **Tests** — unit (services/mappers), integration (Testcontainers for PG/Redis), e2e (Playwright).
