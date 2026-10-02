// lib/scoring.ts — Points logic for round-robin and final (config-driven)

import { TournamentConfig, DEFAULT_CONFIG } from "./types";

/**
 * Round-robin match scoring.
 * Winner earns winPoints + bonusPoints if margin >= bonusMargin, else just winPoints.
 */
export function pointsForMatch(
  scoreWinner: number,
  scoreLoser: number,
  config: TournamentConfig = DEFAULT_CONFIG
): number {
  const margin = scoreWinner - scoreLoser;
  return margin >= config.bonusMargin
    ? config.winPoints + config.bonusPoints
    : config.winPoints;
}

/**
 * Final match scoring (config-driven).
 * Winner: winBase + winBonus if big margin, else just winBase
 * Loser:  finalLoserPenalty if big margin, else 0
 */
export function pointsForFinal(
  scoreWinner: number,
  scoreLoser: number,
  isWinner: boolean,
  config: TournamentConfig = DEFAULT_CONFIG
): number {
  const margin = scoreWinner - scoreLoser;
  if (isWinner) {
    return margin >= config.finalBonusMargin
      ? config.finalWinBase + config.finalWinBonus
      : config.finalWinBase;
  }
  return margin >= config.finalBonusMargin ? config.finalLoserPenalty : 0;
}

/**
 * Determine winner/loser from a round-robin match score.
 * Returns { winnerId, loserId, pointsForWinner } or null if not played.
 */
export function getMatchResult(
  playerAId: string,
  playerBId: string,
  scoreA: number,
  scoreB: number,
  config: TournamentConfig = DEFAULT_CONFIG
): { winnerId: string; loserId: string; pointsForWinner: number } | null {
  if (scoreA === scoreB) return null;
  const winnerId = scoreA > scoreB ? playerAId : playerBId;
  const loserId = scoreA > scoreB ? playerBId : playerAId;
  const winScore = Math.max(scoreA, scoreB);
  const loseScore = Math.min(scoreA, scoreB);
  return {
    winnerId,
    loserId,
    pointsForWinner: pointsForMatch(winScore, loseScore, config),
  };
}
