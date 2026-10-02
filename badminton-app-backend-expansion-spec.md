# 🏸 Badminton App — Phase 2: Backend, Database, Live Sharing & History

Continues from the original MVP spec/prompt doc. That doc stays as-is for reference — this one covers everything new: a real backend + database, view-only shareable links, keep-alive, and full history/leaderboards.

---

## 0. Confirmed decisions

All settled — this is the locked plan for Stages 9-15, no open questions left on these:

1. **Backend:** Node.js + Express + **Socket.io**, hosted on Render. Socket.io (not plain REST polling) is what makes the live share-link feel instant — Render supports long-lived connections, which is exactly why a persistent-server host like Render is the right call here over a serverless platform.
2. **Database: Neon.** Not Render's own free Postgres — that one gets deleted after 90 days, which would undermine the whole point of permanent history. Render (the app) connects to Neon (the database) over a standard `DATABASE_URL` — a very common, well-trodden pairing.
3. **Keep-alive: external monitor + frontend backup.** A free external uptime monitor (**UptimeRobot** or **cron-job.org**) hits `GET /health` every 5 minutes, 24/7, regardless of whether anyone has the app open — this is what actually solves the 15-minute-sleep problem. The frontend ping while the `Play` tab is active stays in as a harmless second layer on top of it.
4. **Access model: no login system, two kinds of links.** You (scorekeeper) use the full app with edit access via a simple shared PIN (stored once in the browser, no full auth system). Everyone else gets a **read-only share link** (`/live/[slug]`) with zero edit controls — just the live fixture list, table, and final, auto-updating.
5. **Still zero data loss, now with a flaky backend in the mix.** The original local-first design stays as the *safety net*. Every score entry writes to local state/localStorage **immediately** and optimistically; syncing to the backend happens in the background with a retry queue. If Render is asleep/waking up or a phone loses signal mid-court, scoring continues uninterrupted and syncs once the connection's back.

---

## 1. Updated Architecture

```
┌─────────────┐       REST + WebSocket       ┌──────────────┐      Postgres       ┌─────────────┐
│   Vercel     │ ───────────────────────────▶ │    Render     │ ──────────────────▶ │    Neon     │
│  (Next.js    │ ◀─────────────────────────── │ (Express +    │ ◀────────────────── │  (Postgres) │
│  frontend)   │      live score updates      │  Socket.io)   │                     │             │
└─────────────┘                               └──────────────┘                     └─────────────┘
       ▲
       │ GET /live/[slug] — read-only, no auth, Socket.io subscribe
   friends' phones
```

