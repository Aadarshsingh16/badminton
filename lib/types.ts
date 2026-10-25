// lib/types.ts

export type AvatarType = "clumsy" | "nerd" | "bigfoot" | "dwarf" | "fighter" | "chinese" | "custom";

export interface Player {
  id: string;
  name: string;
  avatar: AvatarType;
  avatarColor?: string;   // for custom players
  avatarEmoji?: string;   // for custom players
}

export interface Match {
  id: string;
  round: number;
  playerA: string;        // player id
  playerB: string;
  courtSide: { [playerId: string]: 1 | 2 };
  scoreA?: number;
  scoreB?: number;
  played: boolean;
  isFinal?: boolean;
  pointsAwarded?: { [playerId: string]: number };
  bracket?: "upper" | "lower" | "grand-final" | "placement" | "qualifier";
  bracketRound?: string; // e.g. "UQ1", "US1", "UF", "LR1", "LR2", "LR3", "LF", "GF", "P56", "P78", "Q-RR", "Q-DECIDER"
  label?: string;        // e.g. "Upper Quarterfinal 1", "3-Point Bye Qualifier", "5th/6th Placement"
  targetScore?: number;  // score to win this match (e.g. 5, 3, 6)
  matchIndex?: number;
}

export type TournamentFormat = "round-robin" | "double-elimination";

/**
 * Configurable scoring rules for a tournament.
 */
export interface TournamentConfig {
  format?: TournamentFormat; // "round-robin" (default) or "double-elimination"

  // Bracket / Round-robin match rules
  winScore: number;        // score needed to win a match (default 5)
  bonusMargin: number;     // winning margin that earns +1 bonus point (default 4, i.e. 5-0 or 5-1)
  winPoints: number;       // base points for a win (default 2)
  bonusPoints: number;     // extra points when margin >= bonusMargin (default 1, total 3)

  // Final rules
  finalWinScore: number;   // score needed to win the final (default 6)
  finalBonusMargin: number;// winning margin in final that triggers loser penalty (default 4)
  finalWinBase: number;    // base points for winning the final (default 2)
  finalWinBonus: number;   // extra points for winning final with big margin (default 1, total 3)
  finalLoserPenalty: number; // points for loser when margin >= finalBonusMargin (default -1)

  // Double elimination specific
  deciderWinScore?: number;   // score needed to win decider/qualifier matches (default 3)
  upperByePlayerId?: string;  // player who received the bye into Upper Semifinal (for 7-player bracket)

  isPractice?: boolean;    // when true, test tournament (scores not saved to permanent history)
}

export const DEFAULT_CONFIG: TournamentConfig = {
  format: "round-robin",
  winScore: 5,
  bonusMargin: 4,
  winPoints: 2,
  bonusPoints: 1,
  finalWinScore: 6,
  finalBonusMargin: 4,
  finalWinBase: 2,
  finalWinBonus: 0,
  finalLoserPenalty: -1,
  deciderWinScore: 3,
  isPractice: false,
};

export interface Tournament {
  id: string;
  createdAt: number;
  playerIds: string[];
  matches: Match[];
  byes: { [round: number]: string | null };
  final?: Match;
  finalistIds?: [string, string];
  closed: boolean;
  dayPointsAwarded?: { [playerId: string]: number };
  shareSlug?: string;        // random short slug for /live/[slug]
  config: TournamentConfig;  // scoring rules for this tournament
  isPractice?: boolean;      // practice/test mode flag
  date?: string;             // day session date (e.g. "2026-10-07")
}

export interface DayTable {
  date: string;           // e.g. "2026-09-27"
  tournaments: string[];  // tournament ids played that day
  totals: { [playerId: string]: number };
}

export interface CompletedDaySummary {
  date: string;
  totals: { [playerId: string]: number };
  topPlayerId?: string;
  spoonPlayerId?: string;
  tournamentIds: string[];
}

export interface TournamentRow {
  playerId: string;
  points: number;
  wins: number;
  matchesPlayed: number;
  pointDiff: number;      // sum of (scoreFor - scoreAgainst) in played matches
  rank: number;
  dayPoints?: number;     // overall day points earned in this tournament
}

export type PlayPhase =
  | "player-select"
  | "setup"            // NEW: tournament config screen
  | "fixtures"
  | "final"
  | "tournament-summary";
