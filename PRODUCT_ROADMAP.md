<!--
  Vertxing — Product Roadmap
  A living plan to take Vertxing from "working engine + rough product" to a
  coherent, scalable, sellable product. Reviewed and updated each milestone.
-->

# Vertxing — Product Roadmap

> **Where we are (honest assessment).** The hard, defensible core is built and *verified under tests*: a race-safe real-time engine (direct calls, meetings, waiting room — all with adversarial smoke tests), LiveKit media, JWT auth, and a clean layered backend. **What's missing is the *product*:** information architecture, complete CRUD, correct lifecycles, validation, pagination, privacy, polish, and quality gates. This document fixes the *way we build* and lays out the path to a real product.

> **How we work from here (the most important change).**
> 1. **Stabilize before we extend.** No new features until Phase 0 is done.
> 2. **Contract-first.** `packages/shared` is the single source of truth; UI and API may not drift.
> 3. **Definition of Done includes tests.** Every change ships with unit/integration coverage and updates the smoke/e2e suites. No "it builds" = "it's done."
> 4. **Lifecycles are event-driven, not guessed.** State (meeting LIVE/ENDED, presence) is reconciled from authoritative events (LiveKit webhooks), never inferred and left stale.
> 5. **Ship in milestones with acceptance criteria**, behind feature flags where risky.

---

## 1. Product North Star

**Vertxing is the fastest, most human way for teams to meet and call — instant rooms, direct calls, and AI that makes every conversation count.**

**Primary personas**
- **Host / Organizer** — schedules and runs meetings, controls who's in, reviews recordings/summaries.
- **Participant** — joins fast, talks, shares, reacts, leaves.
- **Caller** — rings a teammate directly (1:1 → group), escalates audio→video.
- **Admin** (later) — manages an org/workspace, members, billing, policy.

**Jobs-to-be-done**: "start/join a meeting in <10s", "reach a specific person now", "never take notes again", "know what I missed", "manage my meetings and history", "control who can reach me".

---

## 2. Information Architecture & Navigation (fixes "routes all messed")

Today everything lives on one `/dashboard`. Replace it with a real **authenticated app shell**: a persistent left **sidebar** on desktop, a **bottom tab bar** on mobile, and a top bar (search, presence, profile). The live meeting/call is full-screen, *outside* the shell.

### Route map
```
Public
  /                       Landing
  /login, /register       Auth

App shell (authenticated)  — sidebar + topbar
  /app                    Home (next meeting, recent calls, quick actions)
  /app/meetings           Meetings list — tabs: Upcoming · Past · All — paginated, searchable
  /app/meetings/new       Schedule (validated) / Start instant
  /app/meetings/[id]      Detail — participants, history, recording, edit, delete, copy link
  /app/contacts           People — favorites, online status, call, presence-aware
  /app/calls              Call history — incoming/outgoing/missed
  /app/recordings         Recordings + AI summaries (later phase)
  /app/settings           Profile · Devices · Notifications · Privacy/DnD · Account

Full-screen (no shell)
  /room/[roomName]        Live meeting
  (call overlay)          Active direct call
```

### In-call control pane (fixes "no side/control pane with features")
A right-hand **dockable pane** with tabs: **Participants** · **Chat** · **Reactions** · **Invite** · **(host) Waiting room** · **(later) Transcript**. Collapsible; becomes a bottom sheet on mobile.

---

## 3. The Roadmap (phased milestones)

### Phase 0 — Stabilization & Foundations  ⟵ DO THIS NEXT
**Goal: fix the debt and the IA so the product feels coherent and correct. No new features.**

- **App shell & routing**: sidebar/bottom-nav, the route map above, move dashboard content into proper sections.
- **Meeting lifecycle (event-driven)**: integrate **LiveKit webhooks** → reconcile `status` (`SCHEDULED→LIVE→ENDED`), live `participantCount`, and **auto-end when the room empties**. Fixes "stuck LIVE with 0 participants".
- **Meeting CRUD complete**: `GET /meetings/:id` detail, `DELETE /meetings/:roomName` (host RBAC), edit (title/time), participant history (the `Participant` ledger we already store). A real **Meetings page** with detail/edit/delete.
- **Validation everywhere**: `scheduledStartAt` must be in the future; titles bounded; reject past/invalid input at the DTO *and* UI.
- **Pagination**: cursor-based on `GET /meetings`, `/users`, `/calls`; infinite scroll + empty/loading/error states.
- **Presence privacy & call permission (v1)**: a **Contacts** model (or workspace scoping) so not "anyone can call anyone"; Do-Not-Disturb; online status only to permitted users.
- **Design-system pass**: consistent spacing/typography, loading skeletons, empty states, toasts for every async action (success/failure), accessible focus/ARIA.
- **Quality system bootstrap**: testing pyramid (below), CI that runs typecheck + unit + smoke on every change, error boundary + Sentry-style reporting, structured logging already in place.

