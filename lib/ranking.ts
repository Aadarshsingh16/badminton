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

  const hasPlayedMatches = matches.some((m) => m.played && m.scoreA !== undefined && m.scoreB !== undefined);
  rows.forEach((row, i) => {
    row.rank = i + 1;
    row.dayPoints = hasPlayedMatches ? Math.max(1, N - i) : 0;
  });

  return rows;
}

/**
 * Compute the live tournament table for double-elimination.
 */
export function computeDoubleEliminationTable(tournament: Tournament): TournamentRow[] {
  if (!tournament) return [];
  const { playerIds = [], matches = [], config } = tournament;
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

  // Accumulate all played matches
  for (const m of matches) {
    if (!m.played || m.scoreA === undefined || m.scoreB === undefined) continue;
    const { playerA, playerB, scoreA, scoreB } = m;

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
  }

  // Also include final match if separate and played
  if (tournament.final && tournament.final.played && !matches.some((m) => m.id === tournament.final?.id)) {
    const f = tournament.final;
    if (f.scoreA !== undefined && f.scoreB !== undefined) {
      if (stats[f.playerA]) {
        stats[f.playerA].matchesPlayed++;
        stats[f.playerA].scoreFor += f.scoreA;
        stats[f.playerA].scoreAgainst += f.scoreB;
        if (f.scoreA > f.scoreB) stats[f.playerA].wins++;
      }
      if (stats[f.playerB]) {
        stats[f.playerB].matchesPlayed++;
        stats[f.playerB].scoreFor += f.scoreB;
        stats[f.playerB].scoreAgainst += f.scoreA;
        if (f.scoreB > f.scoreA) stats[f.playerB].wins++;
      }
    }
  }

  // Determine ranks & day points based on bracket results
  const rankMap: { [pid: string]: number } = {};
  const dayPointsMap: { [pid: string]: number } = {};

  const findM = (roundKey: string) => matches.find((m) => m.bracketRound === roundKey && m.played);

  const gf = findM("GF") || (tournament.final?.played && tournament.final.bracketRound === "GF" ? tournament.final : undefined);
  const lf = findM("LF");
  const lr3 = findM("LR3");
  const p56 = findM("P56");
  const p78 = findM("P78");
  const lr1 = findM("LR1");

  const gfWinner = gf && gf.scoreA !== undefined && gf.scoreB !== undefined ? (gf.scoreA > gf.scoreB ? gf.playerA : gf.playerB) : null;
  const gfLoser = gf && gf.scoreA !== undefined && gf.scoreB !== undefined ? (gf.scoreA > gf.scoreB ? gf.playerB : gf.playerA) : null;

  const lfWinner = lf && lf.scoreA !== undefined && lf.scoreB !== undefined ? (lf.scoreA > lf.scoreB ? lf.playerA : lf.playerB) : null;
  const lfLoser = lf && lf.scoreA !== undefined && lf.scoreB !== undefined ? (lf.scoreA > lf.scoreB ? lf.playerB : lf.playerA) : null;

  const lr3Loser = lr3 && lr3.scoreA !== undefined && lr3.scoreB !== undefined ? (lr3.scoreA > lr3.scoreB ? lr3.playerB : lr3.playerA) : null;

  const p56Winner = p56 && p56.scoreA !== undefined && p56.scoreB !== undefined ? (p56.scoreA > p56.scoreB ? p56.playerA : p56.playerB) : null;
  const p56Loser = p56 && p56.scoreA !== undefined && p56.scoreB !== undefined ? (p56.scoreA > p56.scoreB ? p56.playerB : p56.playerA) : null;

  const p78Winner = p78 && p78.scoreA !== undefined && p78.scoreB !== undefined ? (p78.scoreA > p78.scoreB ? p78.playerA : p78.playerB) : null;
  const p78Loser = p78 && p78.scoreA !== undefined && p78.scoreB !== undefined ? (p78.scoreA > p78.scoreB ? p78.playerB : p78.playerA) : null;

  const lr1Loser = lr1 && lr1.scoreA !== undefined && lr1.scoreB !== undefined ? (lr1.scoreA > lr1.scoreB ? lr1.playerB : lr1.playerA) : null;

  // Shutout penalties:
  // Grand final: if margin >= finalBonusMargin (default 4), loser gets -1 day point penalty
  const gfMargin = gf && gf.scoreA !== undefined && gf.scoreB !== undefined ? Math.abs(gf.scoreA - gf.scoreB) : 0;
  const gfPenalty = gfMargin >= (config?.finalBonusMargin ?? DEFAULT_CONFIG.finalBonusMargin);

  // Lower final: if margin >= bonusMargin (default 4), loser gets -1 day point penalty
  const lfMargin = lf && lf.scoreA !== undefined && lf.scoreB !== undefined ? Math.abs(lf.scoreA - lf.scoreB) : 0;
  const lfPenalty = lfMargin >= (config?.bonusMargin ?? DEFAULT_CONFIG.bonusMargin);

  if (N === 8) {
    if (gfWinner) { rankMap[gfWinner] = 1; dayPointsMap[gfWinner] = 8; }
    if (gfLoser) { rankMap[gfLoser] = 2; dayPointsMap[gfLoser] = gfPenalty ? 6 : 7; }
    if (lfLoser) { rankMap[lfLoser] = 3; dayPointsMap[lfLoser] = lfPenalty ? 5 : 6; }
    if (lr3Loser) { rankMap[lr3Loser] = 4; dayPointsMap[lr3Loser] = 5; }
    if (p56Winner) { rankMap[p56Winner] = 5; dayPointsMap[p56Winner] = 4; }
    if (p56Loser) { rankMap[p56Loser] = 6; dayPointsMap[p56Loser] = 3; }
    if (p78Winner) { rankMap[p78Winner] = 7; dayPointsMap[p78Winner] = 2; }
    if (p78Loser) { rankMap[p78Loser] = 8; dayPointsMap[p78Loser] = 1; }
  } else if (N === 7) {
    if (gfWinner) { rankMap[gfWinner] = 1; dayPointsMap[gfWinner] = 7; }
    if (gfLoser) { rankMap[gfLoser] = 2; dayPointsMap[gfLoser] = gfPenalty ? 5 : 6; }
    if (lfLoser) { rankMap[lfLoser] = 3; dayPointsMap[lfLoser] = lfPenalty ? 4 : 5; }
    if (lr3Loser) { rankMap[lr3Loser] = 4; dayPointsMap[lr3Loser] = 4; }
    if (p56Winner) { rankMap[p56Winner] = 5; dayPointsMap[p56Winner] = 3; }
    if (p56Loser) { rankMap[p56Loser] = 6; dayPointsMap[p56Loser] = 2; }
    if (lr1Loser) { rankMap[lr1Loser] = 7; dayPointsMap[lr1Loser] = 1; }
  }

  // For any player not yet locked into rank (e.g. tournament still in progress):
  // We sort unassigned players by wins desc, pointDiff desc, scoreFor desc
  const unassigned = playerIds.filter((pid) => rankMap[pid] === undefined);
  unassigned.sort((a, b) => {
    if (stats[b].wins !== stats[a].wins) return stats[b].wins - stats[a].wins;
    const diffA = stats[a].scoreFor - stats[a].scoreAgainst;
    const diffB = stats[b].scoreFor - stats[b].scoreAgainst;
    if (diffB !== diffA) return diffB - diffA;
    return stats[b].scoreFor - stats[a].scoreFor;
  });

  // Find remaining available rank numbers
  const usedRanks = new Set(Object.values(rankMap));
  const availableRanks: number[] = [];
  for (let r = 1; r <= N; r++) {
    if (!usedRanks.has(r)) availableRanks.push(r);
  }

  unassigned.forEach((pid, idx) => {
    const assignedRank = availableRanks[idx] ?? (N - idx);
    rankMap[pid] = assignedRank;
    dayPointsMap[pid] = Math.max(1, N - assignedRank + 1);
  });

  const hasPlayedMatches = matches.some((m) => m.played);

  const rows: TournamentRow[] = playerIds.map((pid) => ({
    playerId: pid,
    points: stats[pid].wins * (config?.winPoints ?? 2),
    wins: stats[pid].wins,
    matchesPlayed: stats[pid].matchesPlayed,
    pointDiff: stats[pid].scoreFor - stats[pid].scoreAgainst,
    rank: rankMap[pid] ?? N,
    dayPoints: hasPlayedMatches ? (dayPointsMap[pid] ?? Math.max(1, N - (rankMap[pid] ?? N) + 1)) : 0,
  }));

  rows.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return b.pointDiff - a.pointDiff;
  });

  return rows;
}

