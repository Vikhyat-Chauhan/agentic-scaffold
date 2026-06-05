# Testing Guide — Afoot

> Manual smoke-test scripts for every feature in [SPEC.md](SPEC.md). No automated tests in this project (per Golden Principles) — these are the human/agent scripts to confirm each feature works end-to-end before a demo.

**How to use:** start the app, then walk each script top to bottom. Each has an **ENTRY** (where you start), **STEPS** (what to do), and **PASS** (what proves it works). A feature passes only if PASS holds with **no console/network errors**.

## Setup

```bash
npm run dev          # http://localhost:3000
curl -s http://localhost:3000/api/ingest | jq   # populate the DB with real events first
```

- The feed is empty until ingestion runs at least once. Always ingest before testing feed-dependent features.
- LLM and email are **optional**: without `ANTHROPIC_API_KEY` / `RESEND_API_KEY` the app must still work via fallbacks. Test both with and without keys where noted.
- Single-user app — there is one profile, id `'me'`. No login.

---

## P0 — Must Have

### 1. Real-data ingestion  *(feat/ingestion-a1)*
ENTRY: `POST /api/ingest` (or `GET` for cron parity)
STEPS:
1. `curl -s -X POST http://localhost:3000/api/ingest | jq`
2. Inspect the response shape.
3. Re-run the same call a second time.
PASS:
- Returns `{ ok: true, counts: {<source>: n, ...}, total }` with `total` in the dozens+.
- `counts` includes `funcheap` and `19hz` with non-zero numbers; `ticketmaster`/`eventbrite` may be `0` without keys (graceful) — that is still a pass.
- Second run does **not** duplicate events (upsert by `(source, source_id)`) — `total` stays roughly stable, not doubled.

### 2. Personalized feed  *(feat/matching-b2 + ui-c3)*
ENTRY: navigate to `/`
STEPS:
1. Load `/` after ingesting.
2. Read several event cards top to bottom.
PASS:
- A ranked list of **real** upcoming SF events renders (highest score first, descending).
- Every card shows a **match score** (0–100) and a **one-line reason** in second person ("Right up your alley — …").
- Only upcoming events appear (`start_time >= now` or undated); past-dated events are absent.
- Without `ANTHROPIC_API_KEY`: scores + reasons still render via the heuristic fallback (no crash, no empty reasons).

### 3. Taste profile  *(feat/matching-b2 + ui-c3)*
ENTRY: navigate to `/onboarding` (or tap "Tune taste" in the masthead)
STEPS:
1. Note the order of the top 3 cards on `/`.
2. Go to `/onboarding`, toggle interest categories, edit the free-text vibe and price ceiling, and save.
3. Return to `/`.
PASS:
- Profile persists across reload (re-open `/onboarding` — selections are still set).
- The feed **visibly re-ranks** — top cards differ from step 1, and reasons reflect the new taste.
- `match_cache` is invalidated on save (no stale scores from the previous profile).

---

## P1 — Should Have

### 4. Save / dismiss  *(feat/save-dismiss-d4)*
ENTRY: user is on the feed at `/`
STEPS:
1. Tap **dismiss** (thumbs-down) on the top card.
2. Tap **save** (thumbs-up) on another card.
3. Open `/saved` from the nav.
4. Reload `/`.
PASS:
- Dismissed card disappears from the feed immediately and **stays gone after reload**.
- Saved card shows an active/saved state; only saved events are listed at `/saved`.

### 5. Filters  *(feat/filters-f6)*
ENTRY: user is on the feed at `/`
STEPS:
1. Select a category chip (e.g. "music").
2. Toggle "free only".
3. Toggle "today", then "weekend".
4. Clear all filters.
PASS:
- Category chip → only that category's events remain.
- "Free only" → paid events drop out.
- "Today"/"weekend" → only events in that window remain (combined with category/free).
- Clearing restores the full ranked list. Feed refetches `GET /api/feed?category=&free=&when=` per change.

### 6. Autonomous refresh  *(feat/cron-e5)*
ENTRY: Vercel Cron fires daily (or manually hit `GET /api/ingest`)
STEPS:
1. `curl -s http://localhost:3000/api/ingest | jq` (GET, not POST).
2. Open `vercel.json`.
3. Reload `/`.
PASS:
- GET returns `{ ok, counts, total }` with non-zero `total` (same handler as POST).
- `vercel.json` has a `crons` entry targeting `/api/ingest`.
- Feed reflects freshly ingested events with no manual step.

---

## P2 — Nice to Have

### 7. Calendar export (.ics)  *(feat/ics-export-f7)*
ENTRY: user is on the feed at `/`
STEPS:
1. Click "Add to calendar" on any event card.
2. Open the downloaded `.ics` file.
PASS:
- A `.ics` file downloads (no navigation away, no console error).
- It contains a valid `VEVENT` with the event's title, start time, and location; opening it in a calendar app shows the correct event.

### 8. Ticketmaster + Eventbrite sources  *(feat/more-sources-g8)*
ENTRY: `POST /api/ingest`
STEPS:
1. Without keys: `curl -s -X POST .../api/ingest | jq '.counts'`.
2. With `TICKETMASTER_API_KEY` / `EVENTBRITE_API_KEY` set: re-run.
PASS:
- Without keys: `ticketmaster` and `eventbrite` counts are `0` and ingestion still succeeds (graceful no-op, no thrown error).
- With keys: those counts become non-zero and their events appear in the feed.

### 9. Neighborhood discovery view  *(feat/map-h9 — in progress)*
ENTRY: navigate to `/map`
STEPS:
1. Click the "Map" link in the masthead.
2. Scroll the grouped sections.
PASS:
- `/map` renders upcoming events **grouped by neighborhood**, one section per neighborhood with a heading + the events in it (title, venue, start time).
- Events with no neighborhood appear under an "Around SF" group.
- Masthead nav links to `/map`; no console/network errors. (No map library/pins expected — grouped list only.)

### 10. Email digest via Resend  *(feat/digest-i10 — in progress)*
ENTRY: `GET /api/digest`
STEPS:
1. Without `RESEND_API_KEY`: `curl -s http://localhost:3000/api/digest | jq`.
2. With `RESEND_API_KEY` (and `RESEND_TO`) set: re-run and check the inbox.
PASS:
- Without key: returns `{ ok: true, sent: false, count }` — graceful no-op, no throw.
- With key: returns `{ ok: true, sent: true, count }` and an email arrives containing the top events (title, score, reason, url).
- `vercel.json` has a `crons` entry for `/api/digest` **in addition to** the existing `/api/ingest` one.

---

## Cross-cutting checks (run before any demo)

- [ ] Live URL loads a ranked feed of real SF events on a **phone** viewport.
- [ ] Every card shows a score + a reason tied to the current profile.
- [ ] Editing the profile **visibly** re-ranks the feed.
- [ ] Events come from real sources and `GET /api/ingest` refreshes them with no manual step.
- [ ] App boots and all routes render with **both** `ANTHROPIC_API_KEY` set and unset.
- [ ] No errors in the browser console or network tab during the full `/` → `/onboarding` → `/saved` → `/map` walk.
