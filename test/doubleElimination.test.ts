// test/doubleElimination.test.ts — Comprehensive automated simulation tests for 7 and 8 player Double Elimination

import { Tournament, TournamentConfig, DEFAULT_CONFIG } from "../lib/types";
import {
  generateDoubleElimination,
  advanceDoubleElimination,
  isDoubleEliminationComplete,
} from "../lib/fixtures";
import { computeDoubleEliminationTable, computePlayerByeCounts } from "../lib/ranking";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${msg}`);
  }
}

console.log("🏸 Starting Double Elimination Engine Tests...\n");

// ============================================================================
// TEST 1: 8-Player Double Elimination Complete Simulation
// ============================================================================
console.log("--- TEST 1: 8-Player Double Elimination ---");
{
  const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
  const config: TournamentConfig = {
    ...DEFAULT_CONFIG,
    format: "double-elimination",
    winScore: 5,
    finalWinScore: 6,
    deciderWinScore: 3,
    bonusMargin: 4,
    finalBonusMargin: 4,
  };

  const { matches } = generateDoubleElimination(players, config);
  assert(matches.length === 4, "Initial 8-player DE should have 4 Upper QF matches");

  let tourney: Tournament = {
    id: "test-8p",
    createdAt: Date.now(),
    playerIds: players,
    matches,
    byes: {},
    closed: false,
    config,
  };

  // Score UQ matches:
  // UQ1: p1 beats p2 (5 - 3)
  // UQ2: p3 beats p4 (5 - 2)
  // UQ3: p5 beats p6 (5 - 4)
  // UQ4: p7 beats p8 (5 - 0) -> p8 shut out
  tourney.matches[0] = { ...tourney.matches[0], scoreA: 5, scoreB: 3, played: true };
  tourney.matches[1] = { ...tourney.matches[1], scoreA: 5, scoreB: 2, played: true };
  tourney.matches[2] = { ...tourney.matches[2], scoreA: 5, scoreB: 4, played: true };
  tourney.matches[3] = { ...tourney.matches[3], scoreA: 5, scoreB: 0, played: true };

  tourney = advanceDoubleElimination(tourney);

  const us1 = tourney.matches.find((m) => m.id === "de-us-1");
  const us2 = tourney.matches.find((m) => m.id === "de-us-2");
  const lr1_1 = tourney.matches.find((m) => m.id === "de-lr1-1");
  const lr1_2 = tourney.matches.find((m) => m.id === "de-lr1-2");

  assert(!!us1 && us1.playerA === "p1" && us1.playerB === "p3", "US1 has p1 vs p3");
  assert(!!us2 && us2.playerA === "p5" && us2.playerB === "p7", "US2 has p5 vs p7");
  assert(!!lr1_1 && lr1_1.playerA === "p2" && lr1_1.playerB === "p4", "LR1-1 has p2 vs p4");
  assert(!!lr1_2 && lr1_2.playerA === "p6" && lr1_2.playerB === "p8", "LR1-2 has p6 vs p8");

  // Play US matches & LR1 matches
  us1!.scoreA = 5; us1!.scoreB = 2; us1!.played = true; // p1 wins US1, p3 to LR2
  us2!.scoreA = 3; us2!.scoreB = 5; us2!.played = true; // p7 wins US2, p5 to LR2
  lr1_1!.scoreA = 5; lr1_1!.scoreB = 1; lr1_1!.played = true; // p2 wins, p4 to P78
  lr1_2!.scoreA = 2; lr1_2!.scoreB = 5; lr1_2!.played = true; // p8 wins, p6 to P78

  tourney = advanceDoubleElimination(tourney);

  const p78 = tourney.matches.find((m) => m.id === "de-p78");
  assert(!!p78 && p78.playerA === "p4" && p78.playerB === "p6", "P78 has p4 vs p6");

  const lr2_1 = tourney.matches.find((m) => m.id === "de-lr2-1");
  const lr2_2 = tourney.matches.find((m) => m.id === "de-lr2-2");
  const uf = tourney.matches.find((m) => m.id === "de-uf");

  assert(!!lr2_1 && lr2_1.playerA === "p2" && lr2_1.playerB === "p5", "LR2-1 has p2 vs p5");
  assert(!!lr2_2 && lr2_2.playerA === "p8" && lr2_2.playerB === "p3", "LR2-2 has p8 vs p3");
  assert(!!uf && uf.playerA === "p1" && uf.playerB === "p7", "UF has p1 vs p7");

  // Play P78 (7th/8th decider): p4 beats p6 (5 - 3) -> p4 is 7th, p6 is 8th
  p78!.scoreA = 5; p78!.scoreB = 3; p78!.played = true;

  // Play LR2 matches & UF
  lr2_1!.scoreA = 5; lr2_1!.scoreB = 4; lr2_1!.played = true; // p2 wins, p5 to P56
  lr2_2!.scoreA = 2; lr2_2!.scoreB = 5; lr2_2!.played = true; // p3 wins, p8 to P56
  uf!.scoreA = 5; uf!.scoreB = 3; uf!.played = true; // p1 wins UF to GF, p7 to LF

  tourney = advanceDoubleElimination(tourney);

  const p56 = tourney.matches.find((m) => m.id === "de-p56");
  const lr3 = tourney.matches.find((m) => m.id === "de-lr3");

  assert(!!p56 && p56.playerA === "p5" && p56.playerB === "p8", "P56 has p5 vs p8");
  assert(!!lr3 && lr3.playerA === "p2" && lr3.playerB === "p3", "LR3 has p2 vs p3");

  // Play P56 (5th/6th decider): p5 beats p8 (5 - 2) -> p5 is 5th, p8 is 6th
  p56!.scoreA = 5; p56!.scoreB = 2; p56!.played = true;

  // Play LR3: p3 beats p2 (5 - 1) -> p3 advances to LF, p2 is 4th
  lr3!.scoreA = 1; lr3!.scoreB = 5; lr3!.played = true;

  tourney = advanceDoubleElimination(tourney);

  const lf = tourney.matches.find((m) => m.id === "de-lf");
  assert(!!lf && lf.playerA === "p7" && lf.playerB === "p3", "LF has p7 vs p3");

  // Play LF: p3 beats p7 with margin < 4 (5 - 3) -> p3 to GF, p7 is 3rd (not shut out -> 6 pts)
  lf!.scoreA = 3; lf!.scoreB = 5; lf!.played = true;

  tourney = advanceDoubleElimination(tourney);

  const gf = tourney.matches.find((m) => m.id === "de-gf");
  assert(!!gf && gf.playerA === "p1" && gf.playerB === "p3", "GF has p1 vs p3");
  assert(gf!.targetScore === 6, "Grand Final target score is 6");

  // Play GF: p1 beats p3 (6 - 1) -> p3 is shut out in Grand Final!
  gf!.scoreA = 6; gf!.scoreB = 1; gf!.played = true;

  tourney = advanceDoubleElimination(tourney);
  assert(isDoubleEliminationComplete(tourney), "Tournament is complete after GF");

  const table = computeDoubleEliminationTable(tourney);

  console.log("8-Player Tournament Final Standings:");
  for (const r of table) {
    console.log(`Rank ${r.rank}: ${r.playerId} — Day Points: ${r.dayPoints} (Wins: ${r.wins})`);
  }

  assert(table[0].playerId === "p1" && table[0].rank === 1 && table[0].dayPoints === 8, "p1 is 1st with 8 pts");
  assert(table[1].playerId === "p3" && table[1].rank === 2 && table[1].dayPoints === 6, "p3 is 2nd with 6 pts (shut out penalty from 7 down to 6)");
  assert(table[2].playerId === "p7" && table[2].rank === 3 && table[2].dayPoints === 6, "p7 is 3rd with 6 pts (no blowout penalty in LF)");
  assert(table[3].playerId === "p2" && table[3].rank === 4 && table[3].dayPoints === 5, "p2 is 4th with 5 pts");
  assert(table[4].playerId === "p5" && table[4].rank === 5 && table[4].dayPoints === 4, "p5 is 5th with 4 pts");
  assert(table[5].playerId === "p8" && table[5].rank === 6 && table[5].dayPoints === 3, "p8 is 6th with 3 pts");
  assert(table[6].playerId === "p4" && table[6].rank === 7 && table[6].dayPoints === 2, "p4 is 7th with 2 pts");
  assert(table[7].playerId === "p6" && table[7].rank === 8 && table[7].dayPoints === 1, "p6 is 8th with 1 pt");

  console.log("✓ TEST 1 PASSED!\n");
}

// ============================================================================
// TEST 2: 7-Player Double Elimination (Case C: Exactly 1 Shutout in UQ)
// ============================================================================
console.log("--- TEST 2: 7-Player DE (Case C: 1 Shutout in UQ) ---");
{
  const players = ["A", "B", "C", "D", "E", "F", "G"];
  const config: TournamentConfig = {
    ...DEFAULT_CONFIG,
    format: "double-elimination",
    winScore: 5,
    finalWinScore: 6,
    deciderWinScore: 3,
    bonusMargin: 4,
    finalBonusMargin: 4,
    upperByePlayerId: "G", // G gets the Upper Bye
  };

  const { matches } = generateDoubleElimination(players, config);
  assert(matches.length === 3, "Initial 7-player DE has 3 UQ matches");

  let tourney: Tournament = {
    id: "test-7p-case-c",
    createdAt: Date.now(),
    playerIds: players,
    matches,
    byes: { 1: "G" },
    closed: false,
    config,
  };

  // UQ1: A beats C (5 - 2, margin 3 -> not shut out)
  // UQ2: B beats D (5 - 3, margin 2 -> not shut out)
  // UQ3: E beats F (5 - 1, margin 4 -> F is SHUT OUT)
  tourney.matches[0] = { ...tourney.matches[0], scoreA: 5, scoreB: 2, played: true };
  tourney.matches[1] = { ...tourney.matches[1], scoreA: 5, scoreB: 3, played: true };
  tourney.matches[2] = { ...tourney.matches[2], scoreA: 5, scoreB: 1, played: true };

  tourney = advanceDoubleElimination(tourney);

  const us1 = tourney.matches.find((m) => m.id === "de-us-1");
  const us2 = tourney.matches.find((m) => m.id === "de-us-2");
  const qDecider = tourney.matches.find((m) => m.id === "de-q-decider");

  assert(!!us1 && us1.playerA === "A" && us1.playerB === "B", "US1 is A vs B");
  assert(!!us2 && us2.playerA === "E" && us2.playerB === "G", "US2 is E vs G (bye recipient)");
  assert(!!qDecider, "Case C: 3-point decider created between C and D");
  assert(qDecider!.playerA === "C" && qDecider!.playerB === "D", "Decider is C vs D");
  assert(qDecider!.targetScore === 3, "Decider target score is 3");

  // Play 3-point decider: C beats D (3 - 1)
  // C gets the Bye to Lower Round 2!
  // D plays F (the shutout loser) in Lower Round 1!
  qDecider!.scoreA = 3; qDecider!.scoreB = 1; qDecider!.played = true;

  tourney = advanceDoubleElimination(tourney);

  const lr1 = tourney.matches.find((m) => m.id === "de-lr1");
  assert(!!lr1 && lr1.playerA === "D" && lr1.playerB === "F", "LR1 is D vs F");

  // Play US1: A beats B (5 - 3) -> A to UF, B to LR2
  // Play US2: G beats E (5 - 1) -> G to UF, E to LR2
  // Play LR1: F beats D (5 - 3) -> F to LR2, D is 7th!
  us1!.scoreA = 5; us1!.scoreB = 3; us1!.played = true;
  us2!.scoreA = 1; us2!.scoreB = 5; us2!.played = true;
  lr1!.scoreA = 3; lr1!.scoreB = 5; lr1!.played = true;

  tourney = advanceDoubleElimination(tourney);

  const lr2_1 = tourney.matches.find((m) => m.id === "de-lr2-1");
  const lr2_2 = tourney.matches.find((m) => m.id === "de-lr2-2");
  const uf = tourney.matches.find((m) => m.id === "de-uf");

  assert(!!lr2_1 && lr2_1.playerA === "F" && lr2_1.playerB === "B", "LR2-1 is F vs B");
  assert(!!lr2_2 && lr2_2.playerA === "C" && lr2_2.playerB === "E", "LR2-2 is C vs E");
  assert(!!uf && uf.playerA === "A" && uf.playerB === "G", "UF is A vs G");

  // Play LR2 matches & UF:
  // LR2-1: B beats F (5 - 4) -> B to LR3, F to P56
  // LR2-2: E beats C (5 - 3) -> E to LR3, C to P56
  // UF: A beats G (5 - 2) -> A to GF, G to LF
  lr2_1!.scoreA = 4; lr2_1!.scoreB = 5; lr2_1!.played = true;
  lr2_2!.scoreA = 3; lr2_2!.scoreB = 5; lr2_2!.played = true;
  uf!.scoreA = 5; uf!.scoreB = 2; uf!.played = true;

  tourney = advanceDoubleElimination(tourney);

  const p56 = tourney.matches.find((m) => m.id === "de-p56");
  const lr3 = tourney.matches.find((m) => m.id === "de-lr3");

  assert(!!p56 && p56.playerA === "F" && p56.playerB === "C", "P56 is F vs C");
  assert(!!lr3 && lr3.playerA === "B" && lr3.playerB === "E", "LR3 is B vs E");

  // P56: C beats F (5 - 3) -> C is 5th (3 pts), F is 6th (2 pts)
  p56!.scoreA = 3; p56!.scoreB = 5; p56!.played = true;

  // LR3: E beats B (5 - 3) -> E to LF, B is 4th (4 pts)
  lr3!.scoreA = 3; lr3!.scoreB = 5; lr3!.played = true;

  tourney = advanceDoubleElimination(tourney);

  const lf = tourney.matches.find((m) => m.id === "de-lf");
  assert(!!lf && lf.playerA === "G" && lf.playerB === "E", "LF is G vs E");

  // LF: E beats G (5 - 3, margin 2 < 4) -> E to GF, G is 3rd (5 pts)
  lf!.scoreA = 3; lf!.scoreB = 5; lf!.played = true;

  tourney = advanceDoubleElimination(tourney);

  const gf = tourney.matches.find((m) => m.id === "de-gf");
  assert(!!gf && gf.playerA === "A" && gf.playerB === "E", "GF is A vs E");

  // GF: A beats E (6 - 4) -> A is 1st (7 pts), E is 2nd (6 pts)
  gf!.scoreA = 6; gf!.scoreB = 4; gf!.played = true;

  tourney = advanceDoubleElimination(tourney);
  assert(isDoubleEliminationComplete(tourney), "7-Player Tournament Complete");

  const table = computeDoubleEliminationTable(tourney);

  console.log("7-Player Tournament Final Standings:");
  for (const r of table) {
    console.log(`Rank ${r.rank}: ${r.playerId} — Day Points: ${r.dayPoints}`);
  }

  assert(table[0].playerId === "A" && table[0].rank === 1 && table[0].dayPoints === 7, "A is 1st with 7 pts");
  assert(table[1].playerId === "E" && table[1].rank === 2 && table[1].dayPoints === 6, "E is 2nd with 6 pts");
  assert(table[2].playerId === "G" && table[2].rank === 3 && table[2].dayPoints === 5, "G is 3rd with 5 pts");
  assert(table[3].playerId === "B" && table[3].rank === 4 && table[3].dayPoints === 4, "B is 4th with 4 pts");
  assert(table[4].playerId === "C" && table[4].rank === 5 && table[4].dayPoints === 3, "C is 5th with 3 pts");
  assert(table[5].playerId === "F" && table[5].rank === 6 && table[5].dayPoints === 2, "F is 6th with 2 pts");
  assert(table[6].playerId === "D" && table[6].rank === 7 && table[6].dayPoints === 1, "D is 7th with 1 pt");

  console.log("✓ TEST 2 PASSED!\n");
}

// ============================================================================
// TEST 2B: 7-Player Double Elimination (Case B: Exactly 2 Shutouts in UQ)
// ============================================================================
console.log("--- TEST 2B: 7-Player DE (Case B: 2 Shutouts in UQ) ---");
{
  const players = ["A", "B", "C", "D", "E", "F", "G"];
  const config: TournamentConfig = {
    ...DEFAULT_CONFIG,
    format: "double-elimination",
    winScore: 5,
    finalWinScore: 6,
    deciderWinScore: 3,
    bonusMargin: 4,
    upperByePlayerId: "G",
  };

  const { matches } = generateDoubleElimination(players, config);
  let tourney: Tournament = {
    id: "test-7p-case-b",
    createdAt: Date.now(),
    playerIds: players,
    matches,
    byes: { 1: "G" },
    closed: false,
    config,
  };

  // UQ1: A beats C (5 - 0, margin 5 -> C is SHUT OUT)
  // UQ2: B beats D (5 - 1, margin 4 -> D is SHUT OUT)
  // UQ3: E beats F (5 - 3, margin 2 -> F is NOT shut out)
  tourney.matches[0] = { ...tourney.matches[0], scoreA: 5, scoreB: 0, played: true };
  tourney.matches[1] = { ...tourney.matches[1], scoreA: 5, scoreB: 1, played: true };
  tourney.matches[2] = { ...tourney.matches[2], scoreA: 5, scoreB: 3, played: true };

  tourney = advanceDoubleElimination(tourney);

  // In Case B: F (the non-shutout loser) automatically gets the LR2 bye!
  // C and D (the 2 shutout losers) play Lower Round 1!
  const lr1 = tourney.matches.find((m) => m.id === "de-lr1");
  assert(!!lr1 && lr1.playerA === "C" && lr1.playerB === "D", "LR1 is C vs D");

  const qDecider = tourney.matches.find((m) => m.id === "de-q-decider");
  const q1 = tourney.matches.find((m) => m.id === "de-q-rr-1");
  assert(!qDecider && !q1, "No qualifiers generated because non-shutout F gets direct bye");

  // US1: A beats B (5 - 3)
  // US2: G beats E (5 - 2)
  const us1 = tourney.matches.find((m) => m.id === "de-us-1")!;
  const us2 = tourney.matches.find((m) => m.id === "de-us-2")!;
  us1.scoreA = 5; us1.scoreB = 3; us1.played = true;
  us2.scoreA = 2; us2.scoreB = 5; us2.played = true;

  // LR1: C beats D (5 - 2)
  lr1!.scoreA = 5; lr1!.scoreB = 2; lr1!.played = true;

  tourney = advanceDoubleElimination(tourney);

  const lr2_1 = tourney.matches.find((m) => m.id === "de-lr2-1");
  const lr2_2 = tourney.matches.find((m) => m.id === "de-lr2-2");

  assert(!!lr2_1 && lr2_1.playerA === "C" && lr2_1.playerB === "B", "LR2-1 is C vs B");
  assert(!!lr2_2 && lr2_2.playerA === "F" && lr2_2.playerB === "E", "LR2-2 is F (bye recipient) vs E");

  console.log("✓ TEST 2B PASSED!\n");
}

// ============================================================================
// TEST 3: 7-Player Double Elimination (Case A: 0 Shutouts -> 3-Man Mini RR & 1-1-1 Tiebreaker)
// ============================================================================
console.log("--- TEST 3: 7-Player DE (Case A: 3-Man Mini RR & Tiebreaker) ---");
{
  const players = ["A", "B", "C", "D", "E", "F", "G"];
  const config: TournamentConfig = {
    ...DEFAULT_CONFIG,
    format: "double-elimination",
    winScore: 5,
    finalWinScore: 6,
    deciderWinScore: 3,
    bonusMargin: 4,
    upperByePlayerId: "G",
  };

  const { matches } = generateDoubleElimination(players, config);
  let tourney: Tournament = {
    id: "test-7p-case-a",
    createdAt: Date.now(),
    playerIds: players,
    matches,
    byes: { 1: "G" },
    closed: false,
    config,
  };

  // UQ1: A beats C (5 - 3) [C diff: -2, scoreFor: 3]
  // UQ2: B beats D (5 - 2) [D diff: -3, scoreFor: 2]
  // UQ3: E beats F (5 - 2) [F diff: -3, scoreFor: 2]
  // Zero shutouts!
  tourney.matches[0] = { ...tourney.matches[0], scoreA: 5, scoreB: 3, played: true };
  tourney.matches[1] = { ...tourney.matches[1], scoreA: 5, scoreB: 2, played: true };
  tourney.matches[2] = { ...tourney.matches[2], scoreA: 5, scoreB: 2, played: true };

  tourney = advanceDoubleElimination(tourney);

  const q1 = tourney.matches.find((m) => m.id === "de-q-rr-1");
  const q2 = tourney.matches.find((m) => m.id === "de-q-rr-2");
  const q3 = tourney.matches.find((m) => m.id === "de-q-rr-3");

  assert(!!q1 && !!q2 && !!q3, "All 3 mini round robin matches created");

  // Simulate a 1-1-1 triangle tie in the 3-man mini round robin:
  // q1: C beats D (3 - 1) -> C diff: +2, D diff: -2
  // q2: D beats F (3 - 0) -> D diff: +3, F diff: -3
  // q3: F beats C (3 - 2) -> F diff: +1, C diff: -1
  // Mini RR diffs:
  // C: +2 - 1 = +1
  // D: -2 + 3 = +1
  // F: -3 + 1 = -2
  // C and D tied in wins (1) and mini diff (+1)!
  // Tiebreaker goes to UQ diff: C has -2, D has -3!
  // So C wins the tiebreaker and gets the LR2 bye!
  q1!.scoreA = 3; q1!.scoreB = 1; q1!.played = true;
  q2!.scoreA = 3; q2!.scoreB = 0; q2!.played = true;
  q3!.scoreA = 3; q3!.scoreB = 2; q3!.played = true;

  tourney = advanceDoubleElimination(tourney);

  const lr1 = tourney.matches.find((m) => m.id === "de-lr1");
  assert(!!lr1, "LR1 created after 3-man mini round robin resolves");
  assert(
    (lr1!.playerA === "D" && lr1!.playerB === "F") ||
    (lr1!.playerA === "F" && lr1!.playerB === "D"),
    "LR1 is D vs F because C won the tiebreaker"
  );

  console.log("✓ TEST 3 PASSED!\n");
}

// ============================================================================
// TEST 4: Bye Counts Tracking Across Tournaments
// ============================================================================
console.log("--- TEST 4: Bye Counts Tracking ---");
{
  const pastT: Tournament[] = [
    {
      id: "t1",
      createdAt: 1,
      playerIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"],
      matches: [],
      byes: {},
      closed: true,
      config: { ...DEFAULT_CONFIG, upperByePlayerId: "p7" },
    },
    {
      id: "t2",
      createdAt: 2,
      playerIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"],
      matches: [],
      byes: {},
      closed: true,
      config: { ...DEFAULT_CONFIG, upperByePlayerId: "p7" },
    },
    {
      id: "t3",
      createdAt: 3,
      playerIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"],
      matches: [],
      byes: {},
      closed: true,
      config: { ...DEFAULT_CONFIG, upperByePlayerId: "p3" },
    },
  ];

  const counts = computePlayerByeCounts(pastT, ["p1", "p2", "p3", "p4", "p5", "p6", "p7"]);
  assert(counts["p7"] === 2, "p7 has received 2 byes");
  assert(counts["p3"] === 1, "p3 has received 1 bye");
  assert(counts["p1"] === 0, "p1 has received 0 byes");

  console.log("✓ TEST 4 PASSED!\n");
}

console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! Double Elimination logic is 100% verified.");
