// lib/ranking.ts — Tournament table computation, tiebreaks, day-table conversion

import { Tournament, TournamentRow, Match, Player } from "./types";
import { pointsForFinal } from "./scoring";
import { DEFAULT_CONFIG } from "./types";

/**
 * Compute the live tournament table from round-robin matches.
 * Does NOT include the final — final points are stored directly in the match's
 * pointsAwarded field and included when we read all matches.
 *
 * The table is derived purely from summing pointsAwarded across all played matches
 * (including the final once it's played). Never mutates state.
 */
export function computeTournamentTable(tournament: Tournament): TournamentRow[] {
  const { playerIds, matches, final } = tournament;

  // Accumulate stats per player
  const stats: {
    [id: string]: {
      points: number;
      wins: number;
      matchesPlayed: number;
      scoreFor: number;
      scoreAgainst: number;
    };
  } = {};

  for (const pid of playerIds) {
    stats[pid] = { points: 0, wins: 0, matchesPlayed: 0, scoreFor: 0, scoreAgainst: 0 };
  }

  // Process round-robin matches
  for (const m of matches) {
    if (!m.played || m.scoreA === undefined || m.scoreB === undefined) continue;
    const { playerA, playerB, scoreA, scoreB, pointsAwarded } = m;
    if (!pointsAwarded) continue;

    stats[playerA].matchesPlayed++;
    stats[playerA].points += pointsAwarded[playerA] ?? 0;
    stats[playerA].scoreFor += scoreA;
    stats[playerA].scoreAgainst += scoreB;
    if (pointsAwarded[playerA] > 0) stats[playerA].wins++;

    stats[playerB].matchesPlayed++;
    stats[playerB].points += pointsAwarded[playerB] ?? 0;
    stats[playerB].scoreFor += scoreB;
    stats[playerB].scoreAgainst += scoreA;
    if (pointsAwarded[playerB] > 0) stats[playerB].wins++;
  }

  // Include final if played
  if (final?.played && final.scoreA !== undefined && final.scoreB !== undefined && final.pointsAwarded) {
    const { playerA, playerB, scoreA, scoreB, pointsAwarded } = final;
    // Only add for the two finalists
    if (stats[playerA]) {
      stats[playerA].points += pointsAwarded[playerA] ?? 0;
      stats[playerA].matchesPlayed++;
      stats[playerA].scoreFor += scoreA;
      stats[playerA].scoreAgainst += scoreB;
      if ((pointsAwarded[playerA] ?? 0) > 0) stats[playerA].wins++;
    }
    if (stats[playerB]) {
      stats[playerB].points += pointsAwarded[playerB] ?? 0;
      stats[playerB].matchesPlayed++;
      stats[playerB].scoreFor += scoreB;
      stats[playerB].scoreAgainst += scoreA;
      if ((pointsAwarded[playerB] ?? 0) > 0) stats[playerB].wins++;
    }
  }

  // Build rows and sort
  const rows: TournamentRow[] = playerIds.map((pid) => ({
    playerId: pid,
    points: stats[pid].points,
    wins: stats[pid].wins,
    matchesPlayed: stats[pid].matchesPlayed,
    pointDiff: stats[pid].scoreFor - stats[pid].scoreAgainst,
    rank: 0,
  }));

  // Sort: primary = points desc, secondary = pointDiff desc
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.pointDiff - a.pointDiff;
  });

  // Assign ranks (ties get same rank for now — tiebreak logic applied when selecting finalists)
  rows.forEach((row, i) => {
    row.rank = i + 1;
  });

  return rows;
}

/**
 * Determine the top 2 finalists from the round-robin table.
 * Tiebreak: 1) head-to-head result, 2) point-difference, 3) requires coin-flip
 */
export function getFinalists(
  tournament: Tournament
): { finalistIds: [string, string]; needsCoinFlip: boolean } {
  const table = computeTournamentTable(tournament);

  // Check if positions 1 and 2 are tied in points
  const first = table[0];
  const second = table[1];

  // Head-to-head tiebreak between positions 1 and 2
  if (first.points === second.points) {
    const h2h = tournament.matches.find(
      (m) =>
        m.played &&
        ((m.playerA === first.playerId && m.playerB === second.playerId) ||
          (m.playerA === second.playerId && m.playerB === first.playerId))
    );

    if (h2h && h2h.scoreA !== undefined && h2h.scoreB !== undefined) {
      // Determine winner of h2h
      const h2hWinner =
        h2h.scoreA > h2h.scoreB ? h2h.playerA : h2h.playerB;
      // Put h2h winner first
      if (h2hWinner === second.playerId) {
        return { finalistIds: [second.playerId, first.playerId], needsCoinFlip: false };
      }
    }

    // Point diff tiebreak is already applied in the table sort
    if (first.pointDiff === second.pointDiff) {
      // Need coin flip
      return {
        finalistIds: [first.playerId, second.playerId],
        needsCoinFlip: true,
      };
    }
  }

  return {
    finalistIds: [first.playerId, second.playerId],
    needsCoinFlip: false,
  };
}

/**
 * Convert a closed tournament's final standings into day points.
 * rank 1 → N points, rank N → 1 point.
 * Only reads the tournament table's already-penalized totals — never re-applies penalties.
 */
export function computeDayPoints(tournament: Tournament): { [playerId: string]: number } {
  const table = computeTournamentTable(tournament);
  const N = table.length;
  const dayPoints: { [playerId: string]: number } = {};

  table.forEach((row) => {
    dayPoints[row.playerId] = N - row.rank + 1;
  });

  return dayPoints;
}

/**
 * Check if all round-robin matches have been played.
 */
export function isRoundRobinComplete(tournament: Tournament): boolean {
  return tournament.matches.every((m) => m.played);
}
