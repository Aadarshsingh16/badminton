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
import { generateRoundRobin } from "./fixtures";
import { pointsForMatch, pointsForFinal } from "./scoring";
import { computeDayPoints, isRoundRobinComplete, getFinalists } from "./ranking";
import { apiSync } from "./apiSync";

// Fixed players (the 6 friends)
export const FIXED_PLAYERS: Player[] = [
  { id: "adarsh", name: "Adarsh", avatar: "clumsy" },
  { id: "akshat", name: "Akshat", avatar: "dwarf" },
  { id: "harsh", name: "Harsh", avatar: "nerd" },
  { id: "udbhaw", name: "Udbhaw", avatar: "bigfoot" },
  { id: "anirudh", name: "Anirudh", avatar: "fighter" },
  { id: "gautam", name: "Gautam", avatar: "chinese" },
];

interface AppState {
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
  startNewDay: () => void;

  setPhase: (phase: PlayPhase) => void;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
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
              const ptsA = pointsForFinal(winScore, loseScore, winnerIsA, t.config);
              const ptsB = pointsForFinal(winScore, loseScore, !winnerIsA, t.config);

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
                pointsAwarded: { [b.playerA]: ptsA, [b.playerB]: ptsB },
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

  const list = Object.values(tournamentsMap);
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
  const daysMap: { [date: string]: CompletedDaySummary } = {};

  try {
    const rawArchive = localStorage.getItem("badminton_completed_days_v1");
    if (rawArchive) {
      const archived = JSON.parse(rawArchive);
      if (Array.isArray(archived)) {
        for (const d of archived) {
          if (d && d.date) daysMap[d.date] = d;
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
            if (date && totals && !daysMap[date]) {
              const sorted = Object.entries(totals).sort(([, a]: any, [, b]: any) => b - a);
              daysMap[date] = {
                date,
                totals,
                topPlayerId: sorted[0]?.[0],
                spoonPlayerId: sorted.length > 1 ? sorted[sorted.length - 1]?.[0] : undefined,
                tournamentIds: [],
              };
            }
          }
        }
      }
    }
  } catch {}

  const result = Object.values(daysMap);
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
        const { selectedPlayerIds, pendingConfig } = get();
        if (selectedPlayerIds.length < 3) return;

        const isPractice = !!pendingConfig.isPractice;

        // Automatically randomize / shuffle player order so every tournament starts with fresh, random fixtures
        const randomized = [...selectedPlayerIds];
        for (let i = randomized.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [randomized[i], randomized[j]] = [randomized[j], randomized[i]];
        }

        const { matches, byes } = generateRoundRobin(randomized);
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
        };

        set({
          currentTournament: tournament,
          phase: "fixtures",
          selectedPlayerIds: [],
          needsCoinFlip: false,
          coinFlipWinnerId: null,
        });

        if (!isPractice) {
          apiSync.enqueue("/tournaments", "POST", {
            id: tournament.id,
            shareSlug: tournament.shareSlug,
            playerIds: tournament.playerIds,
            matches: tournament.matches,
            config: tournament.config,
          });
        }
      },

      shuffleFixtures: () => {
        const { currentTournament } = get();
        if (!currentTournament) return;

        const shuffled = [...currentTournament.playerIds];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const { matches, byes } = generateRoundRobin(shuffled);
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

        const matchIdx = currentTournament.matches.findIndex((m) => m.id === matchId);
        if (matchIdx === -1) return;

        const match = currentTournament.matches[matchIdx];
        const config = currentTournament.config;
        const pointsAwarded = computeMatchPoints({ ...match, scoreA, scoreB }, config);

        const updatedMatches = [...currentTournament.matches];
        updatedMatches[matchIdx] = { ...match, scoreA, scoreB, played: true, pointsAwarded };

        const updatedTournament: Tournament = { ...currentTournament, matches: updatedMatches };
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

        const updatedTournament: Tournament = { ...currentTournament, matches: updatedMatches };

        // Re-evaluate if all matches played (could move back to final phase)
        const allPlayed = updatedMatches.every((m) => m.played);
        let newPhase = get().phase;
        if (allPlayed && newPhase === "fixtures") {
          newPhase = "final";
        }

        set({ currentTournament: updatedTournament, phase: newPhase });

        // Re-compute finalists if all matches played
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

        const ptsA = pointsForFinal(winScore, loseScore, winnerIsA, config);
        const ptsB = pointsForFinal(winScore, loseScore, !winnerIsA, config);

        const updatedFinal: Match = {
          ...final,
          scoreA,
          scoreB,
          played: true,
          pointsAwarded: { [idA]: ptsA, [idB]: ptsB },
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
        const newTotals = { ...dayTable.totals };
        for (const [pid, pts] of Object.entries(dayPoints)) {
          newTotals[pid] = (newTotals[pid] ?? 0) + pts;
        }

        const closedTournament: Tournament = {
          ...currentTournament,
          closed: true,
          dayPointsAwarded: dayPoints,
        };

        const currentDate = today();
        const newDayTable: DayTable =
          dayTable.date !== currentDate
            ? { date: currentDate, tournaments: [currentTournament.id], totals: dayPoints }
            : {
                date: dayTable.date,
                tournaments: [...dayTable.tournaments, currentTournament.id],
                totals: newTotals,
              };

        const updatedPast = [...pastTournaments, closedTournament];
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

        apiSync.enqueue("/day-tables/close", "POST", {
          date: currentDate,
          totals: newTotals,
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
          if (t.dayPointsAwarded) {
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
        }
      },

      startNextTournament: () => {
        set({ phase: "player-select", currentTournament: null });
      },

      startNewDay: () => {
        const { dayTable, completedDays } = get();
        const newCompletedDays = [...completedDays];

        if (dayTable.tournaments.length > 0 || Object.keys(dayTable.totals).length > 0) {
          const sorted = Object.entries(dayTable.totals).sort(([, a], [, b]) => b - a);
          const newSummary: CompletedDaySummary = {
            date: dayTable.date,
            totals: { ...dayTable.totals },
            topPlayerId: sorted[0]?.[0],
            spoonPlayerId: sorted.length > 1 ? sorted[sorted.length - 1]?.[0] : undefined,
            tournamentIds: [...dayTable.tournaments],
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

      setPhase: (phase) => set({ phase }),
    }),
    {
      name: "badminton-app-state-v2",
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (state.pastTournaments.length === 0) {
            const recovered = recoverTournamentsFromSyncQueue();
            if (recovered.length > 0) {
              state.pastTournaments = recovered;
            }
          }
          if (!state.completedDays || state.completedDays.length === 0) {
            const recoveredDays = recoverCompletedDaysFromSyncQueue();
            if (recoveredDays.length > 0) {
              state.completedDays = recoveredDays;
            }
          }
        }
      },
    }
  )
);
