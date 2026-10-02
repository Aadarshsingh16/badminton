# Architecture

## Stack

### Frontend (Live)
Next.js 16.3.6, App Router, TypeScript, Tailwind CSS v4, Framer Motion, Zustand + persist (localStorage). Deployed on Vercel.

### Backend (Phase 2 — Planned)
Node.js + Express + TypeScript + Socket.io. Deployed on **Render** (persistent server, supports long-lived WebSocket connections). Database: **Neon** (serverless Postgres, permanent free-tier — Render's own free Postgres is NOT used because it deletes after 90 days).

```
┌─────────────┐       REST + WebSocket       ┌──────────────┐      Postgres       ┌─────────────┐
│   Vercel     │ ──────────────────────────▶  │    Render     │ ──────────────────▶ │    Neon     │
│  (Next.js    │ ◀────────────────────────── │ (Express +    │ ◀────────────────── │  (Postgres) │
│  frontend)   │      live score updates      │  Socket.io)   │                     │             │
└─────────────┘                               └──────────────┘                     └─────────────┘
       ▲
       │ GET /live/[slug] — read-only, no auth, Socket.io subscribe
   friends' phones
```

## Folder Structure

### Frontend (`/` — root of this repo)
```
badminton/
├── app/
│   ├── layout.tsx          # Root layout with bottom tab bar (2 tabs → 3 tabs in Phase 14)
│   ├── page.tsx            # Play tab — context-aware (player-select / setup / fixtures / final / summary)
│   ├── day/page.tsx        # Day Table tab — cumulative standings + per-player history
│   └── live/[slug]/        # Phase 11: read-only live share page
├── components/
│   ├── avatars/            # SVG/emoji avatar components
│   │   └── AvatarSVG.tsx
│   ├── AvatarPicker.tsx    # Modal: pick emoji + color for custom player
│   ├── MatchCard.tsx       # Fixture card — tappable (new + played for editing)
│   ├── ScoreInput.tsx      # Bottom sheet — +/- buttons AND type-in input, edit mode
│   ├── TournamentTable.tsx # Live standings + expandable per-player match history
│   ├── TournamentSetup.tsx # Pre-tournament config screen (win score, points, bonus rules)
│   └── ConfettiBurst.tsx   # Blowout celebration
├── lib/
│   ├── types.ts            # TypeScript interfaces (Player, Match, Tournament, TournamentConfig, DayTable …)
│   ├── fixtures.ts         # Round-robin generator (circle method)
│   ├── scoring.ts          # Config-driven points logic
│   ├── store.ts            # Zustand store + persist (key: badminton-app-state-v2)
│   └── ranking.ts          # Tiebreaks, day-table conversion
└── public/
```

### Backend (`/backend/` — created in Phase 9)
```
backend/
├── src/
│   ├── index.ts            # Express app entry, Socket.io setup
│   ├── routes/
│   │   ├── health.ts
│   │   ├── players.ts
│   │   ├── tournaments.ts
│   │   ├── matches.ts
│   │   ├── dayTables.ts
│   │   ├── history.ts
│   │   └── leaderboard.ts
│   ├── db/
│   │   ├── client.ts       # Postgres (pg) connection using DATABASE_URL
│   │   └── migrations/
│   │       └── 001_initial.sql
│   ├── socket/
│   │   └── events.ts       # tournament:<slug> room, tournament:update event
│   └── middleware/
│       └── auth.ts         # Shared-secret PIN check for write endpoints
├── .env.example
├── package.json
└── tsconfig.json
```

## Data Model (Frontend / lib/types.ts — current)

```typescript
export type AvatarType = "clumsy" | "nerd" | "bigfoot" | "dwarf" | "fighter" | "chinese" | "custom";

export interface Player {
  id: string;
  name: string;
  avatar: AvatarType;
  avatarColor?: string;
  avatarEmoji?: string;
}

// Configurable per-tournament scoring rules (Phase 8e addition)
export interface TournamentConfig {
  winScore: number;          // default 5
  bonusMargin: number;       // default 4 (margin >= this → bonus)
  winPoints: number;         // default 2
  bonusPoints: number;       // default 1 (total win = 3)
  finalWinScore: number;     // default 6
  finalBonusMargin: number;  // default 4
  finalWinBase: number;      // default 2
  finalWinBonus: number;     // default 1
  finalLoserPenalty: number; // default -1
}

export interface Match {
  id: string;
  round: number;
  playerA: string;
  playerB: string;
  courtSide: { [playerId: string]: 1 | 2 };
  scoreA?: number;
  scoreB?: number;
  played: boolean;
  pointsAwarded?: { [playerId: string]: number };
}

export interface Tournament {
  id: string;
  createdAt: number;
  playerIds: string[];
  matches: Match[];
  byes: { [round: number]: string | null };
  final?: Match;
  finalistIds?: [string, string];
  closed: boolean;
  dayPointsAwarded?: { [playerId: string]: number };
  config: TournamentConfig;   // per-tournament scoring rules
}

export interface DayTable {
  date: string;
  tournaments: string[];
  totals: { [playerId: string]: number };
}

export type PlayPhase =
  | "player-select"
  | "setup"              // tournament config screen (Phase 8e)
  | "fixtures"
  | "final"
  | "tournament-summary";
```

## Database Schema (Postgres — Neon, Phase 9)

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
  share_slug text unique not null,       -- random slug for /live/[slug]
  day_id uuid references day_tables(id),
  player_ids uuid[] not null,
  status text not null,                  -- 'active' | 'final' | 'completed'
  config jsonb not null,                 -- TournamentConfig serialized
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
  court_side jsonb,
  score_a int, score_b int,
  points_a int, points_b int,
  played boolean default false,
  played_at timestamptz
)