- Frontend stays on Vercel (fast, free, no sleep issue — it's static/edge, not a long-running server).
- Backend on Render owns: all writes, the DB connection, and the Socket.io server broadcasting live updates to connected viewers.
- Frontend keeps its local Zustand + localStorage layer from Phase 1, now acting as an optimistic cache in front of the backend rather than the sole source of truth.

---

## 2. Database Schema (Postgres)

```sql
players (
  id uuid primary key,
  name text not null,
  avatar_type text not null,
  avatar_emoji text,
  avatar_color text,
  created_at timestamptz default now()
)

tournaments (
  id uuid primary key,
  share_slug text unique not null,       -- random short slug for /live/[slug]
  day_id uuid references day_tables(id),
  player_ids uuid[] not null,
  status text not null,                  -- 'active' | 'final' | 'completed'
  created_at timestamptz default now(),
  completed_at timestamptz
)

matches (
  id uuid primary key,
  tournament_id uuid references tournaments(id),
  round int not null,
  is_final boolean default false,
  player_a uuid references players(id),
  player_b uuid references players(id),
  court_side jsonb,                      -- {playerId: 1|2}
  score_a int,
  score_b int,
  points_a int,
  points_b int,
  played boolean default false,
  played_at timestamptz
)

day_tables (
  id uuid primary key,
  date date unique not null,
  closed boolean default false,
  totals jsonb,                          -- {playerId: points} snapshot once closed
  closed_at timestamptz
)

day_results (                            -- one row per closed day, powers the Day Champions / Last Place leaderboard
  id uuid primary key,
  day_table_id uuid references day_tables(id),
  date date not null,
  top_player_id uuid references players(id),
  bottom_player_id uuid references players(id)
)
```

`points_a`/`points_b` on `matches` store the same values described in the Phase 1 spec (round-robin thresholds, final adjustment added onto the tournament total) — the backend is just persisting what the frontend's existing scoring logic already computes, not reinventing it.

---

## 3. API Design

| Method & path | Access | Purpose |
| --- | --- | --- |
| `GET /health` | public | keep-alive ping target |
| `POST /players` | scorekeeper | create a custom player |
| `GET /players` | public | list all players (for avatar grid + history filters) |
| `POST /tournaments` | scorekeeper | create tournament, generates `share_slug`, returns fixtures |
| `GET /tournaments/:slug` | public (read-only) | fetch current tournament state — powers `/live/[slug]` |
| `PATCH /tournaments/:id/matches/:matchId` | scorekeeper | submit a match score, recomputes points, broadcasts via socket |
| `PATCH /tournaments/:id/final` | scorekeeper | submit final score, closes tournament, triggers day-table update |
| `GET /day-tables/:date` | public | one day's cumulative table |
| `GET /history` | public | filterable log — query params: `range=day\|week\|month`, `from`, `to`, `playerId`, `scorePattern` (e.g. `5-0`, `margin>=4`) |
| `GET /leaderboard` | public | overall leaderboard — query param `sortBy=points\|matches`, plus the same range filters as `/history` |
| `GET /day-results` | public | all-time Day Champions / Day Last-Place counts per player |

**Socket.io events:** `tournament:update` (any match/final scored), `tournament:closed` (day table updated) — the `/live/[slug]` page subscribes to the tournament's room and just re-renders on event, with a 5s polling fallback (`GET /tournaments/:slug`) if the socket disconnects, since court wifi/signal can be unreliable.

---

## 4. Keep-Alive Setup

1. Add `GET /health` to the Express app, returning `{ status: "ok" }` — no DB call needed, keep it instant.
2. Sign up for **UptimeRobot** (free) or **cron-job.org** (free) → add a monitor hitting `https://your-app.onrender.com/health` every 5 minutes.
3. Keep a small frontend `setInterval` fetch to `/health` while the `Play` tab is mounted and active, as a harmless backup — but don't rely on it alone.

---

## 5. Live Share Link

- On `POST /tournaments`, generate a short random `share_slug` (e.g. `nanoid(8)`), return the full shareable URL.
- Add a **Share** button on the `Play` screen (fixtures state) that copies the link and optionally shows a QR code (generate client-side with a small library, no external API call needed) — scan-to-view is faster than typing a URL courtside.
- Build `app/live/[slug]/page.tsx`: same visual components as the scorekeeper's Fixtures/Table view, but **read-only** — no `ScoreInput`, no tap targets on match cards, just live data plus a small "live" pulse indicator. Subscribes to the tournament's Socket.io room on mount.

---

## 6. History & Leaderboards

**Navigation update:** bottom tab bar grows from 2 to **3 tabs**: `Play`, `Day Table`, `History`. `History` has its own swipeable segmented control — `Log | Leaderboards` — keeping the filterable timeline and the leaderboard cleanly separate, as two sections of one tab rather than two more top-level destinations.

### `Log` section (filterable timeline)

- Filter bar: date range (`Today / This Week / This Month / Custom`), player, and score-pattern (e.g. "blowouts only" = margin ≥4, or a specific score like 5-0).
- Results list: grouped by day, each day expandable to show its tournaments, each tournament expandable to its matches — collapsed by default so a week's worth of play doesn't dump a wall of matches on screen at once.
- Within this filtered range, an inline summed mini-leaderboard header ("this week: 10 matches played — ranked by total points" per your example) sorted by whichever metric is selected (points or matches played).

### `Leaderboards` section — kept visually separate per your request

Two clearly distinct cards, not blended into one table:

1. **Overall Leaderboard** — sortable toggle between *Total Points* and *Total Matches Played*, respects the same date-range filter as `Log`.
2. **Day Champions / Day Last Place** — a genuinely separate card below it, reading straight from `day_results`: "Most #1 finishes" and "Most last-place finishes," all-time, updated automatically the moment a day table closes (no manual recompute needed — `day_results` gets a row written right when `PATCH /tournaments/:id/final` closes the last tournament of a day).

---

## 7. Context Files — extending the Phase 1 setup

Keep using the same three files from Phase 1, just extended:

- **`architecture.md`** — append a new `## Backend (Phase 2)` section with the stack/DB/socket decisions from section 0-3 above, so it stays the single source of truth across both phases.
- **`phases.md`** — append phases 9-15 below the existing 8 (don't renumber the old ones):

```
- [ ] Phase 9: Backend scaffold (Express + Socket.io on Render) + DB setup (Neon) + health endpoint
- [ ] Phase 10: Core API — players, tournaments, matches, day tables, scorekeeper-only write access
- [ ] Phase 11: Live share link — share_slug generation, /live/[slug] read-only page, Socket.io realtime
- [ ] Phase 12: Frontend migration — Zustand becomes an optimistic cache in front of the API, retry queue for offline/sleeping-backend writes
- [ ] Phase 13: History & leaderboard backend — filterable /history and /leaderboard queries, day_results logging
- [ ] Phase 14: History & leaderboard frontend — History tab (Log | Leaderboards), filter UI, separated leaderboard cards
- [ ] Phase 15: Keep-alive + deploy — Render env vars, UptimeRobot monitor, Vercel env vars pointing at the Render API, end-to-end test
```

- **`review.md`** — keep appending the same `Built / Verified / Deviations / Open issues` entry format, continuing the numbering from Phase 8.

---

## 8. Step-by-Step Prompt (paste into Antigravity, continuing from Phase 1)

Each stage should start by reading `architecture.md` and the latest `review.md` entry, and end by ticking `phases.md` + appending a `review.md` entry — same discipline as Phase 1.

**Stage 9 — Backend scaffold**

> Create a separate `backend/` project: Node.js + Express + TypeScript + Socket.io. Add a Postgres connection using `DATABASE_URL` (will point at Neon, not Render's own Postgres). Create the schema from section 2 of this spec via a migration file. Add `GET /health` returning `{status:"ok"}`. Set up `.env.example` with `DATABASE_URL` and `PORT`. Deployable to Render as a standalone web service, separate from the Vercel frontend.

**Stage 10 — Core API**

> Implement the REST endpoints in section 3 for players, tournaments, and matches, with the scorekeeper-only write endpoints protected by a single shared-secret header (simple PIN/token check, no full auth system). `PATCH` endpoints recompute points using the exact same logic already defined in `architecture.md` (round-robin thresholds, final points added onto the tournament total) — do not reimplement the scoring rules differently on the backend; port the existing `lib/scoring.ts` logic directly.

**Stage 11 — Live share link**

> Add `share_slug` generation (nanoid) on tournament creation. Implement Socket.io: a `tournament:<slug>` room, broadcasting `tournament:update` on every match/final write. On the frontend, add a Share button on the `Play` screen (copy link + QR code) and build `app/live/[slug]/page.tsx` — a read-only version of the Fixtures/Table view (no ScoreInput, no edit affordances) that subscribes via Socket.io with a 5s polling fallback if the socket drops.

**Stage 12 — Frontend migration to the backend**

> Change the Zustand store so writes go optimistic-local-first (instant UI update + localStorage) then sync to the backend API in the background with a retry queue — if a write fails (backend asleep/waking, network drop), queue it and retry with backoff, never block the UI. Add a small unobtrusive "syncing…" indicator. Confirm the app is still fully usable mid-match even if Render is momentarily waking up from sleep.

**Stage 13 — History & leaderboard backend**

> Implement `GET /history` and `GET /leaderboard` with the filters from section 3 (date range, player, score pattern, sort metric). Implement `day_results` logging: when the last tournament of a day closes, write the top/bottom player of that day's `day_tables.totals` into `day_results`. Implement `GET /day-results` returning all-time counts per player.

**Stage 14 — History & leaderboard frontend**

> Add a third bottom tab `History` with a `Log | Leaderboards` segmented control (same swipeable pattern as the existing `Fixtures | Table` control). `Log`: filter bar (date range / player / score pattern), collapsible day → tournament → match grouping, inline summed leaderboard header for the current filter. `Leaderboards`: two visually separate cards — Overall Leaderboard (points/matches toggle) and Day Champions / Day Last Place (from `/day-results`), clearly distinct sections, not merged into one table.

**Stage 15 — Keep-alive + deploy**

> Deploy `backend/` to Render as a web service with `DATABASE_URL` pointing at a Neon Postgres instance. Set up a free UptimeRobot or cron-job.org monitor hitting `/health` every 5 minutes. Update the Vercel frontend's env vars to point at the Render backend's URL and the Socket.io endpoint. Do a full end-to-end test: create a tournament, share the link, confirm a second device sees live updates, let the backend sleep once and confirm a write still succeeds after it wakes (no data loss), then check `/live/[slug]`, `History`, and the Day Champions leaderboard all reflect it correctly.

---

## 9. One more thing worth deciding up front

Free-tier Neon Postgres and free Render web services are both generous but not unlimited — fine for a friend-group app playing a few hours a day, but worth knowing the free-tier limits (connection counts, storage caps, monthly compute hours) before you're mid-tournament and hit one. Worth a quick check of current limits on Neon's and Render's pricing pages before Stage 9, since free-tier terms shift over time and I'd rather you confirm the current numbers than rely on my memory of them.