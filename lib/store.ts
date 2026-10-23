// lib/store.ts — Zustand store with localStorage persistence

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Player,
  Tournament,
  DayTable,
  CompletedDaySummary,
  Match,
  PlayPhase,
  TournamentConfig,
  DEFAULT_CONFIG,
} from "./types";
import {
  generateRoundRobin,
  generateDoubleElimination,
  advanceDoubleElimination,
  isDoubleEliminationComplete,
} from "./fixtures";
import { pointsForMatch, pointsForFinal } from "./scoring";
import { computeDayPoints, isRoundRobinComplete, getFinalists, isTournamentComplete } from "./ranking";
import { apiSync } from "./apiSync";

export type AppRole = 'admin' | 'viewer' | null;

// Fixed players (the 7 friends)
export const FIXED_PLAYERS: Player[] = [
  { id: "adarsh", name: "Adarsh", avatar: "clumsy" },
  { id: "akshat", name: "Akshat", avatar: "dwarf" },
  { id: "harsh", name: "Harsh", avatar: "nerd" },
  { id: "udbhaw", name: "Udbhaw", avatar: "bigfoot" },
  { id: "anirudh", name: "Anirudh", avatar: "fighter" },
  { id: "gautam", name: "Gautam", avatar: "chinese" },
  { id: "sajal", name: "Sajal", avatar: "custom", avatarEmoji: "🦁", avatarColor: "#6C63FF" },
];

export const SAJAL_ALIASES = new Set([
  "custom-1791717061642",
  "custom-1791630401707",
  "custom-1791021029857",
  "custom-1791025802127",
  "custom-1790938366909",
]);

export function isSajalId(id: string | undefined | null): boolean {
  if (!id) return false;
  const lower = id.toLowerCase().trim();
  return lower === "sajal" || SAJAL_ALIASES.has(id) || SAJAL_ALIASES.has(lower);
}

export function normalizePlayerId(id: string): string {
  if (isSajalId(id)) return "sajal";
  return id;
}

export function migrateTournamentData(t: Tournament): Tournament {
  if (!t) return t;
  const migrated: Tournament = { ...t };

  // 1. Normalize playerIds
  if (Array.isArray(migrated.playerIds)) {
    migrated.playerIds = Array.from(new Set(migrated.playerIds.map(normalizePlayerId)));
  }

  // 2. Normalize matches
  if (Array.isArray(migrated.matches)) {
    migrated.matches = migrated.matches.map((m) => {
      const match = { ...m };
      match.playerA = normalizePlayerId(match.playerA);
      match.playerB = normalizePlayerId(match.playerB);
      if (match.courtSide) {
        const cs: { [pid: string]: 1 | 2 } = {};
        for (const [pid, side] of Object.entries(match.courtSide)) {
          cs[normalizePlayerId(pid)] = side;
        }
        match.courtSide = cs;
      }
      if (match.pointsAwarded) {
        const pa: { [pid: string]: number } = {};
        for (const [pid, pts] of Object.entries(match.pointsAwarded)) {
          const target = normalizePlayerId(pid);
          pa[target] = (pa[target] || 0) + pts;
        }
        match.pointsAwarded = pa;
      }
      return match;
    });
  }

  // 3. Normalize final
  if (migrated.final) {
    const f = { ...migrated.final };
    f.playerA = normalizePlayerId(f.playerA);
    f.playerB = normalizePlayerId(f.playerB);
    if (f.courtSide) {
      const cs: { [pid: string]: 1 | 2 } = {};
      for (const [pid, side] of Object.entries(f.courtSide)) {
        cs[normalizePlayerId(pid)] = side;
      }
      f.courtSide = cs;
    }
    if (f.pointsAwarded) {
      const pa: { [pid: string]: number } = {};
      for (const [pid, pts] of Object.entries(f.pointsAwarded)) {
        const target = normalizePlayerId(pid);
        pa[target] = (pa[target] || 0) + pts;
      }
      f.pointsAwarded = pa;
    }
    migrated.final = f;
  }

  // 4. Normalize dayPointsAwarded
  if (migrated.dayPointsAwarded && Object.keys(migrated.dayPointsAwarded).length > 0) {
    const dpa: { [pid: string]: number } = {};
    for (const [pid, pts] of Object.entries(migrated.dayPointsAwarded)) {
      const target = normalizePlayerId(pid);
      dpa[target] = (dpa[target] || 0) + pts;
    }
    migrated.dayPointsAwarded = dpa;
  } else {
    migrated.dayPointsAwarded = computeDayPoints(migrated);
  }

  return migrated;
}

export function migrateCompletedDayData(cd: CompletedDaySummary): CompletedDaySummary {
  if (!cd) return cd;
  const migrated: CompletedDaySummary = { ...cd };
  if (migrated.totals) {
    const totals: { [pid: string]: number } = {};
    for (const [pid, pts] of Object.entries(migrated.totals)) {
      const target = normalizePlayerId(pid);
      totals[target] = (totals[target] || 0) + pts;
    }
    migrated.totals = totals;
  }
  // Officially recorded database honors for past tournament dates
  if (migrated.date === "2026-10-10") {
    migrated.topPlayerId = "akshat";
    migrated.spoonPlayerId = "udbhaw";
  } else if (migrated.date === "2026-10-11") {
    migrated.topPlayerId = "akshat";
    migrated.spoonPlayerId = "sajal";
  } else if (migrated.date === "2026-10-18") {
    migrated.topPlayerId = "gautam";
    migrated.spoonPlayerId = "sajal";
  } else {
    if (migrated.topPlayerId) migrated.topPlayerId = normalizePlayerId(migrated.topPlayerId);
    if (migrated.spoonPlayerId) migrated.spoonPlayerId = normalizePlayerId(migrated.spoonPlayerId);
  }
  return migrated;
}

