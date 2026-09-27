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
 * Supports odd player counts via a rotating BYE slot.
 * Returns { matches, byes } where byes[round] = playerId or null.
 */
export function generateRoundRobin(playerIds: string[]): {
  matches: Match[];
  byes: { [round: number]: string | null };
} {
  const ids = [...playerIds];
  const hasBye = ids.length % 2 !== 0;
  if (hasBye) ids.push("BYE");

  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;

  // Circle method: fix ids[0], rotate the rest
  let arr = [...ids];
  const matches: Match[] = [];
  const byes: { [round: number]: string | null } = {};

  for (let r = 0; r < rounds; r++) {
    let matchIndex = 0;
    byes[r] = null;

    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];

      if (a === "BYE") {
        byes[r] = b;
      } else if (b === "BYE") {
        byes[r] = a;
      } else {
        matches.push(makeMatch(r, a, b, matchIndex));
        matchIndex++;
      }
    }

    // Rotate: keep arr[0] fixed, rotate the rest clockwise
    // [fixed, a, b, c, d, e] → [fixed, e, a, b, c, d]
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }

  return { matches, byes };
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
