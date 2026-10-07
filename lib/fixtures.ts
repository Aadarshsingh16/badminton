// lib/fixtures.ts — Round-robin fixture generation using the circle method

import { Match } from "./types";

function makeMatch(round: number, playerA: string, playerB: string, matchIndex: number): Match {
  // Alternate court sides based on round + match index
  const flip = (round + matchIndex) % 2 === 0;
  return {
    id: `r${round}-m${matchIndex}-${playerA}-${playerB}`,
    round,
    playerA,
    playerB,
    courtSide: {
      [playerA]: flip ? 1 : 2,
      [playerB]: flip ? 2 : 1,
    },
    played: false,
  };
}

/**
 * Generate a full round-robin schedule using the circle method.
 * Guarantees every player plays every other player exactly once: N * (N - 1) / 2 matches.
 * No player gets a bye — all matches are scheduled sequentially for single-court play.
 */
export function generateRoundRobin(playerIds: string[]): {
  matches: Match[];
  byes: { [round: number]: string | null };
} {
  const ids = [...playerIds];
  const hasDummy = ids.length % 2 !== 0;
  if (hasDummy) ids.push("__DUMMY__");

  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;

  let arr = [...ids];
  const rawMatches: { a: string; b: string }[] = [];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];

      if (a !== "__DUMMY__" && b !== "__DUMMY__") {
        rawMatches.push({ a, b });
      }
    }

    // Rotate: keep arr[0] fixed, rotate the rest clockwise
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }

  // Number matches sequentially 0..total-1 with alternating court sides
  const matches: Match[] = rawMatches.map((pair, idx) => {
    const flip = idx % 2 === 0;
    const uniqueSuffix = Math.random().toString(36).slice(2, 8);
    return {
      id: `m${idx + 1}-${pair.a}-${pair.b}-${uniqueSuffix}`,
      round: idx,
      playerA: pair.a,
      playerB: pair.b,
      courtSide: {
        [pair.a]: flip ? 1 : 2,
        [pair.b]: flip ? 2 : 1,
      },
      played: false,
    };
  });

  return { matches, byes: {} };
}

/**
 * Returns true if every player has played every other player exactly once.
 * Useful for testing.
 */
export function validateRoundRobin(playerIds: string[], matches: Match[]): boolean {
  const pairs = new Set<string>();
  for (const m of matches) {
    const key = [m.playerA, m.playerB].sort().join("|");
    if (pairs.has(key)) return false;
    pairs.add(key);
  }
  // Each pair should appear exactly once
  const expectedPairs = (playerIds.length * (playerIds.length - 1)) / 2;
  return pairs.size === expectedPairs;
}
