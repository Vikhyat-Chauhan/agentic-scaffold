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

## Implemented Features

| Feature | Priority | Key Files | Stream |
|---------|----------|-----------|--------|
| *(updated on completion)* | — | — | — |
