# Afoot — Agent Steering Guide

> A personalized San Francisco event feed: real events from many sources, ranked by how well they fit your taste, refreshed autonomously.

Live URL: **https://agentic-scaffold-nine.vercel.app**

---

## Tech Stack

| Concern    | Choice                                            |
|------------|---------------------------------------------------|
| Framework  | Next.js 15 (App Router, TypeScript)               |
| Frontend   | React + Tailwind CSS + lucide-react icons         |
| Database   | Supabase Postgres + Drizzle ORM                   |
| LLM        | Claude Haiku via `@anthropic-ai/sdk`              |
| Auth       | None — single-user `'me'` profile                 |
| Deployment | Vercel + daily Cron                               |

---

## Golden Principles

- Build the thinnest thing that demos. Real data over mock data.
- **A stream must compile and run even if another stream's files are missing.** Talk to other streams only through the API contracts and shared types below — never import another stream's internal files.
- All DB access through `src/db/index.ts` only. Schema in `src/db/schema.ts` is **FROZEN**.
- Shared types in `src/lib/types.ts` are **FROZEN** — the contract between streams.
- Monetary amounts stored as **cents** (integers).
- LLM is optional at runtime: `src/lib/anthropic.ts` exports `anthropic` (null if no key) and `hasLLM`. Every LLM call site MUST have a non-LLM fallback so the app works before the key is set.
- Internal pages that read the DB: `export const dynamic = "force-dynamic"`.
- No auth, RBAC, pagination, or tests unless explicitly in a task.

---

## Shared Types (`src/lib/types.ts` — FROZEN)

`Category` (union), `CATEGORIES`, `RawEvent` (adapter output), `EventDTO` (API→client),
`RankedEvent` (EventDTO + `score`, `reason`, `saved`), `Profile`, `DEFAULT_PROFILE`, `InteractionAction`.

## API Contracts (the seam between streams)

- `POST /api/ingest` → runs all source adapters, upserts events. Returns `{ ok, counts: Record<source,number>, total }`. **Owned by Stream A.**
- `GET /api/feed?category=&free=&when=` → `{ events: RankedEvent[], profile: Profile, stats: { total, shown, lastIngest } }`. Ranked desc by score. **Owned by Stream B.**
- `GET /api/profile` → `{ profile: Profile }` (creates DEFAULT_PROFILE if missing).
- `PUT /api/profile` body `Partial<Profile>` → `{ profile: Profile }`, and invalidates match_cache. **Owned by Stream B.**
- `POST /api/interactions` body `{ eventId, action }` → `{ ok: true }`. **Owned by Stream B.**

---

## Directory Map (file ownership — keeps parallel agents off each other)

