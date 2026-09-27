// lib/store.ts — Zustand store with localStorage persistence

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Player, Tournament, DayTable, Match, PlayPhase } from "./types";
import { generateRoundRobin } from "./fixtures";
import { pointsForMatch, pointsForFinal, getMatchResult } from "./scoring";
import { computeDayPoints, isRoundRobinComplete, getFinalists } from "./ranking";

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
  players: Player[];           // all players (fixed + custom)
  selectedPlayerIds: string[]; // currently selected for next tournament

  // Active tournament
  currentTournament: Tournament | null;
  phase: PlayPhase;            // which Play screen state we're in

  // Coin flip state (when tiebreak needed for finalists)
  needsCoinFlip: boolean;
  coinFlipWinnerId: string | null;

  // Day table
  dayTable: DayTable;
  pastTournaments: Tournament[]; // closed tournaments for history

  // Actions
  addPlayer: (player: Player) => void;
  togglePlayerSelection: (playerId: string) => void;
  clearSelection: () => void;

  startTournament: () => void;
  confirmMatchScore: (matchId: string, scoreA: number, scoreB: number) => void;
  undoLastMatch: () => void;
  toggleCourtSide: (matchId: string) => void;

  startFinal: (coinFlipWinnerId?: string) => void;
  confirmFinalScore: (scoreA: number, scoreB: number) => void;

  closeTournament: () => void;
  startNextTournament: () => void;
  startNewDay: () => void;

  // For resuming
  setPhase: (phase: PlayPhase) => void;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      players: FIXED_PLAYERS,
      selectedPlayerIds: [],
      currentTournament: null,
      phase: "player-select",
      needsCoinFlip: false,
      coinFlipWinnerId: null,
      dayTable: {
        date: today(),
        tournaments: [],
        totals: {},
      },
      pastTournaments: [],

      addPlayer: (player) =>
        set((s) => ({ players: [...s.players, player] })),

      togglePlayerSelection: (playerId) =>
        set((s) => ({
          selectedPlayerIds: s.selectedPlayerIds.includes(playerId)
            ? s.selectedPlayerIds.filter((id) => id !== playerId)
            : [...s.selectedPlayerIds, playerId],
        })),

      clearSelection: () => set({ selectedPlayerIds: [] }),

      startTournament: () => {
        const { selectedPlayerIds } = get();
        if (selectedPlayerIds.length < 3) return;

        const { matches, byes } = generateRoundRobin(selectedPlayerIds);
        const tournament: Tournament = {
          id: generateId(),
          createdAt: Date.now(),
          playerIds: [...selectedPlayerIds],
          matches,
          byes,
          closed: false,
        };

        set({
          currentTournament: tournament,
          phase: "fixtures",
          selectedPlayerIds: [],
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
        const winScore = Math.max(scoreA, scoreB);
        const loseScore = Math.min(scoreA, scoreB);
        const winnerIsA = scoreA > scoreB;
        const winnerPts = pointsForMatch(winScore, loseScore);

        const pointsAwarded: { [id: string]: number } = {
          [match.playerA]: winnerIsA ? winnerPts : 0,
          [match.playerB]: winnerIsA ? 0 : winnerPts,
        };

        const updatedMatches = [...currentTournament.matches];
        updatedMatches[matchIdx] = {
          ...match,
          scoreA,
          scoreB,
          played: true,
          pointsAwarded,
        };

        const updatedTournament: Tournament = {
          ...currentTournament,
          matches: updatedMatches,
        };

        // Check if round-robin is complete
        const allPlayed = updatedMatches.every((m) => m.played);

        set({
          currentTournament: updatedTournament,
          phase: allPlayed ? "final" : "fixtures",
        });

        // If transitioning to final, figure out finalists
        if (allPlayed) {
          const { finalistIds, needsCoinFlip } = getFinalists(updatedTournament);
          set((s) => ({
            currentTournament: s.currentTournament
              ? { ...s.currentTournament, finalistIds }
              : null,
            needsCoinFlip,
          }));
        }
      },

      undoLastMatch: () => {
        const { currentTournament } = get();
        if (!currentTournament) return;

        // Find last played match (reverse order)
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

        // If coin flip provided, reorder finalists
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
          currentTournament: {
            ...currentTournament,
            finalistIds,
            final: finalMatch,
          },
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

        const ptsA = pointsForFinal(winScore, loseScore, winnerIsA);
        const ptsB = pointsForFinal(winScore, loseScore, !winnerIsA);

        const updatedFinal: Match = {
          ...final,
          scoreA,
          scoreB,
          played: true,
          pointsAwarded: {
            [idA]: ptsA,
            [idB]: ptsB,
          },
        };

        set({
          currentTournament: { ...currentTournament, final: updatedFinal },
          phase: "tournament-summary",
        });
      },

      closeTournament: () => {
        const { currentTournament, dayTable } = get();
        if (!currentTournament) return;

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

        // If day date changed, reset day table
        const currentDate = today();
        const newDayTable: DayTable =
          dayTable.date !== currentDate
            ? { date: currentDate, tournaments: [currentTournament.id], totals: dayPoints }
            : {
                date: dayTable.date,
                tournaments: [...dayTable.tournaments, currentTournament.id],
                totals: newTotals,
              };

        set((s) => ({
          currentTournament: null,
          phase: "player-select",
          dayTable: newDayTable,
          pastTournaments: [...s.pastTournaments, closedTournament],
          selectedPlayerIds: closedTournament.playerIds, // pre-select same players for next tournament
        }));
      },

      startNextTournament: () => {
        // Re-select same players and go back to player-select
        set({ phase: "player-select", currentTournament: null });
      },

      startNewDay: () => {
        set({
          dayTable: { date: today(), tournaments: [], totals: {} },
          pastTournaments: [],
          currentTournament: null,
          phase: "player-select",
          selectedPlayerIds: [],
        });
      },

      setPhase: (phase) => set({ phase }),
    }),
    {
      name: "badminton-app-state-v1",
      // Persist everything except ephemeral UI state
    }
  )
);
