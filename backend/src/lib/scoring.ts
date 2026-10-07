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

export function pointsForFinal(
  _scoreWinner: number,
  _scoreLoser: number,
  _isWinner: boolean,
  _config: TournamentConfig = DEFAULT_CONFIG
): number {
  // Final match is strictly for determining 1st vs 2nd place Day Points.
  // It never awards round-robin league match points.
  return 0;
}