export function migrateDayTableData(dt: DayTable): DayTable {
  if (!dt) return dt;
  const migrated: DayTable = { ...dt };
  if (migrated.totals) {
    const totals: { [pid: string]: number } = {};
    for (const [pid, pts] of Object.entries(migrated.totals)) {
      const target = normalizePlayerId(pid);
      totals[target] = (totals[target] || 0) + pts;
    }
    migrated.totals = totals;
  }
  return migrated;
}

export const SESSION_TTL_MS = 5 * 60 * 60 * 1000; // 5 hours

export function isSessionExpired(sessionCreatedAt: number | null | undefined): boolean {
  if (!sessionCreatedAt) return true;
  return Date.now() - sessionCreatedAt > SESSION_TTL_MS;
}

interface AppState {
  // Session
  appRole: AppRole;
  appDate: string | null;
  sessionCreatedAt: number | null;
  setAppSession: (role: AppRole, date: string) => void;
  clearAppSession: () => void;

  // Players
  players: Player[];
  selectedPlayerIds: string[];

  // Active tournament
  currentTournament: Tournament | null;
  phase: PlayPhase;

  // Pending tournament config (set in 'setup' phase, used when startTournament is called)
  pendingConfig: TournamentConfig;

  // Coin flip state
  needsCoinFlip: boolean;
  coinFlipWinnerId: string | null;

  // Day table & archives
  dayTable: DayTable;
  pastTournaments: Tournament[];
  completedDays: CompletedDaySummary[];

  // Actions
  addPlayer: (player: Player) => void;
  togglePlayerSelection: (playerId: string) => void;
  clearSelection: () => void;

  // Called from player-select to move to setup screen
  goToSetup: () => void;
  setPendingConfig: (config: TournamentConfig) => void;

  startTournament: () => void;
  shuffleFixtures: () => void;
  cancelTournament: () => void;
  confirmMatchScore: (matchId: string, scoreA: number, scoreB: number) => void;
  editMatchScore: (matchId: string, scoreA: number, scoreB: number) => void;
  undoLastMatch: () => void;
  toggleCourtSide: (matchId: string) => void;

  startFinal: (coinFlipWinnerId?: string) => void;
  confirmFinalScore: (scoreA: number, scoreB: number) => void;

  closeTournament: () => void;
  deleteTournament: (id: string, skipSync?: boolean) => void;
  startNextTournament: () => void;
  startNewDay: (overrideTotals?: Record<string, number>, overrideTournaments?: string[]) => void;
  resetDayTable: (date?: string) => void;
  // UI state
  isScoreSheetOpen: boolean;
  setIsScoreSheetOpen: (open: boolean) => void;

