# Build Phases

## Phase 1 (Frontend — Complete)

- [x] Phase 1: Scaffold
- [x] Phase 2: Data model + store
- [x] Phase 3: Fixture engine
- [x] Phase 4: Scoring + tables
- [x] Phase 5: Play screen — player select
- [x] Phase 6: Play screen — fixtures + table
- [x] Phase 7: Play screen — final + tournament close
- [x] Phase 8: Day table tab + polish

## Phase 1 Additions (Post-MVP — Complete)

- [x] Phase 8a: Shuffle fixtures + cancel tournament
- [x] Phase 8b: Custom player avatar fix (emoji visible in card)
- [x] Phase 8c: Score editing — tap any played match to re-enter score, table re-syncs
- [x] Phase 8d: Type-in scores — tap score number to open numeric input (alongside +/-)
- [x] Phase 8e: Tournament setup screen — configure win score, bonus margin, points, final rules before each tournament
- [x] Phase 8f: Player match history — expand any player row in tournament table to see per-match breakdown
- [x] Phase 8g: Player day history — expand any player in day table to see per-tournament rank + match history

## Phase 2 (Backend + Live Share + History — Planned)

- [ ] Phase 9:  Backend scaffold — Express + TypeScript + Socket.io on Render, Neon Postgres schema + migration, `GET /health` keep-alive endpoint
- [ ] Phase 10: Core API — players, tournaments, matches, day tables; scorekeeper-only writes via shared-secret PIN header
- [ ] Phase 11: Live share link — `share_slug` generation, `/live/[slug]` read-only page, Socket.io room broadcast + 5s polling fallback
- [ ] Phase 12: Frontend migration — Zustand becomes optimistic cache + background sync, retry queue for offline/sleeping-backend writes, "syncing…" indicator
- [ ] Phase 13: History + leaderboard backend — `/history` (filterable), `/leaderboard`, `day_results` logging on day close
- [ ] Phase 14: History + leaderboard frontend — 3rd "History" tab with `Log | Leaderboards` segmented control, filter bar, collapsible timeline, two separate leaderboard cards
- [ ] Phase 15: Keep-alive + deploy — Render env vars, UptimeRobot/cron-job.org monitor, Vercel env vars, end-to-end test
