// lib/ranking.ts — Tournament table computation, tiebreaks, day-table conversion

import { Tournament, TournamentRow, Match, Player } from "./types";
import { pointsForFinal } from "./scoring";
import { DEFAULT_CONFIG } from "./types";

/**
 * Compute the round-robin league table (excluding the final match).
 * Used during the league phase and to identify finalists / non-finalist order.
 */
export function computeRoundRobinTable(tournament: Tournament): TournamentRow[] {
  if (!tournament) return [];
  const { playerIds = [], matches = [] } = tournament;
  const N = playerIds.length;

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

  // Process round-robin matches only
  for (const m of matches) {
    if (!m.played || m.isFinal || m.round === -1 || m.scoreA === undefined || m.scoreB === undefined) continue;
    const { playerA, playerB, scoreA, scoreB, pointsAwarded } = m;
    if (!pointsAwarded) continue;

    if (stats[playerA]) {
      stats[playerA].matchesPlayed++;
      stats[playerA].points += pointsAwarded[playerA] ?? 0;
      stats[playerA].scoreFor += scoreA;
      stats[playerA].scoreAgainst += scoreB;
      if (pointsAwarded[playerA] > 0) stats[playerA].wins++;
    }

    if (stats[playerB]) {
      stats[playerB].matchesPlayed++;
      stats[playerB].points += pointsAwarded[playerB] ?? 0;
      stats[playerB].scoreFor += scoreB;
      stats[playerB].scoreAgainst += scoreA;
      if (pointsAwarded[playerB] > 0) stats[playerB].wins++;
    }
  }

  const rows: TournamentRow[] = playerIds.map((pid) => ({
    playerId: pid,
    points: stats[pid].points,
    wins: stats[pid].wins,
    matchesPlayed: stats[pid].matchesPlayed,
    pointDiff: stats[pid].scoreFor - stats[pid].scoreAgainst,
    rank: 0,
    dayPoints: 0,
  }));

  // Sort: points desc, then pointDiff desc
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.pointDiff - a.pointDiff;
  });

  rows.forEach((row, i) => {
    row.rank = i + 1;
    row.dayPoints = Math.max(1, N - i);
  });

  return rows;
}

/**
 * Compute the live tournament table.
 * - During round-robin: sorted by league points (wins, bonuses, +/-).
 * - After the final ends: sorted by overall points (winner gets N, loser gets N-1 or N-2 on blowout penalty).
 *   Winner always finishes 1st, runner-up finishes 2nd, and 3rd..Nth are ordered by their league finish.
 */