day_tables (
  id uuid primary key,
  date date unique not null,
  closed boolean default false,
  totals jsonb,
  closed_at timestamptz
)

day_results (
  id uuid primary key,
  day_table_id uuid references day_tables(id),
  date date not null,
  top_player_id uuid references players(id),
  bottom_player_id uuid references players(id)
)
```

## Core Scoring Rules (Do Not Deviate Without Updating This File)

### Round-Robin (config-driven since Phase 8e)
- Circle method: fix player[0], rotate the rest clockwise each round
- Even N → N-1 rounds, N/2 matches/round | Odd N → rotating BYE slot
- Every player plays every other player exactly once
- Court sides: `(round + matchIndexInRound) % 2`
- **Points:** Win margin ≥ `bonusMargin` → `winPoints + bonusPoints`; else → `winPoints`. Loser always 0.
- **Default config:** first-to-5, margin≥4→3pts, margin<4→2pts

### Final (config-driven)
- First to `finalWinScore` (default 6)
- Winner: margin ≥ `finalBonusMargin` → `finalWinBase + finalWinBonus`; else → `finalWinBase`
- Loser: margin ≥ `finalBonusMargin` → `finalLoserPenalty` (default -1); else → 0
- Final points ADDED ONTO each finalist's round-robin total in the tournament table

### Tiebreaks for Top-2 Finalists
1. Head-to-head result 2. Point-difference 3. Coin-flip prompt in-app

### Day Table Conversion
- After close: sort N players by tournament total → rank 1..N → day pts = N - rank + 1
- Day Table NEVER re-applies scoring — reads already-penalized rank only
- Tournament table resets per tournament; Day Table persists until "New Day"

## API Design (Phase 10)

| Method & path | Access | Purpose |
|---|---|---|
| `GET /health` | public | keep-alive ping |
| `POST /players` | scorekeeper | create custom player |
| `GET /players` | public | list all players |
| `POST /tournaments` | scorekeeper | create tournament, returns share_slug + fixtures |
| `GET /tournaments/:slug` | public | read-only tournament state (powers /live/[slug]) |
| `PATCH /tournaments/:id/matches/:matchId` | scorekeeper | submit score, broadcast socket update |
| `PATCH /tournaments/:id/final` | scorekeeper | submit final, close tournament, update day table |
| `GET /day-tables/:date` | public | one day's cumulative table |
| `GET /history` | public | filterable log (range, player, scorePattern) |
| `GET /leaderboard` | public | overall leaderboard (sortBy=points\|matches + range) |
| `GET /day-results` | public | all-time Day Champions / Last Place counts |

**Socket.io:** `tournament:<slug>` room → emits `tournament:update` (match/final scored), `tournament:closed` (day updated). 5s polling fallback on `/tournaments/:slug` if socket drops.

## Access Model (Phase 10)
- No login system. Scorekeeper identifies via a **shared-secret PIN** in a request header (`X-Scorekeeper-Token`). PIN stored in browser localStorage once entered.
- Everyone else: read-only via `/live/[slug]` or any `GET` endpoint — no header needed.

## Keep-Alive Strategy (Phase 15)
1. `GET /health` returns `{ status: "ok" }` instantly (no DB call)
2. External monitor (**UptimeRobot** or **cron-job.org**, free) pings `/health` every 5 minutes 24/7
3. Frontend `setInterval` pings `/health` while Play tab is mounted — harmless secondary layer, NOT the primary keep-alive

## Navigation Model (Phase 14 target)
- **3 bottom tabs:** `Play`, `Day Table`, `History`
- **Play tab** — context-aware state machine (player-select → setup → fixtures → final → summary)
- **History tab** — `Log | Leaderboards` segmented control
- Fixtures ↔ Table: segmented control pinned under header (no route change)

## Persistence
- **Phase 1–2:** Zustand persist → localStorage key: `badminton-app-state-v2`
- **Phase 12 target:** Zustand stays as optimistic cache; writes sync to backend API in background with retry queue

## Frontend-Only Safety Net (guaranteed no data loss)
Every score entry writes to local state + localStorage **immediately and optimistically**. Backend sync is background-only. If Render is sleeping/waking or signal drops mid-court, scoring continues uninterrupted — queued writes retry with backoff once connection returns.
