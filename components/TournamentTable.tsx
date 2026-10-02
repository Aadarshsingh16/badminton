"use client";
// components/TournamentTable.tsx — Live tournament standings with expandable player match history

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TournamentRow, Player, Tournament, Match } from "@/lib/types";
import { AvatarSVG } from "./avatars/AvatarSVG";

interface TournamentTableProps {
  rows: TournamentRow[];
  players: Player[];
  finalistIds?: [string, string];
  showFinalLabel?: boolean;
  tournament?: Tournament;   // when provided, player rows expand to show match history
  onSelectMatch?: (match: Match) => void; // when provided, matches in history can be tapped to edit score
}

const RANK_COLORS = ["#FFD166", "#A8DADC", "#FF6B35", "#9B9B9B"];
const RANK_LABELS = ["🥇", "🥈", "🥉", "4th", "5th", "6th", "7th"];

export function TournamentTable({ rows, players, finalistIds, showFinalLabel, tournament, onSelectMatch }: TournamentTableProps) {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "matches">("table");

  const getPlayer = (id: string) => players.find((p) => p.id === id);

  /** Get all matches a player was involved in (round-robin + final) */
  const getPlayerMatches = (playerId: string) => {
    if (!tournament) return [];
    const matches = tournament.matches.filter(
      (m) => m.playerA === playerId || m.playerB === playerId
    );
    const allMatches = [...matches];
    if (tournament.final && (tournament.final.playerA === playerId || tournament.final.playerB === playerId)) {
      allMatches.push(tournament.final);
    }
    return allMatches;
  };

  const allTournamentMatches = tournament
    ? [...tournament.matches, ...(tournament.final ? [tournament.final] : [])]
    : [];

  return (
    <div className="px-4 pb-4">
      {showFinalLabel && (
        <div className="text-center mb-3">
          <span className="text-xs bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full font-medium">
            ⭐ Final results included
          </span>
        </div>
      )}

      {/* View Switcher: Standings Table vs All Matches Editor */}
      {tournament && onSelectMatch && (
        <div className="flex items-center justify-between gap-2 mb-3 bg-white/5 border border-white/10 rounded-2xl p-1.5">
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === "table"
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              📊 Standings Table
            </button>
            <button
              onClick={() => setViewMode("matches")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === "matches"
                  ? "bg-orange-500/25 text-orange-300 border border-orange-500/40 shadow-sm"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <span>✏️</span>
              <span>Edit All Matches</span>
              <span className="text-[10px] bg-white/10 px-1.5 py-0.2 rounded-full">
                {allTournamentMatches.length}
              </span>
            </button>
          </div>
          <span className="text-[11px] text-white/30 pr-2 hidden sm:inline">
            {viewMode === "table" ? "Tap row to expand" : "Tap match to edit"}
          </span>
        </div>
      )}

      {viewMode === "matches" ? (
        /* Direct Match List with Edit buttons */
        <div className="space-y-2">
          {allTournamentMatches.map((m, idx) => {
            const isFinalMatch = m.round === -1;
            const pA = getPlayer(m.playerA);
            const pB = getPlayer(m.playerB);
            const aWon = m.played && m.scoreA !== undefined && m.scoreB !== undefined && m.scoreA > m.scoreB;
            const bWon = m.played && m.scoreA !== undefined && m.scoreB !== undefined && m.scoreB > m.scoreA;

            return (
              <button
                key={m.id}
                onClick={() => onSelectMatch?.(m)}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/40 rounded-xl p-3 flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99] group"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
                    isFinalMatch ? "bg-yellow-500/25 text-yellow-300 border border-yellow-500/30" : "bg-white/10 text-white/50"
                  }`}>
                    {isFinalMatch ? "🏆 Final" : `Match ${idx + 1}`}
                  </span>

                  <div className="flex items-center gap-1.5 truncate">
                    <span className={`text-xs font-semibold truncate ${aWon ? "text-green-400 font-bold" : "text-white/80"}`}>
                      {pA?.name ?? m.playerA}
                    </span>
                    <span className="text-white/30 text-xs font-normal">vs</span>
                    <span className={`text-xs font-semibold truncate ${bWon ? "text-green-400 font-bold" : "text-white/80"}`}>
                      {pB?.name ?? m.playerB}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  {m.played && m.scoreA !== undefined && m.scoreB !== undefined ? (
                    <span className="text-sm font-black tabular-nums text-white">
                      {m.scoreA}–{m.scoreB}
                    </span>
                  ) : (
                    <span className="text-white/30 text-xs">pending</span>
                  )}

                  <span className="text-[11px] font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30 group-hover:bg-orange-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    ✏️ Edit
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* Standings Table */
        <>
          <div className="flex items-center px-3 py-2 mb-1">
            <span className="text-white/30 text-xs w-6 text-center">#</span>
            <span className="text-white/30 text-xs flex-1 pl-2">Player</span>
            <span className="text-white/30 text-xs w-8 text-center">MP</span>
            <span className="text-white/30 text-xs w-8 text-center">W</span>
            <span className="text-white/30 text-xs w-10 text-center">+/-</span>
            <span className="text-white/30 text-xs w-10 text-center font-bold">PTS</span>
          </div>

      <AnimatePresence>
        {rows.map((row, idx) => {
          const player = getPlayer(row.playerId);
          if (!player) return null;
          const isFinalist = finalistIds?.includes(row.playerId);
          const rankColor = RANK_COLORS[idx] ?? "#9B9B9B";
          const isExpanded = expandedPlayerId === row.playerId;
          const playerMatches = getPlayerMatches(row.playerId);
          const canExpand = tournament !== undefined;

          return (
            <motion.div
              key={row.playerId}
              layout
              layoutId={`table-row-${row.playerId}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className={`mb-2 rounded-xl border overflow-hidden ${
                isFinalist
                  ? "bg-yellow-500/10 border-yellow-500/30"
                  : "bg-white/5 border-white/5"
              }`}
            >
              {/* Row header */}
              <button
                onClick={() => canExpand && setExpandedPlayerId(isExpanded ? null : row.playerId)}
                className={`w-full flex items-center px-3 py-3 ${canExpand ? "cursor-pointer" : "cursor-default"}`}
              >
                {/* Rank */}
                <div className="w-6 text-center flex-shrink-0">
                  <span className="text-sm font-bold" style={{ color: rankColor }}>
                    {RANK_LABELS[idx] ?? `${idx + 1}`}
                  </span>
                </div>

                {/* Avatar + Name */}
                <div className="flex items-center gap-2 flex-1 pl-1 min-w-0">
                  <AvatarSVG
                    type={player.avatar}
                    size={32}
                    emoji={player.avatarEmoji}
                    color={player.avatarColor}
                  />
                  <div className="min-w-0 text-left">
                    <p className="text-white font-semibold text-sm truncate">{player.name}</p>
                    {isFinalist && (
                      <p className="text-yellow-400 text-xs">Finalist</p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <span className="text-white/50 text-sm w-8 text-center">{row.matchesPlayed}</span>
                <span className="text-white/50 text-sm w-8 text-center">{row.wins}</span>
                <span className={`text-sm w-10 text-center font-medium ${
                  row.pointDiff > 0 ? "text-green-400" : row.pointDiff < 0 ? "text-red-400" : "text-white/40"
                }`}>
                  {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                </span>
                <motion.span
                  key={row.points}
                  initial={{ scale: 1.2, color: "#FFD166" }}
                  animate={{ scale: 1, color: "#ffffff" }}
                  transition={{ duration: 0.3 }}
                  className="text-base font-black w-10 text-center tabular-nums text-white"
                >
                  {row.points}
                </motion.span>

                {canExpand && (
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-white/30 text-sm ml-1 flex-shrink-0"
                  >
                    ▾
                  </motion.span>
                )}
              </button>

              {/* Expandable match history */}
              <AnimatePresence>
                {isExpanded && canExpand && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-white/5"
                  >
                    <div className="px-3 py-2 space-y-1.5">
                      {playerMatches.length === 0 ? (
                        <p className="text-white/30 text-xs text-center py-2">No matches yet</p>
                      ) : (
                        playerMatches.map((m) => {
                          const isFinalMatch = m.round === -1;
                          const isPlayerA = m.playerA === row.playerId;
                          const opponent = getPlayer(isPlayerA ? m.playerB : m.playerA);
                          const myScore = isPlayerA ? m.scoreA : m.scoreB;
                          const oppScore = isPlayerA ? m.scoreB : m.scoreA;
                          const myPts = m.pointsAwarded?.[row.playerId] ?? null;
                          const won = m.played && myScore !== undefined && oppScore !== undefined && myScore > oppScore;
                          const lost = m.played && myScore !== undefined && oppScore !== undefined && myScore < oppScore;

                          return (
                            <button
                              key={m.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSelectMatch) onSelectMatch(m);
                              }}
                              disabled={!onSelectMatch}
                              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all text-left ${
                                onSelectMatch
                                  ? "cursor-pointer active:scale-[0.99] hover:bg-white/10"
                                  : "cursor-default"
                              } ${
                                !m.played
                                  ? "bg-white/5 border border-white/5 hover:border-purple-500/30"
                                  : won
                                  ? "bg-green-500/10 border border-green-500/20 hover:border-green-400/40"
                                  : "bg-white/5 border border-white/5 hover:border-orange-500/30"
                              }`}
                            >
                              {/* Match type tag */}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                                isFinalMatch
                                  ? "bg-yellow-500/20 text-yellow-300"
                                  : "bg-white/10 text-white/40"
                              }`}>
                                {isFinalMatch ? "🏆 Final" : `M${m.round + 1}`}
                              </span>

                              {/* Opponent avatar + name */}
                              {opponent && (
                                <AvatarSVG
                                  type={opponent.avatar}
                                  size={22}
                                  emoji={opponent.avatarEmoji}
                                  color={opponent.avatarColor}
                                  className="flex-shrink-0"
                                />
                              )}
                              <span className="text-white/70 text-xs flex-1 truncate font-medium">
                                vs {opponent?.name ?? "?"}
                              </span>

                              {/* Score & Points */}
                              {m.played && myScore !== undefined && oppScore !== undefined ? (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`text-sm font-black tabular-nums ${won ? "text-green-400" : lost ? "text-white/40" : "text-white/60"}`}>
                                    {myScore}–{oppScore}
                                  </span>
                                  {myPts !== null && (
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                      myPts > 0 ? "bg-green-500/20 text-green-400"
                                      : myPts < 0 ? "bg-red-500/20 text-red-400"
                                      : "bg-white/10 text-white/40"
                                    }`}>
                                      {myPts > 0 ? "+" : ""}{myPts}
                                    </span>
                                  )}
                                  {onSelectMatch && (
                                    <span className="text-[10px] font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      ✏️ Edit
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-white/25 text-xs">pending</span>
                                  {onSelectMatch && (
                                    <span className="text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      ▶ Score
                                    </span>
                                  )}
                                </div>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
        </>
      )}
    </div>
  );
}