/**
 * Compute the live tournament table.
 * - During round-robin: sorted by league points (wins, bonuses, +/-).
 * - After the final ends: sorted by overall points (winner gets N, loser gets N-1 or N-2 on blowout penalty).
 *   Winner always finishes 1st, runner-up finishes 2nd, and 3rd..Nth are ordered by their league finish.
 * - Double-elimination: determined by bracket placement & placement matches.
 */
export function computeTournamentTable(tournament: Tournament): TournamentRow[] {
  if (!tournament) return [];

  // Branch on double elimination
  if (tournament.config?.format === "double-elimination") {
    return computeDoubleEliminationTable(tournament);
  }

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
  if (!tournament || !tournament.matches) return false;
  return tournament.matches.filter((m) => !m.isFinal && m.round !== -1).every((m) => m.played);
}

/**
 * Check if a tournament is completely finished (either round-robin final played or DE grand final played).
 */
export function isTournamentComplete(tournament: Tournament): boolean {
  if (!tournament) return false;
  if (tournament.config?.format === "double-elimination") {
    const gf = tournament.matches?.find((m) => m.bracketRound === "GF");
    return !!gf?.played;
  }
  return isRoundRobinComplete(tournament) && !!tournament.final?.played;
}

/**
 * Compute the number of upper bracket byes received by each player across past tournaments.
 */
export function computePlayerByeCounts(
  tournaments: Tournament[],
  playerIds: string[]
): { [playerId: string]: number } {
  const counts: { [playerId: string]: number } = {};
  for (const pid of playerIds) {
    counts[pid] = 0;
  }
  for (const t of tournaments) {
    if (t.config?.upperByePlayerId && counts[t.config.upperByePlayerId] !== undefined) {
      counts[t.config.upperByePlayerId]++;
    }
  }
  return counts;
}
