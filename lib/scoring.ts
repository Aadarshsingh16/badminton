// lib/scoring.ts — Points logic for round-robin and final

/**
 * Round-robin match scoring.
 * First to 5 wins. Returns points for each player.
 */
export function pointsForMatch(
  scoreWinner: number,
  scoreLoser: number
): number {
  const margin = scoreWinner - scoreLoser;
  return margin >= 4 ? 3 : 2; // 5-0, 5-1 → 3pts; 5-2, 5-3, 5-4 → 2pts
}

/**
 * Final match scoring. First to 6 wins.
 * Winner: margin ≥ 4 → +3, else +2
 * Loser:  margin ≥ 4 → -1, else 0
 */
export function pointsForFinal(
  scoreWinner: number,
  scoreLoser: number,
  isWinner: boolean
): number {
  const margin = scoreWinner - scoreLoser;
  if (isWinner) {
    return margin >= 4 ? 3 : 2;
  }
  return margin >= 4 ? -1 : 0;
}

/**
 * Determine winner/loser from a round-robin match score.
 * Returns { winnerId, loserId, pointsForWinner } or null if not played.
 */
export function getMatchResult(
  playerAId: string,
  playerBId: string,
  scoreA: number,
  scoreB: number
): { winnerId: string; loserId: string; pointsForWinner: number } | null {
  if (scoreA === scoreB) return null; // shouldn't happen (first to 5/6)
  const winnerId = scoreA > scoreB ? playerAId : playerBId;
  const loserId = scoreA > scoreB ? playerBId : playerAId;
  const winScore = Math.max(scoreA, scoreB);
  const loseScore = Math.min(scoreA, scoreB);
  return {
    winnerId,
    loserId,
    pointsForWinner: pointsForMatch(winScore, loseScore),
  };
}
