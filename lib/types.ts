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
  pointsAwarded?: { [playerId: string]: number };
}

/**
 * Configurable scoring rules for a tournament.
 */
export interface TournamentConfig {
  // Round-robin match rules
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
}

export const DEFAULT_CONFIG: TournamentConfig = {
  winScore: 5,
  bonusMargin: 4,
  winPoints: 2,
  bonusPoints: 1,
  finalWinScore: 6,
  finalBonusMargin: 4,
  finalWinBase: 2,
  finalWinBonus: 1,
  finalLoserPenalty: -1,
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
  config: TournamentConfig;  // scoring rules for this tournament
}

export interface DayTable {
  date: string;           // e.g. "2026-09-27"
  tournaments: string[];  // tournament ids played that day
  totals: { [playerId: string]: number };
}

export interface TournamentRow {
  playerId: string;
  points: number;
  wins: number;
  matchesPlayed: number;
  pointDiff: number;      // sum of (scoreFor - scoreAgainst) in played matches
  rank: number;
}

export type PlayPhase =
  | "player-select"
  | "setup"            // NEW: tournament config screen
  | "fixtures"
  | "final"
  | "tournament-summary";
