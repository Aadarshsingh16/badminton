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
  | "fixtures"
  | "final"
  | "tournament-summary";
