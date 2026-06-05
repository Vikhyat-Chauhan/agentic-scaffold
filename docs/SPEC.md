# Spec: Afoot

> A personalized San Francisco event feed — one place to discover what's on, ranked by how well it fits your taste, built from real data that refreshes itself.

**Demo Target:** Open the live URL on a phone → see a ranked feed of *real* upcoming SF events, each with a match score and a one-line "why this fits you" → tap a category/edit taste → feed re-ranks instantly.

---

## Features

### P0 — Must Have
- **Personalized feed** — ranked list of real upcoming SF events with per-event match score + reason.
- **Taste profile** — onboarding/edit screen: interests, free-text vibe, price ceiling. Re-ranks the feed.
- **Real-data ingestion** — pull live events from multiple SF sources into the DB.

### P1 — Should Have
- **Save / dismiss** — thumbs an event in or out; saved events viewable.
- **Filters** — by category, free-only, this week.
- **Autonomous refresh** — daily Vercel cron re-ingests so the feed stays fresh with no human in the loop.

### P2 — Nice to Have
- Map view, calendar export (.ics), email digest via Resend, more sources (Ticketmaster/Eventbrite keys).

---

## Data Model

| Entity | Key Fields |
|--------|------------|
| events | id, source, source_id, title, description, url, image_url, venue, neighborhood, start_time, end_time, is_free, price_min(¢), price_max(¢), category, tags[], raw |
| profiles | id('me'), interests[], vibe, neighborhoods[], price_max_cents |
| match_cache | event_id, profile_hash, score(0-100), reason |
| interactions | id, event_id, action(save/dismiss/going) |

---

## Stories

### Personalized feed
ENTRY: user navigates to `/`
FLOW:
  1. Server loads profile + upcoming events
  2. Matcher scores each event for the profile
  3. Feed renders ranked cards with score + reason
EXIT: user sees a ranked list of real upcoming SF events, each showing a match score and a one-line reason.

### Taste profile
ENTRY: user navigates to `/onboarding` (or taps Edit on `/`)
FLOW:
  1. User toggles interest categories
  2. User edits free-text vibe + price ceiling
  3. User saves
EXIT: profile persists and the feed re-ranks to reflect the new taste.

### Real-data ingestion
ENTRY: cron or admin hits `POST /api/ingest`
FLOW:
  1. Each source adapter fetches live events
  2. Events normalized (LLM for messy sources) and categorized
  3. Upsert into `events` by (source, source_id)
EXIT: the `events` table holds dozens+ of real upcoming SF events.

---

## Stories — P1 (manual test scripts)

### Save / dismiss  *(feat/save-dismiss-d4)*
ENTRY: user is on the feed at `/`
FLOW:
  1. Each event card shows a save (thumbs-up) and dismiss (thumbs-down) control
  2. User taps **dismiss** on an event → it disappears from the feed
  3. User taps **save** on another event → the card shows a saved/active state
  4. User opens `/saved` from the nav
EXIT: dismissed events no longer appear in the feed, and the saved event is listed at `/saved`.
TEST: dismiss the top card (it vanishes), save the next card, open `/saved` — only the saved event shows. Reload `/` — the dismissed card stays gone.

### Filters  *(feat/filters — not yet built; Sprint 3)*
ENTRY: user is on the feed at `/`
FLOW:
  1. User picks a category chip, and/or toggles "free only", and/or toggles "this week"
  2. Feed refetches `GET /api/feed?category=&free=&when=` with the active filters
  3. Feed re-renders to show only matching events
EXIT: the feed shows only events matching the selected filters; clearing filters restores the full ranked list.
TEST: select category "music" — only music events remain; toggle "free only" — paid events drop; clear both — full feed returns.

### Autonomous refresh  *(feat/cron-e5)*
ENTRY: Vercel Cron fires daily (or manually hit `GET /api/ingest`)
FLOW:
  1. Cron calls `GET /api/ingest` on schedule
  2. The same ingestion runs as POST — adapters fetch, normalize, upsert by (source, source_id)
  3. The `events` table is updated with fresh upcoming events
EXIT: `GET /api/ingest` returns `{ ok, counts, total }` and the feed reflects newly ingested events with no manual step.
TEST: run `curl http://localhost:3000/api/ingest` (GET) — confirm a JSON `{ ok, counts, total }` with non-zero total; check `vercel.json` has a `crons` entry on `/api/ingest`. Reload `/` — feed is populated.

---

## Tech Stack

| Concern    | Choice |
|------------|--------|
| Framework  | Next.js 15 App Router (TypeScript) |
| Database   | Supabase Postgres + Drizzle |
| Auth       | None — single-user "me" profile (matched to the owner) |
| LLM        | Claude (Haiku) for normalization + match scoring; graceful heuristic fallback |
| Deployment | Vercel + daily Cron |

---

## Success Criteria

- [ ] Live URL loads a ranked feed of real SF events on any device.
- [ ] Each event shows a match score + a reason tied to the profile.
- [ ] Editing the profile visibly re-ranks the feed.
- [ ] Events come from real sources and refresh autonomously via cron.