| Path | Purpose | Owner |
|------|---------|-------|
| `src/db/schema.ts`, `src/db/index.ts` | DB (FROZEN) | foundation |
| `src/lib/types.ts` | shared types (FROZEN) | foundation |
| `src/lib/anthropic.ts`, `src/lib/categories.ts` | LLM client + category meta | foundation |
| `src/lib/sources/*` | source adapters + LLM normalize + registry | **Stream A** |
| `src/app/api/ingest/route.ts` | ingestion endpoint | **Stream A** |
| `src/lib/match.ts` | scoring engine | **Stream B** |
| `src/app/api/feed/route.ts`, `src/app/api/profile/route.ts`, `src/app/api/interactions/route.ts` | read/profile/interaction APIs | **Stream B** |
| `src/app/page.tsx`, `src/app/onboarding/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `tailwind.config.ts`, `src/components/*` | UI | **Stream C** |
| `vercel.json` | cron | integration |

---

## Domain Rules

- Sources: `funcheap` (WP REST, all categories, LLM-normalized), `19hz` (HTML table, music/nightlife), `ticketmaster` + `eventbrite` (graceful no-op without API key).
- Upsert events by unique `(source, source_id)`.
- "Upcoming" = `start_time >= now()` OR `start_time IS NULL` (undated events still shown, ranked lower).
- Match score 0-100; `reason` ≤ ~12 words, second person ("Right up your alley — AI + live music").
- Profile is single-row id `'me'`, seeded from `DEFAULT_PROFILE` (tech/music/food/arts).

---

## Active Feature Streams

*(Sprint 1 — set by the orchestrator. Foundation/Sprint 0 already committed.)*

| Status | Stream ID | Feature |
|--------|-----------|---------|
| [x] Complete | feat/ingestion-a1 | Real-data ingestion — source adapters + `POST /api/ingest` |
| [x] Complete | feat/matching-b2 | Matching engine + feed/profile/interaction APIs |
| [x] Complete | feat/ui-c3 | Editorial dark UI — feed + onboarding |
| [x] Complete | feat/save-dismiss-d4 | Save / dismiss events + `/saved` view |
| [x] Complete | feat/cron-e5 | Autonomous daily refresh — Vercel cron → `/api/ingest` |
| [x] Complete | feat/filters-f6 | Feed filters — category / free-only / today / weekend |
| [x] Complete | feat/ics-export-f7 | Per-event "Add to calendar" (.ics download) |
| [x] Complete | feat/more-sources-g8 | Ticketmaster + Eventbrite live fetch (key-gated) |
| [x] Complete | feat/map-h9 | Neighborhood discovery view — events grouped by neighborhood at `/map` |
| [x] Complete | feat/digest-i10 | Email digest via Resend — `GET /api/digest` sends top events (key-gated) |

### Story blocks for in-progress streams (promoted P2s)

**feat/map-h9 — Neighborhood discovery view**
- ENTRY: user navigates to `/map`
- FLOW:
  1. Server loads upcoming events (reuse the same query the feed uses)
  2. Group events by `neighborhood` (events with none fall under "Around SF")
  3. Render one section per neighborhood, each listing its events with title + venue + start time
- EXIT: user sees upcoming SF events grouped by neighborhood, each group showing its events; a nav link from the masthead reaches `/map`.

**feat/digest-i10 — Email digest via Resend**
- ENTRY: cron or admin hits `GET /api/digest`
- FLOW:
  1. Load the profile and the top-ranked upcoming events (reuse the ranking the feed produces)
  2. Render a simple HTML digest of the top events (title, score, reason, url)
  3. Send via Resend if `RESEND_API_KEY` is set; otherwise return a graceful no-op (same shape, `sent: false`)
- EXIT: `GET /api/digest` returns `{ ok, sent, count }` — with a key set an email is sent; without it, a graceful no-op. Mirrors the LLM-optional pattern.

---

## Handoff Contract

On completion each agent updates THIS file:
1. In **Active Feature Streams**: `[ ] In Progress` → `[x] Complete` for the stream.
2. In **Implemented Features**: add a row (feature, priority, key files, stream ID).

---

## Implemented Features

| Feature | Priority | Key Files | Stream |
|---------|----------|-----------|--------|
| Matching engine + feed/profile/interaction APIs | P0 | `src/lib/match.ts`, `src/app/api/feed/route.ts`, `src/app/api/profile/route.ts`, `src/app/api/interactions/route.ts` | feat/matching-b2 |
| Real-data ingestion — source adapters + `POST /api/ingest` | P0 | `src/lib/sources/{funcheap,nineteenhz,ticketmaster,eventbrite,normalize,index}.ts`, `src/app/api/ingest/route.ts` | feat/ingestion-a1 |
| Editorial dark UI — feed + onboarding | P0 | `src/app/{layout,page,globals.css}`, `tailwind.config.ts`, `src/app/onboarding/page.tsx`, `src/components/{Header,FeedClient,EventCard,MatchBadge,CategoryFilter,ProfileForm,Skeleton,EmptyState,format}.tsx` | feat/ui-c3 |
| Save / dismiss events + `/saved` view | P1 | `src/components/{EventCard,FeedClient,SavedClient,Header}.tsx`, `src/app/saved/page.tsx` | feat/save-dismiss-d4 |
| Autonomous daily refresh — Vercel cron → `GET /api/ingest` | P1 | `vercel.json`, `src/app/api/ingest/route.ts` | feat/cron-e5 |
| Feed filters — category / free-only / today / weekend | P1 | `src/components/{CategoryFilter,FeedClient}.tsx`, `src/app/api/feed/route.ts` | feat/filters-f6 |
| Per-event "Add to calendar" (.ics download) | P2 | `src/lib/ics.ts`, `src/components/EventCard.tsx` | feat/ics-export-f7 |
| Ticketmaster + Eventbrite live fetch (key-gated) | P2 | `src/lib/sources/{ticketmaster,eventbrite}.ts` | feat/more-sources-g8 |
| Email digest via Resend (key-gated) | P2 | `src/app/api/digest/route.ts`, `src/lib/email.ts`, `vercel.json` | feat/digest-i10 |
| Neighborhood discovery view | P2 | `src/app/map/page.tsx`, `src/components/Header.tsx` | feat/map-h9 |
