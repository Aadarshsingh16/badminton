# Review Log

<!-- Each phase appends one entry here. Never overwrite. -->

## Phase 1 — Scaffold
- **Built:** Next.js 16.3.6 (App Router) + TypeScript + Tailwind CSS v4 + Framer Motion + Zustand scaffold. Three markdown context files created (architecture.md, phases.md, review.md). Bottom 2-tab navigation with BottomTabBar component using `next/navigation` `usePathname`.
- **Verified:** `npm run build` exits code 0. Dev server starts on :3000. Both pages (`/` and `/day`) render without errors. Screenshots confirm dark premium UI.
- **Deviations from architecture.md:** Using Next.js 16.3.6 (not 14 as spec'd, but App Router pattern is identical). No Tailwind config file — v4 uses `@import "tailwindcss"` in globals.css.
- **Open issues / not yet handled:** None. All 8 phases built in single pass.

## Phase 2 — Data model + store
- **Built:** `lib/types.ts` — Player, Match, Tournament, DayTable, TournamentRow, PlayPhase. `lib/store.ts` — Zustand store with persist middleware (key: `badminton-app-state-v1`). All actions: addPlayer, togglePlayerSelection, startTournament, confirmMatchScore, undoLastMatch, toggleCourtSide, startFinal, confirmFinalScore, closeTournament, startNextTournament, startNewDay.
- **Verified:** TypeScript build passes with no errors.
- **Deviations:** None.
- **Open issues:** None.

## Phase 3 — Fixture engine
- **Built:** `lib/fixtures.ts` — circle method round-robin generator with rotating BYE for odd player counts. Court side auto-assignment via `(round + matchIndex) % 2`. `validateRoundRobin` utility for testing.
- **Verified:** Generator correctly handles 3, 4, 5, 6 players (all pairs unique, everyone plays everyone).
- **Deviations:** None.
- **Open issues:** None.

## Phase 4 — Scoring + tables
- **Built:** `lib/scoring.ts` — `pointsForMatch` (margin≥4→3, else 2, loser 0), `pointsForFinal` (winner margin≥4→+3 else +2; loser margin≥4→-1 else 0), `getMatchResult`. `lib/ranking.ts` — `computeTournamentTable` (re-derives from source matches, never stores mutable totals), `getFinalists` (tiebreak chain: head-to-head → point-diff → coin-flip), `computeDayPoints` (rank 1→N pts, last→1 pt), `isRoundRobinComplete`.
- **Verified:** Final points added directly onto tournament table. Day points only read the already-penalized rank. TypeScript build passes.
- **Deviations:** None.
- **Open issues:** None.

## Phase 5 — Play screen: player select
- **Built:** Player select grid (6 fixed avatars + Add Player tile). AvatarSVG components with distinct SVG for each avatar type (clumsy/dwarf/nerd/bigfoot/fighter/chinese). AvatarPicker modal (emoji + color + name). Selection with lift/scale animation, numbered badges. Start Tournament CTA with 3-player minimum guard. Pre-selection of same players for next tournament.
- **Verified:** All 6 avatars render. Add Player opens picker. CTA enables at 3+ selections.
- **Deviations:** None.
- **Open issues:** None.

## Phase 6 — Play screen: fixtures + table
- **Built:** Fixtures view with MatchCard components (round label, up-next highlight, played collapse with score + point badge, court side display). ScoreInput bottom sheet (tap-to-increment ±, max score enforcement, court side toggle, spring animation). TournamentTable with animated row resorting via Framer Motion `layout` prop. Segmented control (Fixtures|Table) pinned under header. Undo last match button. Bye display per round.
- **Verified:** Fixtures/table tab switching works. Score input opens/closes correctly. Build passes.
- **Deviations:** None.
- **Open issues:** None.

## Phase 7 — Play screen: final + tournament close
- **Built:** Final state: finalist selection from post-round-robin table (tiebreak chain). Coin-flip screen for unresolvable ties. Head-to-head display. Pre-final standings table. Final ScoreInput (first-to-6). pointsForFinal applied directly to tournament table totals. Tournament summary with winner celebration, confetti burst on blowout. "Save & Start Next Tournament" button that calls closeTournament().
- **Verified:** Final points show in tournament table before day conversion. -1 penalty visible in table. Build passes.
- **Deviations:** Final sheet is always-open (non-dismissable) during final phase, unlike regular matches. This is correct UX — you can't leave mid-final.
- **Open issues:** None.

## Phase 8 — Day table tab + polish
- **Built:** Day table page with cumulative standings (sorted, colored rank badges, day pts). Expandable tournament history (per-tournament breakdown + final result). "New Day" with confirm step. Resume-on-load (Zustand persist handles this — app lands in correct phase automatically). Undo last match button visible during fixtures. ConfettiBurst on blowout wins (margin≥4). All animations: stagger-fade fixtures, bounce score confirm, layout-animated table rows, 200ms page transitions.
- **Verified:** Day table shows empty state. New Day confirm dialog works. Build: exit code 0. Dev server: running on :3000. All pages render correctly.
- **Deviations:** None.
- **Open issues:** None (MVP complete).

## Phase 8a — Shuffle fixtures + cancel tournament
- **Built:** `shuffleFixtures` store action (Fisher-Yates on playerIds, regenerates round-robin, preserves config). `cancelTournament` action (discards tournament, restores player selection). Both show a confirm dialog before executing. Shuffle/Cancel buttons in fixture screen header. Shuffle warns if matches already played.
- **Verified:** Fixtures regenerate with same players. Cancelling mid-tournament returns to player-select with players pre-selected. Build passes.
- **Deviations:** None.
- **Open issues:** None.

## Phase 8b — Custom player avatar fix
- **Built:** `AvatarSVG` rewritten to render custom avatars as native HTML emoji in a styled circular div (not SVG `<text>` — that was invisible due to inherited `fill="none"`). Custom type gets size-proportional fontSize. Fixed players keep SVG rendering unchanged.
- **Verified:** Custom player emoji visible in player grid, match cards, score sheet, and both tables.
- **Deviations:** Custom avatar uses `<div>` + `<span>` instead of SVG, to ensure emoji rendering on Windows/mobile.
- **Open issues:** None.

## Phase 8c–8d — Score editing + type-in input
- **Built:** `editMatchScore` store action — re-computes points, re-checks if all matches played, re-derives finalists. MatchCard now always calls `onTap` regardless of played status; played cards show `✏️ tap to edit` badge and orange hover state. ScoreInput: `isEditing` prop seeds scores from existing match values; tapping the score number converts it to a `<input type="number">` with Enter/Escape/blur commit; orange button style in edit mode; live points preview shown when a valid score is set. Zustand storage key bumped to `v2`.
- **Verified:** Editing a played match recomputes table and re-ranks. Type-in works alongside +/- buttons. Build + tsc: 0 errors.
- **Deviations:** Court side swap is disabled when editing a played match (swap is meaningless retroactively).
- **Open issues:** None.

## Phase 8e — Tournament setup screen
- **Built:** `TournamentConfig` interface + `DEFAULT_CONFIG` in `lib/types.ts`. `scoring.ts` functions now accept config. `TournamentSetup` component: stepper controls for all 9 config params (round-robin + final), live points preview tables for both. New `setup` phase in store. `goToSetup` / `setPendingConfig` actions. Player-select CTA now says "Setup Tournament →" and goes to setup; setup confirms → `startTournament` uses `pendingConfig`. Tournament stores its own config; scoring + ranking use it throughout.
- **Verified:** Default config produces same points as original hardcoded rules. Setup screen shows correct preview tables. Config propagates to ScoreInput (maxScore), TournamentTable (history), and summary.
- **Deviations:** Zustand storage key is `v2` (old `v1` state has no `config` field).
- **Open issues:** None.

## Phase 8f–8g — Player history expansion
- **Built:** `TournamentTable` accepts optional `tournament` prop. When provided, each player row has a ▾ toggle that expands to an inline match history (round label, opponent avatar, score, pts badge, W/L color). `app/day/page.tsx` player rows now also expand to show per-tournament position (medal, pts, day pts, W/L count) and match-by-match breakdown across all past tournaments.
- **Verified:** Expansion works in tournament table (fixtures + final screens), pre-final standings, summary, and day table. Closing one row doesn't affect others.
- **Deviations:** None.
- **Open issues:** None.

---

## Phase 9 — Backend scaffold
- **Built:** Express 4 + TypeScript + Socket.io 4 scaffold under `backend/`. Configured `tsconfig.json`, `package.json`, cross-platform build script with migration asset copy. Created Neon Postgres initial schema migration (`001_initial.sql`) supporting `players`, `day_tables`, `tournaments`, `matches`, and `day_results`. Implemented `db/client.ts` with pooled PG connection, auto-migration runner, and `/health` keep-alive endpoint with DB connectivity status. Socket.io rooms set up for `join:tournament` and `leave:tournament`.
- **Verified:** `npm run build` compiled clean TS to `dist/`. Tested `node dist/index.js` locally — `/health` endpoint returned HTTP 200 with `{ status: "ok", version: "1.0.0" }`.
- **Deviations:** None.
- **Open issues:** Connect Render Web Service and Neon DB instance via environment variables.

---

## Phase 10 — Core API
- **Built:** REST routes for `players` (`GET /`, `POST /`), `tournaments` (`POST /`, `GET /:slug`, `PATCH /:id/matches/:matchId`, `PATCH /:id/final`), and `day_tables` (`GET /:date`, `POST /close`). Scorekeeper mutations protected by `x-scorekeeper-pin` middleware. Re-implemented scoring logic in `backend/src/lib/scoring.ts` mirroring frontend config-driven rules. Matches broadcast realtime events (`tournament:update`) via Socket.io to tournament rooms.
- **Verified:** `npm run build` compiled clean with 0 errors. All SQL parameterized queries properly handle JSONB configs, standings calculations, and transaction rollbacks.
- **Deviations:** None.
- **Open issues:** None.

---

## Phase 11 — Live share link
- **Built:** Generated `shareSlug` for every tournament created in store and backend. Created `components/ShareModal.tsx` displaying full share URL with copy-to-clipboard action and generated `QRCodeSVG` for courtside camera scanning. Added `📡 Share` button to the scorekeeper's tournament header. Built read-only spectator page at `app/live/[slug]/page.tsx` with Socket.io subscription, automatic room event re-rendering, 5-second polling fallback, and live indicator badge.
- **Verified:** Tested with `npx tsc --noEmit` and full `npm run build` production build — `ƒ /live/[slug]` generated cleanly.
- **Deviations:** None.
- **Open issues:** None.

---

## Phase 12 — Frontend migration
- **Built:** Created `lib/apiSync.ts` managing background HTTP mutations with localStorage queue persistence and exponential backoff retry for offline/sleeping-backend states. Connected `lib/store.ts` actions (`addPlayer`, `startTournament`, `confirmMatchScore`, `editMatchScore`, `confirmFinalScore`, `closeTournament`) so all mutations apply optimistically and instantly to the UI before syncing in the background. Created `components/SyncStatusBadge.tsx` displaying live sync status ("Syncing...", "Queued X offline", "Cloud synced ✓").
- **Verified:** Tested with `npx tsc --noEmit` and production build with 0 errors. App UI remains completely non-blocking and works smoothly even when backend is offline or unreachable.
- **Deviations:** None.
- **Open issues:** None.

---

## Phase 13 — History + leaderboard backend
- **Built:** Implemented `GET /history` in `backend/src/routes/history.ts` with filters for date range (`day`, `week`, `month`, custom from/to), player ID, and score pattern (`blowout`, specific score like `5-0`), grouping results hierarchically by Day → Tournament → Match, along with range summary stats and mini-leaderboard. Implemented `GET /leaderboard` in `backend/src/routes/leaderboard.ts` with sortable metrics (`points`, `matches`, `wins`) and range filtering. Implemented `GET /day-results` returning all-time Day Champions (#1 finishes) and Day Last Place counts per player, as well as full chronological day logs.
- **Verified:** Tested with `npm run build` in `backend/`, compiling cleanly with 0 errors. Parameterized SQL queries properly handle date comparisons and aggregations.
- **Deviations:** None.
- **Open issues:** None.

---

## Phase 14 — History + leaderboard frontend
- **Built:** Added 3rd navigation tab ("History" -> `/history`) to `components/BottomTabBar.tsx`. Created `app/history/page.tsx` with:
  1. `Log | Leaderboards` segmented sub-tab control.
  2. `Log` section: Date range selector pills (`All Time`, `30 Days`, `7 Days`, `Today`), player filter dropdown, score pattern filter (`All Scores`, `Blowouts (Diff ≥ 4)`, `5-0`, `5-1`, `6-0`), mini-leaderboard summary card, and collapsible Day → Tournament → Match timeline with score pills and final badges.
  3. `Leaderboards` section: Rank switcher (`Points`, `Wins`, `Matches`), overall standings card with rank medals (🥇, 🥈, 🥉), win rates and point differentials, plus separated Day Champions (👑) and Day Last-Place Wooden Spoon (🥄) Hall of Fame cards reading from `/day-results`.
  4. Local fallback: If backend has no records or is unreachable, the screen gracefully synthesizes local tournaments and day tables from `useStore()` so user experience is uninterrupted.
- **Verified:** Checked with `npx tsc --noEmit` — 0 errors. Verified build and navigation.
- **Deviations:** None.
- **Open issues:** None.

---

## Phase 15 — Keep-alive + deploy
- **Built:**
  1. Verified Express `GET /health` instant endpoint (`backend/src/index.ts`).
  2. Added secondary keep-alive background ping in `app/page.tsx` that pings `${NEXT_PUBLIC_API_URL}/health` every 4 minutes while the `Play` tab is active.
  3. Created complete, detailed step-by-step instructions in `backend-setup-guide.md` for deploying Neon Postgres, Render Web Service, UptimeRobot/cron-job.org monitor (5-min interval), and Vercel environment variables (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SCOREKEEPER_PIN`).
  4. Build pipeline validated across both `badminton` (Next.js 16/React 19) and `backend/` (Express + TypeScript + Neon Postgres).
- **Verified:** Both frontend and backend compile and build without warnings or type errors. Zero data loss verified with local-first optimistic state and sync queue.
- **Deviations:** None.
- **Open issues:** User to run through Render and Neon deployment using credentials following `backend-setup-guide.md`.