**Acceptance criteria**: leaving a meeting reflects correct status within seconds; you can view/edit/delete/see history of a meeting; you cannot schedule in the past; lists paginate; you only see/call permitted contacts; every screen has loading/empty/error states; CI is green with tests.

### Phase 1 — Meetings, done right
Recurring meetings, calendar invites (Google/Outlook, ICS), co-host management, lobby/waiting-room polish, per-meeting settings (mute-on-entry, lock room), participant roles UI, meeting templates.

### Phase 2 — Calls & Contacts, done right
Contacts/favorites, **call history + missed-call badges** (persist a `calls` table in Postgres), DnD/availability, group-call roster management, call-quality indicators, the in-process ring-timeout moved to a **Redis delayed job** (multi-instance safe).

### Phase 3 — Collaboration depth
Persistent **chat history**, screen-share quality controls, raise-hand / speaker view / pin / spotlight, virtual backgrounds & noise suppression, polls/Q&A, file share.

### Phase 4 — AI layer (the moat)
**Recording → transcription → summary + action items + searchable history** (LiveKit Egress → Whisper/Deepgram → Claude). "What did I miss", semantic search across meetings, live captions/translation.

### Phase 5 — Scale & Enterprise
SFU autoscaling + cascading, **TURN (coturn)** for real networks, multi-region, **orgs/workspaces + RBAC**, SSO/SAML, admin console, audit logs, **observability** (Prometheus/Grafana), E2E encryption option, SOC2/GDPR/HIPAA track, rate limiting, **httpOnly-cookie tokens**.

### Phase 6 — Mobile, properly
Harden the **PWA** (done: installable) → wrap with **Capacitor** for app-store builds and **native push** (so calls ring when the app is closed) → CallKit (iOS) / ConnectionService (Android). One web codebase, native shell.

### Phase 7 — Monetization
Plans & **billing (Stripe)**, usage limits (participants/minutes/recording), team seats, paywalls, analytics dashboard, public embeddable SDK (the "Stripe-for-video" play).

---

## 4. Engineering Quality System (cross-cutting, starts in Phase 0)

- **Testing pyramid**: unit (services, mappers, state machine) → integration (Testcontainers: Postgres+Redis) → e2e (Playwright: auth, schedule, join, call) → the race **smoke tests** we already have. Target meaningful coverage on domain logic.
- **CI/CD**: on every PR — typecheck, lint, unit+integration, build all workspaces, run smoke; block merge on red. Preview deploys.
- **Observability**: error tracking (Sentry), structured logs shipped to an aggregator, request/latency metrics, alerts on p99 + SFU health.
- **Performance budgets**: route bundle limits (e.g. dynamic-import the call screen so the dashboard isn't 295 kB), API latency SLOs.
- **Security/Privacy**: httpOnly cookies, rate limiting, input validation, authz tests, least-privilege LiveKit tokens, PII handling policy.
- **Accessibility**: keyboard nav, ARIA, contrast, screen-reader passes.
- **Contract discipline**: `packages/shared` is law; consider generating an OpenAPI/Zod layer and contract tests so UI/API can't drift.

---

## 5. Immediate plan — "Stabilization Sprint" (the next thing we build)

A concrete, ordered backlog. Each item = a verifiable slice.

1. **App shell + route map** (sidebar/bottom-nav; move dashboard into `/app/*`).
2. **LiveKit webhooks → meeting lifecycle** (status + participantCount + auto-end). *Kills the "stuck LIVE" bug.*
3. **Meeting detail/edit/delete + history page**; wire delete/clear into the list.
4. **Scheduling validation** (no past dates) — DTO + UI.
5. **Pagination** on meetings & directory + skeletons/empty/error states.
6. **Contacts + presence privacy (v1)** so calls aren't open to everyone.
7. **Toasts + global error boundary**; consistent async feedback.
8. **CI + first test suites** (domain unit tests + e2e happy paths).

> Recommendation: I build these **in order, one verified slice at a time**, each with tests, and we review after each. That's how this becomes a product instead of a demo.

---

## 6. What we are NOT doing yet (and why)
Holding off on AI, recordings, billing, native push, and new call features until Phase 0 makes the base solid. Adding more on a shaky base is what created the issues you flagged.