  setPhase: (phase: PlayPhase) => void;
}

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function today(): string {
  return getLocalDateString();
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Re-compute points for a single match given a config */
function computeMatchPoints(
  match: Match,
  config: TournamentConfig
): { [id: string]: number } {
  const { playerA, playerB, scoreA, scoreB } = match;
  if (scoreA === undefined || scoreB === undefined) return {};
  const winScore = Math.max(scoreA, scoreB);
  const loseScore = Math.min(scoreA, scoreB);
  const winnerPts = pointsForMatch(winScore, loseScore, config);
  const winnerIsA = scoreA > scoreB;
  return {
    [playerA]: winnerIsA ? winnerPts : 0,
    [playerB]: winnerIsA ? 0 : winnerPts,
  };
}

const DELETED_TOURNAMENTS_KEY = "badminton_deleted_tournaments_v1";

export function getDeletedTournamentIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_TOURNAMENTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markTournamentDeleted(id: string) {
  if (typeof window === "undefined") return;
  try {
    const set = getDeletedTournamentIds();
    set.add(id);
    localStorage.setItem(DELETED_TOURNAMENTS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

const DELETED_DAYS_KEY = "badminton_deleted_days_v1";

export function getDeletedDayDates(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_DAYS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markDayDeleted(date: string) {
  if (typeof window === "undefined") return;
  try {
    const set = getDeletedDayDates();
    set.add(date);
    localStorage.setItem(DELETED_DAYS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

/**
 * Recovers tournaments from both permanent local archive and the pending sync queue.
 * Ensures data is never lost even if the store is wiped or page reloads offline.
 * Respects deleted tournament tombstones so deleted items are NEVER resurrected.
 */
export function recoverTournamentsFromSyncQueue(): Tournament[] {
  if (typeof window === "undefined") return [];
  const deletedIds = getDeletedTournamentIds();
  const tournamentsMap: { [id: string]: Tournament } = {};

  // 1. Read from permanent local archive if available
  try {
    const rawArchive = localStorage.getItem("badminton_archived_tournaments_v1");
    if (rawArchive) {
      const archived = JSON.parse(rawArchive);
      if (Array.isArray(archived)) {
        for (const t of archived) {
          if (t && t.id && !deletedIds.has(t.id)) {
            tournamentsMap[t.id] = t;
          }
        }
      }
    }
  } catch (e) {
    console.warn("Failed reading archived tournaments:", e);
  }

  // 2. Reconstruct any pending/recent tournaments from the sync queue
  try {
    const rawQueue = localStorage.getItem("badminton_sync_queue_v1");
    if (rawQueue) {
      const queue = JSON.parse(rawQueue);
      if (Array.isArray(queue)) {
        for (const item of queue) {
          if (item.method === "POST" && item.url.includes("/tournaments") && item.body) {
            const b = item.body;
            if (b.id && !deletedIds.has(b.id) && !tournamentsMap[b.id]) {
              tournamentsMap[b.id] = {
                id: b.id,
                createdAt: Date.now(),
                playerIds: b.playerIds || [],
                matches: (b.matches || []).map((m: any) => ({
                  ...m,
                  scoreA: m.scoreA,
                  scoreB: m.scoreB,
                  played: !!m.played,
                  courtSide: m.courtSide || { [m.playerA]: 1, [m.playerB]: 2 },
                })),
                byes: [],
                closed: true,
                shareSlug: b.shareSlug || "shared",
                config: b.config || DEFAULT_CONFIG,
              };
            }
          }
        }

        for (const item of queue) {
          if (item.method === "PATCH" && item.url.includes("/matches/") && item.body) {
            const parts = item.url.split("/matches/");
            const matchId = parts[1];
            const tourneyPart = parts[0].split("/tournaments/");
            const tId = tourneyPart[1];
            if (tId && tournamentsMap[tId]) {
              const t = tournamentsMap[tId];
              const m = t.matches.find((x) => x.id === matchId);
              if (m) {
                m.scoreA = item.body.scoreA;
                m.scoreB = item.body.scoreB;
                m.played = true;
                m.pointsAwarded = computeMatchPoints(m, t.config);
              }
            }
          } else if (item.method === "PATCH" && item.url.includes("/final") && item.body) {
            const tId = item.url.split("/tournaments/")[1]?.split("/final")[0];
            if (tId && tournamentsMap[tId]) {
              const t = tournamentsMap[tId];
              const b = item.body;
              const winScore = Math.max(b.scoreA, b.scoreB);
              const loseScore = Math.min(b.scoreA, b.scoreB);
              const winnerIsA = b.scoreA > b.scoreB;
              t.final = {
                id: `final-${tId}`,
                round: -1,
                isFinal: true,
                playerA: b.playerA,
                playerB: b.playerB,
                courtSide: { [b.playerA]: 1, [b.playerB]: 2 },
                scoreA: b.scoreA,
                scoreB: b.scoreB,
                played: true,
                pointsAwarded: { [b.playerA]: 0, [b.playerB]: 0 },
              };
            }
          } else if (item.method === "POST" && item.url.includes("/day-tables/close") && item.body) {
            const totals = item.body.totals;
            Object.values(tournamentsMap).forEach((t) => {
              if (!t.dayPointsAwarded && totals) {
                t.dayPointsAwarded = totals;
              }
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn("Failed to recover tournaments from sync queue:", e);
  }

  const list = Object.values(tournamentsMap).map(migrateTournamentData);
  if (list.length > 0) {
    try {
      localStorage.setItem("badminton_archived_tournaments_v1", JSON.stringify(list));
    } catch {}
  }
  return list;
}

/**
 * Recovers completed day history from permanent archive or sync queue.
 */
export function recoverCompletedDaysFromSyncQueue(): CompletedDaySummary[] {
  if (typeof window === "undefined") return [];
  const deletedDates = getDeletedDayDates();
  const daysMap: { [date: string]: CompletedDaySummary } = {};

  try {
    const rawArchive = localStorage.getItem("badminton_completed_days_v1");
    if (rawArchive) {
      const archived = JSON.parse(rawArchive);
      if (Array.isArray(archived)) {
        for (const d of archived) {
          if (d && d.date && !deletedDates.has(d.date)) daysMap[d.date] = d;
        }
      }
    }
  } catch {}

  try {
    const rawQueue = localStorage.getItem("badminton_sync_queue_v1");
    if (rawQueue) {
      const queue = JSON.parse(rawQueue);
      if (Array.isArray(queue)) {
        for (const item of queue) {
          if (item.method === "POST" && item.url.includes("/day-tables/close") && item.body) {
            const { date, totals } = item.body;
            if (date && totals && !deletedDates.has(date) && !daysMap[date]) {
              let topPlayerId: string | undefined;
              let spoonPlayerId: string | undefined;
              if (date === "2026-10-10") {
                topPlayerId = "akshat";
                spoonPlayerId = "udbhaw";
              } else if (date === "2026-10-11") {
                topPlayerId = "akshat";
                spoonPlayerId = "sajal";
              } else if (date === "2026-10-18") {
                topPlayerId = "gautam";
                spoonPlayerId = "sajal";
              } else {
                const sorted = Object.entries(totals).sort(([, a]: any, [, b]: any) => b - a);
                topPlayerId = sorted[0]?.[0];
                spoonPlayerId = sorted.length > 1 ? sorted[sorted.length - 1]?.[0] : undefined;
              }
              daysMap[date] = {
                date,
                totals,
                topPlayerId,
                spoonPlayerId,
                tournamentIds: [],
              };
            }
          }
        }
      }
    }
  } catch {}

  const result = Object.values(daysMap).map(migrateCompletedDayData);
  if (result.length > 0) {
    try {
      localStorage.setItem("badminton_completed_days_v1", JSON.stringify(result));
    } catch {}
  }
  return result;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      appRole: null,
      appDate: null,
      sessionCreatedAt: null,
      setAppSession: (role, date) => {
        set((s) => {
          const sessionCreatedAt = Date.now();
          const tournamentsForDate = (s.pastTournaments || []).filter(
            (t) =>
              !t.isPractice &&
              (t.date === date ||
                (t.createdAt && new Date(t.createdAt).toISOString().split("T")[0] === date))
          );
          const totals: Record<string, number> = {};
          for (const t of tournamentsForDate) {
            const ptsMap = t.dayPointsAwarded ?? computeDayPoints(t);
            for (const [pid, pts] of Object.entries(ptsMap)) {
              totals[pid] = (totals[pid] ?? 0) + pts;
            }
          }
          return {
            appRole: role,
            appDate: date,
            sessionCreatedAt,
            dayTable: {
              date: date,
              tournaments: tournamentsForDate.map((t) => t.id),
              totals: totals,
            },
          };
        });
      },
      clearAppSession: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("scorekeeper_pin");
        }
        set({ appRole: null, appDate: null, sessionCreatedAt: null });
      },

      players: FIXED_PLAYERS,
      selectedPlayerIds: [],
      currentTournament: null,
      phase: "player-select",
      pendingConfig: { ...DEFAULT_CONFIG },
      needsCoinFlip: false,
      coinFlipWinnerId: null,
      dayTable: {
        date: today(),
        tournaments: [],
        totals: {},
      },
      pastTournaments: [],
      completedDays: [],
      isScoreSheetOpen: false,
      setIsScoreSheetOpen: (open) => set({ isScoreSheetOpen: open }),

      addPlayer: (player) => {
        set((s) => ({
          players: [...s.players, player],
          selectedPlayerIds: s.selectedPlayerIds.includes(player.id)
            ? s.selectedPlayerIds
            : [...s.selectedPlayerIds, player.id],
        }));
        apiSync.enqueue("/players", "POST", player);
      },

      togglePlayerSelection: (playerId) =>
        set((s) => ({
          selectedPlayerIds: s.selectedPlayerIds.includes(playerId)
            ? s.selectedPlayerIds.filter((id) => id !== playerId)
            : [...s.selectedPlayerIds, playerId],
        })),

      clearSelection: () => set({ selectedPlayerIds: [] }),

      goToSetup: () => {
        const { selectedPlayerIds } = get();
        if (selectedPlayerIds.length < 3) return;
        set({ phase: "setup" });
      },

      setPendingConfig: (config) => set({ pendingConfig: config }),
      startTournament: () => {
        const { selectedPlayerIds, pendingConfig, dayTable, appDate } = get();
        if (selectedPlayerIds.length < 2) return;

        const isPractice = !!pendingConfig.isPractice;
        const isDE =
          pendingConfig.format === "double-elimination" &&
          (selectedPlayerIds.length === 7 || selectedPlayerIds.length === 8);

        // Automatically randomize / shuffle player order so every tournament starts with fresh, random fixtures
        const randomized = [...selectedPlayerIds];
        for (let i = randomized.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [randomized[i], randomized[j]] = [randomized[j], randomized[i]];
        }

        const effectiveDate = appDate || dayTable.date || today();
        const { matches, byes } = isDE
          ? generateDoubleElimination(randomized, pendingConfig)
          : generateRoundRobin(randomized);

        const tournament: Tournament = {
          id: generateId(),
          createdAt: Date.now(),
          playerIds: randomized,
          matches,
          byes,
          closed: false,
          shareSlug: Math.random().toString(36).slice(2, 10),
          config: { ...pendingConfig },
          isPractice,
          date: effectiveDate,
        };

        const updatedDayTable = dayTable.date === effectiveDate
          ? dayTable
          : { date: effectiveDate, tournaments: [], totals: {} };

        set({
          currentTournament: tournament,
          dayTable: updatedDayTable,
          phase: "fixtures",
          selectedPlayerIds: [],
          needsCoinFlip: false,
        });

        if (!isPractice) {
          apiSync.enqueue("/tournaments", "POST", {
            id: tournament.id,
            shareSlug: tournament.shareSlug,
            playerIds: tournament.playerIds,
            matches: tournament.matches,
            config: tournament.config,
            date: tournament.date,
          });
          apiSync.syncTournamentDirectly(tournament, get().players);
        }
      },

      shuffleFixtures: () => {
        const { currentTournament } = get();
        if (!currentTournament) return;

        const isDE = currentTournament.config?.format === "double-elimination";
        const shuffled = [...currentTournament.playerIds];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const { matches, byes } = isDE
          ? generateDoubleElimination(shuffled, currentTournament.config)
          : generateRoundRobin(shuffled);

        set({
          currentTournament: {
            ...currentTournament,
            playerIds: shuffled,
            matches,
            byes,
            final: undefined,
            finalistIds: undefined,
          },
          phase: "fixtures",
          needsCoinFlip: false,
        });
      },

      cancelTournament: () => {
        const { currentTournament } = get();
        if (!currentTournament) return;
        const tournamentId = currentTournament.id;
        const isPractice = !!currentTournament.isPractice;

        // 1. Mark as permanently deleted so offline recovery never resurrects it
        markTournamentDeleted(tournamentId);

        // 2. Purge this tournament and any of its matches from the offline sync queue
        apiSync.purgeTournament(tournamentId);

        // 3. If it was synced to cloud, immediately fire DELETE to backend
        if (!isPractice) {
          apiSync.deleteTournamentFromBackend(tournamentId);
          apiSync.enqueue(`/tournaments/${tournamentId}`, "DELETE", {});
        }

        set({
          currentTournament: null,
          phase: "player-select",
          selectedPlayerIds: [...currentTournament.playerIds],
          needsCoinFlip: false,
          coinFlipWinnerId: null,
        });
      },

      confirmMatchScore: (matchId, scoreA, scoreB) => {
        const { currentTournament } = get();
        if (!currentTournament) return;

        const isDE = currentTournament.config?.format === "double-elimination";
        const matchIdx = currentTournament.matches.findIndex((m) => m.id === matchId);
        if (matchIdx === -1) {
          if (currentTournament.final && currentTournament.final.id === matchId) {
            get().confirmFinalScore(scoreA, scoreB);
          }
          return;
        }

        const match = currentTournament.matches[matchIdx];
        const config = currentTournament.config;
        const pointsAwarded = computeMatchPoints({ ...match, scoreA, scoreB }, config);

        const updatedMatches = [...currentTournament.matches];
        updatedMatches[matchIdx] = { ...match, scoreA, scoreB, played: true, pointsAwarded };

        let updatedTournament: Tournament = { ...currentTournament, matches: updatedMatches };

        if (isDE) {
          updatedTournament = advanceDoubleElimination(updatedTournament);
          const isComplete = isDoubleEliminationComplete(updatedTournament);
          const gfMatch = updatedTournament.matches.find((m) => m.bracketRound === "GF");

          if (isComplete && gfMatch && gfMatch.played) {
            const finalScoreA = gfMatch.scoreA ?? scoreA;
            const finalScoreB = gfMatch.scoreB ?? scoreB;
            const finalWinnerIsA = finalScoreA > finalScoreB;
            const winnerId = finalWinnerIsA ? gfMatch.playerA : gfMatch.playerB;
            const loserId = finalWinnerIsA ? gfMatch.playerB : gfMatch.playerA;
            const dayPoints = computeDayPoints(updatedTournament);

            const updatedGF = {
              ...gfMatch,
              played: true,
              scoreA: finalScoreA,
              scoreB: finalScoreB,
              pointsAwarded: {
                [winnerId]: currentTournament.playerIds.length,
                [loserId]: dayPoints[loserId] ?? (currentTournament.playerIds.length - 1),
              },
            };

            updatedTournament = {
              ...updatedTournament,
              final: updatedGF,
              finalistIds: [gfMatch.playerA, gfMatch.playerB],
              dayPointsAwarded: dayPoints,
            };

            set({
              currentTournament: updatedTournament,
              phase: "tournament-summary",
            });

            if (!currentTournament.isPractice) {
              apiSync.enqueue(`/tournaments/${currentTournament.id}/final`, "PATCH", {
                scoreA: finalScoreA,
                scoreB: finalScoreB,
                playerA: gfMatch.playerA,
                playerB: gfMatch.playerB,
              });
              apiSync.syncTournamentDirectly(updatedTournament, get().players);
            }
            return;
          }

          set({
            currentTournament: updatedTournament,
            phase: "fixtures",
          });

          if (!currentTournament.isPractice) {
            apiSync.enqueue(`/tournaments/${currentTournament.id}/matches/${matchId}`, "PATCH", { scoreA, scoreB });
            apiSync.syncTournamentDirectly(updatedTournament, get().players);
          }
          return;
        }

        // Standard Round-Robin logic
        const allPlayed = updatedMatches.every((m) => m.played);

        set({
          currentTournament: updatedTournament,
          phase: allPlayed ? "final" : "fixtures",
        });

        if (allPlayed) {
          const { finalistIds, needsCoinFlip } = getFinalists(updatedTournament);
          set((s) => ({
            currentTournament: s.currentTournament
              ? { ...s.currentTournament, finalistIds }
              : null,
            needsCoinFlip,
          }));
        }

        if (!currentTournament.isPractice) {
          apiSync.enqueue(`/tournaments/${currentTournament.id}/matches/${matchId}`, "PATCH", { scoreA, scoreB });
        }
      },

      editMatchScore: (matchId, scoreA, scoreB) => {
        const { currentTournament } = get();
        if (!currentTournament) return;

        const isDE = currentTournament.config?.format === "double-elimination";
        const matchIdx = currentTournament.matches.findIndex((m) => m.id === matchId);
        if (matchIdx === -1) {
          if (currentTournament.final && currentTournament.final.id === matchId) {
            get().confirmFinalScore(scoreA, scoreB);
          }
          return;
        }

        const match = currentTournament.matches[matchIdx];
        const config = currentTournament.config;
        const pointsAwarded = computeMatchPoints({ ...match, scoreA, scoreB }, config);

        const updatedMatches = [...currentTournament.matches];
        updatedMatches[matchIdx] = { ...match, scoreA, scoreB, played: true, pointsAwarded };

        let updatedTournament: Tournament = { ...currentTournament, matches: updatedMatches };

        if (isDE) {
          updatedTournament = advanceDoubleElimination(updatedTournament);
          const isComplete = isDoubleEliminationComplete(updatedTournament);
          set({
            currentTournament: updatedTournament,
            phase: isComplete ? "tournament-summary" : "fixtures",
          });

          if (!currentTournament.isPractice) {
            apiSync.enqueue(`/tournaments/${currentTournament.id}/matches/${matchId}`, "PATCH", { scoreA, scoreB });
            apiSync.syncTournamentDirectly(updatedTournament, get().players);
          }
          return;
        }

        // Round-robin re-evaluate
        const allPlayed = updatedMatches.every((m) => m.played);
        let newPhase = get().phase;
        if (allPlayed && newPhase === "fixtures") {
          newPhase = "final";
        }

        set({ currentTournament: updatedTournament, phase: newPhase });

        if (allPlayed) {
          const { finalistIds, needsCoinFlip } = getFinalists(updatedTournament);
          set((s) => ({
            currentTournament: s.currentTournament
              ? { ...s.currentTournament, finalistIds }
              : null,
            needsCoinFlip,
          }));
        }

        if (!currentTournament.isPractice) {
          apiSync.enqueue(`/tournaments/${currentTournament.id}/matches/${matchId}`, "PATCH", { scoreA, scoreB });
        }
      },

      undoLastMatch: () => {
        const { currentTournament } = get();
        if (!currentTournament) return;

        const matches = [...currentTournament.matches];
        const lastPlayedIdx = [...matches].reverse().findIndex((m) => m.played);
        if (lastPlayedIdx === -1) return;

        const realIdx = matches.length - 1 - lastPlayedIdx;
        matches[realIdx] = {
          ...matches[realIdx],
          scoreA: undefined,
          scoreB: undefined,
          played: false,
          pointsAwarded: undefined,
        };

        set({
          currentTournament: { ...currentTournament, matches, final: undefined, finalistIds: undefined },
          phase: "fixtures",
          needsCoinFlip: false,
        });
      },

      toggleCourtSide: (matchId) => {
        const { currentTournament } = get();
        if (!currentTournament) return;

        const matches = currentTournament.matches.map((m) => {
          if (m.id !== matchId || m.played) return m;
          const newSides: { [id: string]: 1 | 2 } = {
            [m.playerA]: m.courtSide[m.playerA] === 1 ? 2 : 1,
            [m.playerB]: m.courtSide[m.playerB] === 1 ? 2 : 1,
          };
          return { ...m, courtSide: newSides };
        });

        set({ currentTournament: { ...currentTournament, matches } });
      },

      startFinal: (coinFlipWinnerId) => {
        const { currentTournament } = get();
        if (!currentTournament?.finalistIds) return;

        let finalistIds = currentTournament.finalistIds;
        if (coinFlipWinnerId && finalistIds[1] === coinFlipWinnerId) {
          finalistIds = [coinFlipWinnerId, finalistIds[0]];
        }

        const [a, b] = finalistIds;
        const finalMatch: Match = {
          id: `final-${currentTournament.id}`,
          round: -1,
          playerA: a,
          playerB: b,
          courtSide: { [a]: 1, [b]: 2 },
          played: false,
        };

        set({
          currentTournament: { ...currentTournament, finalistIds, final: finalMatch },
          coinFlipWinnerId: coinFlipWinnerId ?? null,
          needsCoinFlip: false,
          phase: "final",
        });
      },

      confirmFinalScore: (scoreA, scoreB) => {
        const { currentTournament } = get();
        if (!currentTournament?.final || !currentTournament.finalistIds) return;

        const final = currentTournament.final;
        const [idA, idB] = [final.playerA, final.playerB];
        const winnerIsA = scoreA > scoreB;
        const winScore = Math.max(scoreA, scoreB);
        const loseScore = Math.min(scoreA, scoreB);
        const config = currentTournament.config;

        const winnerId = winnerIsA ? idA : idB;
        const loserId = winnerIsA ? idB : idA;
        const margin = winScore - loseScore;
        const bonusMargin = config?.finalBonusMargin ?? 4;
        const N = currentTournament.playerIds.length;
        
        const ptsAwarded = {
          [winnerId]: N,
          [loserId]: margin >= bonusMargin ? Math.max(1, N - 2) : Math.max(1, N - 1)
        };

        const updatedFinal: Match = {
          ...final,
          scoreA,
          scoreB,
          played: true,
          pointsAwarded: ptsAwarded,
        };

        set({
          currentTournament: { ...currentTournament, final: updatedFinal },
          phase: "tournament-summary",
        });

        if (!currentTournament.isPractice) {
          apiSync.enqueue(`/tournaments/${currentTournament.id}/final`, "PATCH", {
            scoreA,
            scoreB,
            playerA: idA,
            playerB: idB,
          });
        }
      },

      closeTournament: () => {
        const { currentTournament, dayTable, pastTournaments } = get();
        if (!currentTournament) return;

        // If practice/test tournament, do not save to day table or sync to backend
        if (currentTournament.isPractice) {
          set({
            currentTournament: null,
            phase: "player-select",
            selectedPlayerIds: currentTournament.playerIds,
          });
          return;
        }

        const dayPoints = computeDayPoints(currentTournament);
        const closedTournament: Tournament = {
          ...currentTournament,
          closed: true,
          dayPointsAwarded: dayPoints,
        };

        const updatedPast = [...pastTournaments, closedTournament];
        const currentDate = dayTable.date || today();

        // Always recompute clean cumulative day totals from all tournaments completed today
        const todaysTournaments = updatedPast.filter(
          (t) => !t.isPractice && (t.date || today()) === currentDate
        );
        const newTotals: { [playerId: string]: number } = {};
        for (const t of todaysTournaments) {
          const ptsMap = t.dayPointsAwarded ?? computeDayPoints(t);
          for (const [pid, pts] of Object.entries(ptsMap)) {
            newTotals[pid] = (newTotals[pid] ?? 0) + pts;
          }
        }

        const newDayTable: DayTable = {
          date: currentDate,
          tournaments: todaysTournaments.map((t) => t.id),
          totals: newTotals,
        };
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem("badminton_archived_tournaments_v1", JSON.stringify(updatedPast));
          }
        } catch {}

        set({
          currentTournament: null,
          phase: "player-select",
          dayTable: newDayTable,
          pastTournaments: updatedPast,
          selectedPlayerIds: closedTournament.playerIds,
        });
      },

      deleteTournament: (id: string, skipSync?: boolean) => {
        const { dayTable, pastTournaments, completedDays } = get();

        // 1. Mark ID as permanently deleted so recovery never brings it back
        markTournamentDeleted(id);

        // 2. Purge any pending creation/update items from the offline sync queue
        apiSync.purgeTournament(id);

        const updatedPast = pastTournaments.filter((t) => t.id !== id);
        const updatedDayTournaments = dayTable.tournaments.filter((tId) => tId !== id);

        const recalculatedTotals: { [playerId: string]: number } = {};
        for (const t of updatedPast) {
          if (updatedDayTournaments.includes(t.id) && t.dayPointsAwarded) {
            for (const [pid, pts] of Object.entries(t.dayPointsAwarded)) {
              recalculatedTotals[pid] = (recalculatedTotals[pid] ?? 0) + pts;
            }
          }
        }

        try {
          if (typeof window !== "undefined") {
            localStorage.setItem("badminton_archived_tournaments_v1", JSON.stringify(updatedPast));
          }
        } catch {}

        // If no tournaments remain, clean up completed days associated with this session
        const updatedCompletedDays = (completedDays || []).filter((cd) => {
          return updatedPast.length > 0 || (cd.tournamentIds && cd.tournamentIds.some((tId) => tId !== id));
        });

        try {
          if (typeof window !== "undefined") {
            localStorage.setItem("badminton_completed_days_v1", JSON.stringify(updatedCompletedDays));
          }
        } catch {}

        set({
          pastTournaments: updatedPast,
          completedDays: updatedCompletedDays,
          dayTable: {
            ...dayTable,
            tournaments: updatedDayTournaments,
            totals: recalculatedTotals,
          },
        });

        if (!skipSync) {
          apiSync.enqueue(`/tournaments/${id}`, "DELETE", {});
          // Also fire an immediate DELETE so it's not lost if queue is cleared
          apiSync.deleteTournamentFromBackend(id);
          if (updatedDayTournaments.length === 0) {
            apiSync.enqueue(`/day-tables/${dayTable.date || today()}`, "DELETE", {});
          }
        }
      },

      startNextTournament: () => {
        set({ phase: "player-select", currentTournament: null });
      },

      startNewDay: (overrideTotals?: Record<string, number>, overrideTournaments?: string[]) => {
        const { dayTable, completedDays } = get();
        const newCompletedDays = [...completedDays];

        const finalTotals = overrideTotals ?? dayTable.totals;
        const finalTournaments = overrideTournaments ?? dayTable.tournaments;

        if (finalTournaments.length > 0 || Object.keys(finalTotals).length > 0) {
          let topPlayerId: string | undefined;
          let spoonPlayerId: string | undefined;
          if (dayTable.date === "2026-10-10") {
            topPlayerId = "akshat";
            spoonPlayerId = "udbhaw";
          } else if (dayTable.date === "2026-10-11") {
            topPlayerId = "akshat";
            spoonPlayerId = "sajal";
          } else if (dayTable.date === "2026-10-18") {
            topPlayerId = "gautam";
            spoonPlayerId = "sajal";
          } else {
            const sorted = Object.entries(finalTotals).sort(([, a], [, b]) => b - a);
            topPlayerId = sorted[0]?.[0];
            spoonPlayerId = sorted.length > 1 ? sorted[sorted.length - 1]?.[0] : undefined;
          }
          const newSummary: CompletedDaySummary = {
            date: dayTable.date,
            totals: { ...finalTotals },
            topPlayerId,
            spoonPlayerId,
            tournamentIds: [...finalTournaments],
          };
          newCompletedDays.push(newSummary);
          try {
            if (typeof window !== "undefined") {
              localStorage.setItem("badminton_completed_days_v1", JSON.stringify(newCompletedDays));
            }
          } catch {}
        }

        set({
          completedDays: newCompletedDays,
          dayTable: { date: today(), tournaments: [], totals: {} },
          currentTournament: null,
          phase: "player-select",
          selectedPlayerIds: [],
        });
      },

      resetDayTable: (dateParam?: string) => {
        const { dayTable, pastTournaments, completedDays } = get();
        const dateToReset = dateParam || dayTable.date || today();

        // 1. Mark date as permanently deleted so recovery never brings it back
        markDayDeleted(dateToReset);

        // 2. Purge sync queue of any pending mutations for this date
        apiSync.purgeDay(dateToReset);

        // 3. Find any tournaments associated with this day
        const dayTourneyIds = new Set(dayTable.tournaments);
        const tourneysToRemove = pastTournaments.filter(
          (t) =>
            dayTourneyIds.has(t.id) ||
            (t.createdAt && new Date(t.createdAt).toISOString().split("T")[0] === dateToReset)
        );

        // Mark all these tournaments as permanently deleted too
        tourneysToRemove.forEach((t) => {
          markTournamentDeleted(t.id);
          apiSync.purgeTournament(t.id);
        });

        const updatedPast = pastTournaments.filter(
          (t) =>
            !dayTourneyIds.has(t.id) &&
            !(t.createdAt && new Date(t.createdAt).toISOString().split("T")[0] === dateToReset)
        );

        try {
          if (typeof window !== "undefined") {
            localStorage.setItem("badminton_archived_tournaments_v1", JSON.stringify(updatedPast));
          }
        } catch {}

        // 4. Remove from completedDays
        const updatedCompletedDays = (completedDays || []).filter((cd) => cd.date !== dateToReset);
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem("badminton_completed_days_v1", JSON.stringify(updatedCompletedDays));
          }
        } catch {}

        // 5. Reset store dayTable to completely empty state
        set({
          dayTable: {
            date: today(),
            tournaments: [],
            totals: {},
          },
          pastTournaments: updatedPast,
          completedDays: updatedCompletedDays,
          currentTournament: null,
          phase: "player-select",
          selectedPlayerIds: [],
        });

        // 6. Enqueue backend deletion for the day table and day results
        apiSync.enqueue(`/day-tables/${dateToReset}`, "DELETE", {});
        apiSync.enqueue(`/day-results/${dateToReset}`, "DELETE", {});
      },

      setPhase: (phase) => set({ phase }),
    }),
    {
      name: "badminton-app-state-v2",
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isScoreSheetOpen = false;

          // Session expiration check (5-6 hours TTL)
          if (isSessionExpired(state.sessionCreatedAt)) {
            state.appRole = null;
            state.sessionCreatedAt = null;
          }

          // Ensure all fixed players (including Sajal) are present in state.players
          const existingIds = new Set((state.players || []).map((p) => p.id));
          const playersToAdd: Player[] = [];
          for (const fp of FIXED_PLAYERS) {
            if (!existingIds.has(fp.id)) {
              playersToAdd.push(fp);
            }
          }
          if (playersToAdd.length > 0) {
            state.players = [...(state.players || []), ...playersToAdd];
          }

          // Remove old custom duplicates/aliases of Sajal
          state.players = (state.players || []).filter(
            (p) => !SAJAL_ALIASES.has(p.id) && !(p.name.toLowerCase() === "sajal" && p.id !== "sajal")
          );

          const oct18TourneyIds = new Set(["pphuektzmvdq6x52", "3prxyal7mvdsckif"]);
          const oct11TourneyIds = new Set(["cvn6q9vimv3q3d9v", "jmvuh9gsmv3rfkru", "5h4w6113mv3sa2qu"]);

          // Migrate pastTournaments
          if (state.pastTournaments && state.pastTournaments.length > 0) {
            state.pastTournaments = state.pastTournaments.map((t) => {
              const mig = migrateTournamentData(t);
              if (oct18TourneyIds.has(mig.id)) {
                return { ...mig, date: "2026-10-18" };
              }
              if (oct11TourneyIds.has(mig.id)) {
                return { ...mig, date: "2026-10-11" };
              }
              return mig;
            });
            try {
              localStorage.setItem("badminton_archived_tournaments_v1", JSON.stringify(state.pastTournaments));
            } catch {}
          } else {
            const recovered = recoverTournamentsFromSyncQueue();
            if (recovered.length > 0) {
              state.pastTournaments = recovered.map((t) => {
                if (oct18TourneyIds.has(t.id)) return { ...t, date: "2026-10-18" };
                if (oct11TourneyIds.has(t.id)) return { ...t, date: "2026-10-11" };
                return t;
              });
            }
          }

          // Migrate completedDays
          // Note: 18th Oct is explicitly not finished yet by the user, so remove any premature 18th Oct entry
          if (state.completedDays && state.completedDays.length > 0) {
            state.completedDays = state.completedDays
              .filter((cd) => cd.date !== "2026-10-18")
              .map((cd) => {
                const mig = migrateCompletedDayData(cd);
                if (mig.date === "2026-10-11") {
                  return {
                    ...mig,
                    totals: { akshat: 12, harsh: 10, adarsh: 9, gautam: 9, sajal: 5 },
                    topPlayerId: "akshat",
                    spoonPlayerId: "sajal",
                    tournamentIds: ["cvn6q9vimv3q3d9v", "jmvuh9gsmv3rfkru", "5h4w6113mv3sa2qu"],
                  };
                }
                return mig;
              });
            try {
              localStorage.setItem("badminton_completed_days_v1", JSON.stringify(state.completedDays));
            } catch {}
          } else {
            const recoveredDays = recoverCompletedDaysFromSyncQueue();
            if (recoveredDays.length > 0) {
              state.completedDays = recoveredDays
                .filter((cd) => cd.date !== "2026-10-18")
                .map((cd) => {
                  if (cd.date === "2026-10-11") {
                    return {
                      ...cd,
                      totals: { akshat: 12, harsh: 10, adarsh: 9, gautam: 9, sajal: 5 },
                      topPlayerId: "akshat",
                      spoonPlayerId: "sajal",
                      tournamentIds: ["cvn6q9vimv3q3d9v", "jmvuh9gsmv3rfkru", "5h4w6113mv3sa2qu"],
                    };
                  }
                  return cd;
                });
            }
          }

          // Migrate dayTable
          if (state.dayTable) {
            state.dayTable = migrateDayTableData(state.dayTable);
            if (state.dayTable.date === "2026-10-11") {
              state.dayTable.tournaments = (state.dayTable.tournaments || []).filter(
                (id) => !oct18TourneyIds.has(id)
              );
              state.dayTable.totals = { akshat: 12, harsh: 10, adarsh: 9, gautam: 9, sajal: 5 };
            } else if (state.dayTable.date === "2026-10-18") {
              state.dayTable.tournaments = ["pphuektzmvdq6x52", "3prxyal7mvdsckif"];
              state.dayTable.totals = {
                gautam: 14,
                akshat: 10,
                harsh: 10,
                adarsh: 8,
                anirudh: 5,
                sajal: 4,
                udbhaw: 4,
              };
            }
          }

          // Migrate currentTournament if active
          if (state.currentTournament) {
            state.currentTournament = migrateTournamentData(state.currentTournament);
          }
        }
      },
    }
  )
);
