// backend/src/lib/scoring.ts — Ported from frontend lib/scoring.ts

export interface TournamentConfig {
  winScore: number;
  bonusMargin: number;
  winPoints: number;
  bonusPoints: number;
  finalWinScore: number;
  finalBonusMargin: number;
  finalWinBase: number;
  finalWinBonus: number;
  finalLoserPenalty: number;
}

export const DEFAULT_CONFIG: TournamentConfig = {
  winScore: 5,
  bonusMargin: 4,
  winPoints: 2,
  bonusPoints: 1,
  finalWinScore: 6,
  finalBonusMargin: 4,
  finalWinBase: 2,
  finalWinBonus: 0,
  finalLoserPenalty: -1,
};

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
 * Winner: earns finalWinBase (+2) as flat reward for winning the final.
 * Loser:  finalLoserPenalty (-1) if margin >= finalBonusMargin, else 0.
 */
export function pointsForFinal(
  scoreWinner: number,
  scoreLoser: number,
  isWinner: boolean,
  config: TournamentConfig = DEFAULT_CONFIG
): number {
  const margin = scoreWinner - scoreLoser;
  if (isWinner) {
    return config.finalWinBonus > 0 && margin >= config.finalBonusMargin
      ? config.finalWinBase + config.finalWinBonus
      : config.finalWinBase;
  }
  return margin >= config.finalBonusMargin ? config.finalLoserPenalty : 0;
}
