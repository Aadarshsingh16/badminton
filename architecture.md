# Architecture

## Stack
Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion, Zustand + persist (localStorage). No backend.

## Folder Structure
```
badminton-app/
├── app/
│   ├── layout.tsx          # Root layout with bottom tab bar
│   ├── page.tsx            # Play tab — context-aware (player-select / fixtures / final)
│   └── day/page.tsx        # Day Table tab
├── components/
│   ├── avatars/            # SVG/emoji avatar components + AvatarPicker
│   ├── PlayerCard.tsx
│   ├── MatchCard.tsx
│   ├── ScoreInput.tsx
│   ├── CourtSideToggle.tsx
│   ├── TournamentTable.tsx
│   ├── DayTable.tsx
│   └── ConfettiBurst.tsx
├── lib/
│   ├── types.ts            # TypeScript interfaces
│   ├── fixtures.ts         # Round-robin generator (circle method)
│   ├── scoring.ts          # Points logic
│   ├── store.ts            # Zustand store + persist middleware
│   └── ranking.ts          # Tiebreaks, day-table conversion
└── public/
```

## Data Model
```typescript
export type AvatarType = "clumsy" | "nerd" | "bigfoot" | "dwarf" | "fighter" | "chinese" | "custom";

export interface Player {
  id: string;
  name: string;
  avatar: AvatarType;
  avatarColor?: string;   // for custom players
  avatarEmoji?: string;   // for custom players
}

export interface Match {
  id: string;
  round: number;
  playerA: string;        // player id
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
}

export interface DayTable {
  date: string;           // e.g. "2026-09-27"
  tournaments: string[];  // tournament ids played that day
  totals: { [playerId: string]: number };
}
```

## Core Rules (Do Not Deviate Without Updating This File)

### Round-Robin
- Circle method: fix player[0], rotate the rest clockwise each round
- Even N → N-1 rounds, N/2 matches/round, nobody sits out
- Odd N → add virtual "BYE" slot making it even; whoever draws BYE sits out; rotate so byes spread evenly
- Every player plays every other player exactly once
- Court sides auto-assigned alternating: `(round + matchIndexInRound) % 2`

### Match Points (Round-Robin)
- Win margin ≥ 4 (e.g. 5-0, 5-1) → **3 points**
- Any smaller winning margin (5-2, 5-3, 5-4) → **2 points**
- Loser always **0 points**
- First to 5 points wins a round-robin match

### Final Points
- Final is first-to-6
- Winner with margin ≥ 4 → **+3**; winner with smaller margin → **+2**
- Loser with margin ≥ 4 → **-1**; loser with smaller margin → **0**
- Final points are ADDED DIRECTLY ONTO each finalist's tournament-table total
- The Tournament Table (including final) is the single source of truth

### Tiebreaks for Top-2 Finalists
1. Head-to-head result between tied players
2. Point-difference in all matches played
3. Coin-flip prompt shown in-app

### Day Table Conversion
- After tournament closes: sort all N players by final tournament-table total → rank 1..N
- Day points = N - rank + 1 (rank 1 = N points, last = 1 point)
- Day Table NEVER re-applies any penalty — it only reads the rank the tournament table already produced
- Tournament table resets per tournament; Day Table persists until "New Day"

## Navigation Model
- **2 bottom tabs** (always visible): `Play` and `Day Table`
- **Play tab** is context-aware — one screen driven by state:
  - No active tournament → Player Select grid
  - Round-robin in progress → Fixtures + Live Table (segmented control)
  - Round-robin complete → Final match screen
  - Final complete → Tournament Summary + "Start Next Tournament"
- **Fixtures ↔ Table**: swipeable segmented control pinned under header, NOT separate routes
- **No back-button/navigation-stack confusion** — everything is state transitions, not page navigations

## Persistence
- Zustand persist middleware → localStorage key: `badminton-app-state-v1`
- Every action auto-writes; no manual save needed
- On app load: if open tournament in localStorage → resume directly into correct Play state

## Extras
- Undo last match: pop last played match back to unplayed, recompute table
- Resume session on load: skip player-select if active tournament exists
- State blob is plain JSON (no images) — trivially small even after full day
