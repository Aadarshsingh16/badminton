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

## Phase 9 — Backend scaffold (NEXT UP)
- **Status:** Not started. Awaiting service setup (Render account + Neon account).
- **See setup guide:** `backend-setup-guide.md` in this repo root.
- **Built:** —
- **Verified:** —
- **Deviations:** —
- **Open issues:** Free-tier limits on Neon Postgres and Render web services should be confirmed before starting (see note in `badminton-app-backend-expansion-spec.md` §9).

