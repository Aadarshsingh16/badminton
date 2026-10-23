// lib/fixtures.ts — Round-robin fixture generation using the circle method

import { Match, Tournament, TournamentConfig } from "./types";

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

// —————————————————————————————————————————————————————————————
// Double Elimination Tournament Engine (7 & 8 Players)
// —————————————————————————————————————————————————————————————

export function getMatchWinner(m: Match): string | null {
  if (!m || !m.played || m.scoreA === undefined || m.scoreB === undefined) return null;
  if (m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? m.playerA : m.playerB;
}

export function getMatchLoser(m: Match): string | null {
  if (!m || !m.played || m.scoreA === undefined || m.scoreB === undefined) return null;
  if (m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? m.playerB : m.playerA;
}

export function isShutout(m: Match, marginThreshold: number): boolean {
  if (!m || !m.played || m.scoreA === undefined || m.scoreB === undefined) return false;
  return Math.abs(m.scoreA - m.scoreB) >= marginThreshold;
}

function makeDEMatch(
  id: string,
  round: number,
  playerA: string,
  playerB: string,
  options: {
    bracket: "upper" | "lower" | "grand-final" | "placement" | "qualifier";
    bracketRound: string;
    label: string;
    targetScore: number;
    matchIndex: number;
    isFinal?: boolean;
  }
): Match {
  const flip = options.matchIndex % 2 === 0;
  return {
    id,
    round,
    playerA,
    playerB,
    courtSide: {
      [playerA]: flip ? 1 : 2,
      [playerB]: flip ? 2 : 1,
    },
    played: false,
    bracket: options.bracket,
    bracketRound: options.bracketRound,
    label: options.label,
    targetScore: options.targetScore,
    isFinal: !!options.isFinal,
  };
}

export function getMatchShortform(m: Match): string {
  if (m.bracketRound) {
    if (m.bracketRound === "UQ") {
      const num = m.id.replace("de-uq-", "");
      return num ? `UQF${num}` : "UQF";
    }
    if (m.bracketRound === "US") {
      const num = m.id.replace("de-us-", "");
      return num ? `US${num}` : "US";
    }
    if (m.bracketRound === "Q-DECIDER") return "Q-DEC";
    if (m.bracketRound === "Q-RR") {
      const num = m.id.replace("de-q-rr-", "");
      return num ? `QRR${num}` : "QRR";
    }
    return m.bracketRound;
  }
  if (m.id.startsWith("de-")) {
    if (m.id.startsWith("de-uq-")) return `UQF${m.id.replace("de-uq-", "")}`;
    if (m.id.startsWith("de-us-")) return `US${m.id.replace("de-us-", "")}`;
    if (m.id === "de-uf") return "UF";
    if (m.id.startsWith("de-lr1-")) return `LR1-${m.id.replace("de-lr1-", "")}`;
    if (m.id === "de-lr1") return "LR1";
    if (m.id.startsWith("de-lr2-")) return `LR2-${m.id.replace("de-lr2-", "")}`;
    if (m.id === "de-lr2") return "LR2";
    if (m.id === "de-lr3") return "LR3";
    if (m.id === "de-lf") return "LF";
    if (m.id === "de-gf") return "GF";
    if (m.id === "de-p78") return "P78";
    if (m.id === "de-p56") return "P56";
    if (m.id === "de-q-decider") return "Q-DEC";
    if (m.id.startsWith("de-q-rr-")) return `QRR${m.id.replace("de-q-rr-", "")}`;
  }
  if (m.round === -1 || m.isFinal) return "GF";
  return `R${m.round + 1}`;
}

/**
 * Generate the initial matches for a 7 or 8 player Double Elimination tournament.
 */
export function generateDoubleElimination(
  playerIds: string[],
  config: TournamentConfig
): {
  matches: Match[];
  byes: { [round: number]: string | null };
} {
  const count = playerIds.length;
  const winScore = config.winScore || 5;

  if (count === 8) {
    // 8 players -> 4 Upper Quarterfinal matches
    const [p1, p2, p3, p4, p5, p6, p7, p8] = playerIds;
    const matches: Match[] = [
      makeDEMatch("de-uq-1", 1, p1, p2, {
        bracket: "upper",
        bracketRound: "UQF1",
        label: "Upper Quarterfinal 1",
        targetScore: winScore,
        matchIndex: 0,
      }),
      makeDEMatch("de-uq-2", 1, p3, p4, {
        bracket: "upper",
        bracketRound: "UQF2",
        label: "Upper Quarterfinal 2",
        targetScore: winScore,
        matchIndex: 1,
      }),
      makeDEMatch("de-uq-3", 1, p5, p6, {
        bracket: "upper",
        bracketRound: "UQF3",
        label: "Upper Quarterfinal 3",
        targetScore: winScore,
        matchIndex: 2,
      }),
      makeDEMatch("de-uq-4", 1, p7, p8, {
        bracket: "upper",
        bracketRound: "UQF4",
        label: "Upper Quarterfinal 4",
        targetScore: winScore,
        matchIndex: 3,
      }),
    ];
    return { matches, byes: {} };
  }

  if (count === 7) {
    // 7 players -> 1 player receives the Upper Bye to Upper Semifinal 2
    const upperByePlayerId = config.upperByePlayerId && playerIds.includes(config.upperByePlayerId)
      ? config.upperByePlayerId
      : playerIds[playerIds.length - 1];

    const activePlayers = playerIds.filter((id) => id !== upperByePlayerId);
    const [p1, p2, p3, p4, p5, p6] = activePlayers;

    const matches: Match[] = [
      makeDEMatch("de-uq-1", 1, p1, p3, {
        bracket: "upper",
        bracketRound: "UQF1",
        label: "Upper Quarterfinal 1",
        targetScore: winScore,
        matchIndex: 0,
      }),
      makeDEMatch("de-uq-2", 1, p2, p4, {
        bracket: "upper",
        bracketRound: "UQF2",
        label: "Upper Quarterfinal 2",
        targetScore: winScore,
        matchIndex: 1,
      }),
      makeDEMatch("de-uq-3", 1, p5, p6, {
        bracket: "upper",
        bracketRound: "UQF3",
        label: "Upper Quarterfinal 3",
        targetScore: winScore,
        matchIndex: 2,
      }),
    ];

    return {
      matches,
      byes: { 1: upperByePlayerId },
    };
  }

  // Fallback for unexpected counts
  return generateRoundRobin(playerIds);
}

/**
 * Advance a double-elimination tournament bracket based on played matches.
 * Dynamically spawns or updates subsequent matches (US, LR1, LR2, Qualifiers, Placements, Finals).
 */
export function advanceDoubleElimination(tournament: Tournament): Tournament {
  if (tournament.config?.format !== "double-elimination") return tournament;

  const config = tournament.config;
  const count = tournament.playerIds.length;
  const matches = [...tournament.matches];
  const winScore = config.winScore || 5;
  const deciderScore = config.deciderWinScore || 3;
  const finalScore = config.finalWinScore || 6;
  const bonusMargin = config.bonusMargin || 4;

  const findMatch = (id: string) => matches.find((m) => m.id === id);

  const addOrUpdateMatch = (
    id: string,
    round: number,
    playerA: string,
    playerB: string,
    options: {
      bracket: "upper" | "lower" | "grand-final" | "placement" | "qualifier";
      bracketRound: string;
      label: string;
      targetScore: number;
      matchIndex: number;
      isFinal?: boolean;
    }
  ) => {
    const existingIdx = matches.findIndex((m) => m.id === id);
    if (existingIdx >= 0) {
      const existing = matches[existingIdx];
      // If unplayed and players differ, update them
      if (!existing.played && (existing.playerA !== playerA || existing.playerB !== playerB)) {
        matches[existingIdx] = {
          ...existing,
          playerA,
          playerB,
          courtSide: { [playerA]: 1, [playerB]: 2 },
        };
      }
    } else {
      matches.push(makeDEMatch(id, round, playerA, playerB, options));
    }
  };

  if (count === 8) {
    const uq1 = findMatch("de-uq-1");
    const uq2 = findMatch("de-uq-2");
    const uq3 = findMatch("de-uq-3");
    const uq4 = findMatch("de-uq-4");

    const wUQ1 = uq1 ? getMatchWinner(uq1) : null;
    const lUQ1 = uq1 ? getMatchLoser(uq1) : null;
    const wUQ2 = uq2 ? getMatchWinner(uq2) : null;
    const lUQ2 = uq2 ? getMatchLoser(uq2) : null;
    const wUQ3 = uq3 ? getMatchWinner(uq3) : null;
    const lUQ3 = uq3 ? getMatchLoser(uq3) : null;
    const wUQ4 = uq4 ? getMatchWinner(uq4) : null;
    const lUQ4 = uq4 ? getMatchLoser(uq4) : null;

    // Upper Semifinal 1
    if (wUQ1 && wUQ2) {
      addOrUpdateMatch("de-us-1", 2, wUQ1, wUQ2, {
        bracket: "upper",
        bracketRound: "US1",
        label: "Upper Semifinal 1",
        targetScore: winScore,
        matchIndex: 4,
      });
    }

    // Upper Semifinal 2
    if (wUQ3 && wUQ4) {
      addOrUpdateMatch("de-us-2", 2, wUQ3, wUQ4, {
        bracket: "upper",
        bracketRound: "US2",
        label: "Upper Semifinal 2",
        targetScore: winScore,
        matchIndex: 5,
      });
    }

    // Lower Round 1 - Match 1
    if (lUQ1 && lUQ2) {
      addOrUpdateMatch("de-lr1-1", 2, lUQ1, lUQ2, {
        bracket: "lower",
        bracketRound: "LR1",
        label: "Lower Round 1 (Match 1)",
        targetScore: winScore,
        matchIndex: 6,
      });
    }

    // Lower Round 1 - Match 2
    if (lUQ3 && lUQ4) {
      addOrUpdateMatch("de-lr1-2", 2, lUQ3, lUQ4, {
        bracket: "lower",
        bracketRound: "LR1",
        label: "Lower Round 1 (Match 2)",
        targetScore: winScore,
        matchIndex: 7,
      });
    }

    const lr1_1 = findMatch("de-lr1-1");
    const lr1_2 = findMatch("de-lr1-2");
    const wLR1_1 = lr1_1 ? getMatchWinner(lr1_1) : null;
    const lLR1_1 = lr1_1 ? getMatchLoser(lr1_1) : null;
    const wLR1_2 = lr1_2 ? getMatchWinner(lr1_2) : null;
    const lLR1_2 = lr1_2 ? getMatchLoser(lr1_2) : null;

    // 7th / 8th Placement Match
    if (lLR1_1 && lLR1_2) {
      addOrUpdateMatch("de-p78", 3, lLR1_1, lLR1_2, {
        bracket: "placement",
        bracketRound: "P78",
        label: "7th / 8th Place Decider",
        targetScore: winScore,
        matchIndex: 8,
      });
    }

    const us1 = findMatch("de-us-1");
    const us2 = findMatch("de-us-2");
    const wUS1 = us1 ? getMatchWinner(us1) : null;
    const lUS1 = us1 ? getMatchLoser(us1) : null;
    const wUS2 = us2 ? getMatchWinner(us2) : null;
    const lUS2 = us2 ? getMatchLoser(us2) : null;

    // Lower Round 2 - Match 1 (wLR1_1 vs lUS2)
    if (wLR1_1 && lUS2) {
      addOrUpdateMatch("de-lr2-1", 3, wLR1_1, lUS2, {
        bracket: "lower",
        bracketRound: "LR2",
        label: "Lower Round 2 (Match 1)",
        targetScore: winScore,
        matchIndex: 9,
      });
    }

    // Lower Round 2 - Match 2 (wLR1_2 vs lUS1)
    if (wLR1_2 && lUS1) {
      addOrUpdateMatch("de-lr2-2", 3, wLR1_2, lUS1, {
        bracket: "lower",
        bracketRound: "LR2",
        label: "Lower Round 2 (Match 2)",
        targetScore: winScore,
        matchIndex: 10,
      });
    }

    // Upper Final
    if (wUS1 && wUS2) {
      addOrUpdateMatch("de-uf", 3, wUS1, wUS2, {
        bracket: "upper",
        bracketRound: "UF",
        label: "Upper Final",
        targetScore: winScore,
        matchIndex: 11,
      });
    }

    const lr2_1 = findMatch("de-lr2-1");
    const lr2_2 = findMatch("de-lr2-2");
    const wLR2_1 = lr2_1 ? getMatchWinner(lr2_1) : null;
    const lLR2_1 = lr2_1 ? getMatchLoser(lr2_1) : null;
    const wLR2_2 = lr2_2 ? getMatchWinner(lr2_2) : null;
    const lLR2_2 = lr2_2 ? getMatchLoser(lr2_2) : null;

    // 5th / 6th Placement Match
    if (lLR2_1 && lLR2_2) {
      addOrUpdateMatch("de-p56", 4, lLR2_1, lLR2_2, {
        bracket: "placement",
        bracketRound: "P56",
        label: "5th / 6th Place Decider",
        targetScore: winScore,
        matchIndex: 12,
      });
    }

    // Lower Round 3
    if (wLR2_1 && wLR2_2) {
      addOrUpdateMatch("de-lr3", 4, wLR2_1, wLR2_2, {
        bracket: "lower",
        bracketRound: "LR3",
        label: "Lower Round 3",
        targetScore: winScore,
        matchIndex: 13,
      });
    }

    const uf = findMatch("de-uf");
    const lr3 = findMatch("de-lr3");
    const wUF = uf ? getMatchWinner(uf) : null;
    const lUF = uf ? getMatchLoser(uf) : null;
    const wLR3 = lr3 ? getMatchWinner(lr3) : null;

    // Lower Final
    if (wLR3 && lUF) {
      addOrUpdateMatch("de-lf", 5, lUF, wLR3, {
        bracket: "lower",
        bracketRound: "LF",
        label: "Lower Final",
        targetScore: winScore,
        matchIndex: 14,
      });
    }

    const lf = findMatch("de-lf");
    const wLF = lf ? getMatchWinner(lf) : null;

    // Grand Final
    if (wUF && wLF) {
      addOrUpdateMatch("de-gf", 6, wUF, wLF, {
        bracket: "grand-final",
        bracketRound: "GF",
        label: "Grand Championship Final",
        targetScore: finalScore,
        matchIndex: 15,
        isFinal: true,
      });
    }
  }

  if (count === 7) {
    const upperByePlayerId = config.upperByePlayerId && tournament.playerIds.includes(config.upperByePlayerId)
      ? config.upperByePlayerId
      : tournament.playerIds[tournament.playerIds.length - 1];

    const uq1 = findMatch("de-uq-1");
    const uq2 = findMatch("de-uq-2");
    const uq3 = findMatch("de-uq-3");

    const wUQ1 = uq1 ? getMatchWinner(uq1) : null;
    const lUQ1 = uq1 ? getMatchLoser(uq1) : null;
    const wUQ2 = uq2 ? getMatchWinner(uq2) : null;
    const lUQ2 = uq2 ? getMatchLoser(uq2) : null;
    const wUQ3 = uq3 ? getMatchWinner(uq3) : null;
    const lUQ3 = uq3 ? getMatchLoser(uq3) : null;

    // Upper Semifinal 1 (Winner UQ1 vs Winner UQ2)
    if (wUQ1 && wUQ2) {
      addOrUpdateMatch("de-us-1", 2, wUQ1, wUQ2, {
        bracket: "upper",
        bracketRound: "US1",
        label: "Upper Semifinal 1",
        targetScore: winScore,
        matchIndex: 3,
      });
    }

    // Upper Semifinal 2 (Winner UQ3 vs Upper Bye Player)
    if (wUQ3 && upperByePlayerId) {
      addOrUpdateMatch("de-us-2", 2, wUQ3, upperByePlayerId, {
        bracket: "upper",
        bracketRound: "US2",
        label: "Upper Semifinal 2",
        targetScore: winScore,
        matchIndex: 4,
      });
    }

    // When UQ1, UQ2, UQ3 are ALL finished: resolve the 3 losers for the Lower Qualifier
    if (uq1?.played && uq2?.played && uq3?.played && lUQ1 && lUQ2 && lUQ3) {
      const uqMatches = [
        { loserId: lUQ1, match: uq1 },
        { loserId: lUQ2, match: uq2 },
        { loserId: lUQ3, match: uq3 },
      ];

      const shutouts = uqMatches.filter(({ match }) => isShutout(match, bonusMargin));
      const nonShutouts = uqMatches.filter(({ match }) => !isShutout(match, bonusMargin));

      let lr2ByePlayer: string | null = null;
      let lr1PlayerA: string | null = null;
      let lr1PlayerB: string | null = null;

      if (shutouts.length === 2) {
        // Case B: Exactly 2 shutouts -> non-shutout player automatically gets the LR2 bye
        lr2ByePlayer = nonShutouts[0].loserId;
        lr1PlayerA = shutouts[0].loserId;
        lr1PlayerB = shutouts[1].loserId;
      } else if (shutouts.length === 1) {
        // Case C: Exactly 1 shutout -> 2 non-shutout players play a 3-point decider
        const [n1, n2] = nonShutouts.map((x) => x.loserId);
        const s = shutouts[0].loserId;

        addOrUpdateMatch("de-q-decider", 2, n1, n2, {
          bracket: "qualifier",
          bracketRound: "Q-DECIDER",
          label: "3-Point Bye Decider",
          targetScore: deciderScore,
          matchIndex: 5,
        });

        const qDecider = findMatch("de-q-decider");
        if (qDecider?.played) {
          const wQ = getMatchWinner(qDecider);
          const lQ = getMatchLoser(qDecider);
          if (wQ && lQ) {
            lr2ByePlayer = wQ;
            lr1PlayerA = lQ;
            lr1PlayerB = s;
          }
        }
      } else {
        // Case A: 0 or 3 shutouts -> 3 players play a 3-man mini round-robin (first to deciderScore)
        const [pA, pB, pC] = [lUQ1, lUQ2, lUQ3];
        addOrUpdateMatch("de-q-rr-1", 2, pA, pB, {
          bracket: "qualifier",
          bracketRound: "Q-RR",
          label: "3-Man Bye Qualifier (Match 1)",
          targetScore: deciderScore,
          matchIndex: 5,
        });
        addOrUpdateMatch("de-q-rr-2", 2, pB, pC, {
          bracket: "qualifier",
          bracketRound: "Q-RR",
          label: "3-Man Bye Qualifier (Match 2)",
          targetScore: deciderScore,
          matchIndex: 6,
        });
        addOrUpdateMatch("de-q-rr-3", 2, pC, pA, {
          bracket: "qualifier",
          bracketRound: "Q-RR",
          label: "3-Man Bye Qualifier (Match 3)",
          targetScore: deciderScore,
          matchIndex: 7,
        });

        const q1 = findMatch("de-q-rr-1");
        const q2 = findMatch("de-q-rr-2");
        const q3 = findMatch("de-q-rr-3");

        if (q1?.played && q2?.played && q3?.played) {
          const qStats: {
            [pid: string]: { wins: number; diff: number; uqDiff: number; uqFor: number };
          } = {};

          for (const pid of [pA, pB, pC]) {
            qStats[pid] = { wins: 0, diff: 0, uqDiff: 0, uqFor: 0 };
            const uq = [uq1, uq2, uq3].find((m) => m.playerA === pid || m.playerB === pid);
            if (uq && uq.scoreA !== undefined && uq.scoreB !== undefined) {
              const isA = uq.playerA === pid;
              qStats[pid].uqDiff = isA ? uq.scoreA - uq.scoreB : uq.scoreB - uq.scoreA;
              qStats[pid].uqFor = isA ? uq.scoreA : uq.scoreB;
            }
          }

          for (const qm of [q1, q2, q3]) {
            if (qm.scoreA !== undefined && qm.scoreB !== undefined) {
              if (qm.scoreA > qm.scoreB) {
                qStats[qm.playerA].wins++;
              } else {
                qStats[qm.playerB].wins++;
              }
              qStats[qm.playerA].diff += qm.scoreA - qm.scoreB;
              qStats[qm.playerB].diff += qm.scoreB - qm.scoreA;
            }
          }

          const sortedQ = [pA, pB, pC].sort((a, b) => {
            if (qStats[b].wins !== qStats[a].wins) return qStats[b].wins - qStats[a].wins;
            if (qStats[b].diff !== qStats[a].diff) return qStats[b].diff - qStats[a].diff;
            if (qStats[b].uqDiff !== qStats[a].uqDiff) return qStats[b].uqDiff - qStats[a].uqDiff;
            return qStats[b].uqFor - qStats[a].uqFor;
          });

          lr2ByePlayer = sortedQ[0];
          lr1PlayerA = sortedQ[1];
          lr1PlayerB = sortedQ[2];
        }
      }

      // Schedule Lower Round 1 once players are resolved
      if (lr1PlayerA && lr1PlayerB) {
        addOrUpdateMatch("de-lr1", 3, lr1PlayerA, lr1PlayerB, {
          bracket: "lower",
          bracketRound: "LR1",
          label: "Lower Round 1",
          targetScore: winScore,
          matchIndex: 8,
        });
      }

      const lr1 = findMatch("de-lr1");
      const wLR1 = lr1 ? getMatchWinner(lr1) : null;
      const us1 = findMatch("de-us-1");
      const us2 = findMatch("de-us-2");
      const lUS1 = us1 ? getMatchLoser(us1) : null;
      const wUS1 = us1 ? getMatchWinner(us1) : null;
      const lUS2 = us2 ? getMatchLoser(us2) : null;
      const wUS2 = us2 ? getMatchWinner(us2) : null;

      // Lower Round 2 - Match 1 (wLR1 vs lUS1)
      if (wLR1 && lUS1) {
        addOrUpdateMatch("de-lr2-1", 4, wLR1, lUS1, {
          bracket: "lower",
          bracketRound: "LR2",
          label: "Lower Round 2 (Match 1)",
          targetScore: winScore,
          matchIndex: 9,
        });
      }

      // Lower Round 2 - Match 2 (lr2ByePlayer vs lUS2)
      if (lr2ByePlayer && lUS2) {
        addOrUpdateMatch("de-lr2-2", 4, lr2ByePlayer, lUS2, {
          bracket: "lower",
          bracketRound: "LR2",
          label: "Lower Round 2 (Match 2)",
          targetScore: winScore,
          matchIndex: 10,
        });
      }

      // Upper Final (wUS1 vs wUS2)
      if (wUS1 && wUS2) {
        addOrUpdateMatch("de-uf", 4, wUS1, wUS2, {
          bracket: "upper",
          bracketRound: "UF",
          label: "Upper Final",
          targetScore: winScore,
          matchIndex: 11,
        });
      }

      const lr2_1 = findMatch("de-lr2-1");
      const lr2_2 = findMatch("de-lr2-2");
      const wLR2_1 = lr2_1 ? getMatchWinner(lr2_1) : null;
      const lLR2_1 = lr2_1 ? getMatchLoser(lr2_1) : null;
      const wLR2_2 = lr2_2 ? getMatchWinner(lr2_2) : null;
      const lLR2_2 = lr2_2 ? getMatchLoser(lr2_2) : null;

      // 5th / 6th Placement Match (lLR2_1 vs lLR2_2)
      if (lLR2_1 && lLR2_2) {
        addOrUpdateMatch("de-p56", 5, lLR2_1, lLR2_2, {
          bracket: "placement",
          bracketRound: "P56",
          label: "5th / 6th Place Decider",
          targetScore: winScore,
          matchIndex: 12,
        });
      }

      // Lower Round 3 (wLR2_1 vs wLR2_2)
      if (wLR2_1 && wLR2_2) {
        addOrUpdateMatch("de-lr3", 5, wLR2_1, wLR2_2, {
          bracket: "lower",
          bracketRound: "LR3",
          label: "Lower Round 3",
          targetScore: winScore,
          matchIndex: 13,
        });
      }

      const uf = findMatch("de-uf");
      const lr3 = findMatch("de-lr3");
      const wUF = uf ? getMatchWinner(uf) : null;
      const lUF = uf ? getMatchLoser(uf) : null;
      const wLR3 = lr3 ? getMatchWinner(lr3) : null;

      // Lower Final (lUF vs wLR3)
      if (wLR3 && lUF) {
        addOrUpdateMatch("de-lf", 6, lUF, wLR3, {
          bracket: "lower",
          bracketRound: "LF",
          label: "Lower Final",
          targetScore: winScore,
          matchIndex: 14,
        });
      }

      const lf = findMatch("de-lf");
      const wLF = lf ? getMatchWinner(lf) : null;

      // Grand Final (wUF vs wLF)
      if (wUF && wLF) {
        addOrUpdateMatch("de-gf", 7, wUF, wLF, {
          bracket: "grand-final",
          bracketRound: "GF",
          label: "Grand Championship Final",
          targetScore: finalScore,
          matchIndex: 15,
          isFinal: true,
        });
      }
    }
  }

  // Ensure tournament.final references the Grand Final if created
  const grandFinal = matches.find((m) => m.bracketRound === "GF");

  return {
    ...tournament,
    matches,
    final: grandFinal || tournament.final,
  };
}

/**
 * Returns true if the double-elimination tournament is complete (Grand Final played).
 */
export function isDoubleEliminationComplete(tournament: Tournament): boolean {
  if (!tournament || !tournament.matches) return false;
  const gf = tournament.matches.find((m) => m.bracketRound === "GF");
  return !!gf?.played;
}