export function computeTournamentTable(tournament: Tournament): TournamentRow[] {
  if (!tournament) return [];
  const { playerIds = [], matches = [], final, config } = tournament;
  const N = playerIds.length;


  // If the final has not been played yet, return round-robin standings
  if (!final?.played || final.scoreA === undefined || final.scoreB === undefined) {
    return computeRoundRobinTable(tournament);
  }

  // 1. Get round-robin standings as baseline for non-finalists
  const rrTable = computeRoundRobinTable(tournament);

  // 2. Identify final winner and loser
  const isWinA = final.scoreA > final.scoreB;
  const winnerId = isWinA ? final.playerA : final.playerB;
  const loserId = isWinA ? final.playerB : final.playerA;

  const winScore = Math.max(final.scoreA, final.scoreB);
  const loseScore = Math.min(final.scoreA, final.scoreB);
  const margin = winScore - loseScore;
  const bonusMargin = config?.finalBonusMargin ?? DEFAULT_CONFIG.finalBonusMargin;
  const hasPenalty = margin >= bonusMargin;

  // 3. Compute overall day points for every player
  const dayPointsMap: { [id: string]: number } = {};

  // Winner of final finishes first and gets N overall points
  dayPointsMap[winnerId] = N;

  // Loser of final finishes second and gets N - 1 (or N - 2 if loser scored <= 2 in a 6-pt final)
  dayPointsMap[loserId] = hasPenalty ? Math.max(1, N - 2) : Math.max(1, N - 1);

  // Remaining players get positions 3..N based on their round-robin finish
  const nonFinalists = rrTable.filter((r) => r.playerId !== winnerId && r.playerId !== loserId);
  nonFinalists.forEach((row, idx) => {
    // 3rd place (idx 0) gets N - 2, 4th gets N - 3, etc.
    dayPointsMap[row.playerId] = Math.max(1, N - 2 - idx);
  });

  // 4. Accumulate overall match stats
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

  // Include round-robin matches
  for (const m of matches) {
    if (!m.played || m.isFinal || m.round === -1 || m.scoreA === undefined || m.scoreB === undefined) continue;
    const { playerA, playerB, scoreA, scoreB, pointsAwarded } = m;
    if (!pointsAwarded) continue;

    if (stats[playerA]) {
      stats[playerA].matchesPlayed++;
      stats[playerA].points += pointsAwarded[playerA] ?? 0;
      stats[playerA].scoreFor += scoreA;
      stats[playerA].scoreAgainst += scoreB;
      if (pointsAwarded[playerA] > 0) stats[playerA].wins++;
    }

    if (stats[playerB]) {
      stats[playerB].matchesPlayed++;
      stats[playerB].points += pointsAwarded[playerB] ?? 0;
      stats[playerB].scoreFor += scoreB;
      stats[playerB].scoreAgainst += scoreA;
      if (pointsAwarded[playerB] > 0) stats[playerB].wins++;
    }
  }

  // Include final match in games played and scores (but league points are not altered by the final)
  const { playerA, playerB, scoreA, scoreB } = final;
  if (stats[playerA]) {
    stats[playerA].matchesPlayed++;
    stats[playerA].scoreFor += scoreA;
    stats[playerA].scoreAgainst += scoreB;
    if (scoreA > scoreB) stats[playerA].wins++;
  }
  if (stats[playerB]) {
    stats[playerB].matchesPlayed++;
    stats[playerB].scoreFor += scoreB;
    stats[playerB].scoreAgainst += scoreA;
    if (scoreB > scoreA) stats[playerB].wins++;
  }

  // 5. Build rows
  const rows: TournamentRow[] = playerIds.map((pid) => ({
    playerId: pid,
    points: stats[pid].points,
    wins: stats[pid].wins,
    matchesPlayed: stats[pid].matchesPlayed,
    pointDiff: stats[pid].scoreFor - stats[pid].scoreAgainst,
    rank: 0,
    dayPoints: dayPointsMap[pid] ?? 0,
  }));

  // 6. Sort by overall points (winner gets N so finishes 1st, loser gets N-1 or N-2 so finishes 2nd)
  rows.sort((a, b) => {
    const dayA = dayPointsMap[a.playerId] ?? 0;
    const dayB = dayPointsMap[b.playerId] ?? 0;
    if (dayB !== dayA) return dayB - dayA;

    // Tiebreak: if final loser with penalty and 3rd place both have N - 2 overall points,
    // the finalist finishes 2nd and the non-finalist finishes 3rd
    const aIsFinalist = a.playerId === winnerId || a.playerId === loserId;
    const bIsFinalist = b.playerId === winnerId || b.playerId === loserId;
    if (aIsFinalist && !bIsFinalist) return -1;
    if (!aIsFinalist && bIsFinalist) return 1;

    // Secondary: round-robin points and pointDiff
    if (b.points !== a.points) return b.points - a.points;
    return b.pointDiff - a.pointDiff;
  });

  // Assign final ranks
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
  const table = computeRoundRobinTable(tournament);

  // Check if positions 1 and 2 are tied in points
  const first = table[0];
  const second = table[1];

  // Head-to-head tiebreak between positions 1 and 2
  if (first.points === second.points) {
    const h2h = tournament.matches.find(
      (m) =>
        m.played &&
        !m.isFinal &&
        m.round !== -1 &&
        ((m.playerA === first.playerId && m.playerB === second.playerId) ||
          (m.playerA === second.playerId && m.playerB === first.playerId))
    );

    if (h2h && h2h.scoreA !== undefined && h2h.scoreB !== undefined) {
      const h2hWinner = h2h.scoreA > h2h.scoreB ? h2h.playerA : h2h.playerB;
      if (h2hWinner === second.playerId) {
        return { finalistIds: [second.playerId, first.playerId], needsCoinFlip: false };
      }
    }

    if (first.pointDiff === second.pointDiff) {
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
 * - Winner of final gets N points.
 * - Loser of final gets N - 1 points (or N - 2 points if blowout penalty margin >= finalBonusMargin).
 * - 3rd place gets N - 2 points, 4th gets N - 3 points, etc.
 */
export function computeDayPoints(tournament: Tournament): { [playerId: string]: number } {
  const table = computeTournamentTable(tournament);
  const dayPoints: { [playerId: string]: number } = {};

  table.forEach((row) => {
    dayPoints[row.playerId] = row.dayPoints ?? Math.max(1, table.length - row.rank + 1);
  });

  return dayPoints;
}

/**
 * Check if all round-robin matches have been played.
 */
export function isRoundRobinComplete(tournament: Tournament): boolean {
  return tournament.matches.filter((m) => !m.isFinal && m.round !== -1).every((m) => m.played);
}
