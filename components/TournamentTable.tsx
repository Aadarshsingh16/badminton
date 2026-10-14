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
          <span className="text-[10px] bg-[#F5BA38] text-[#14161B] px-3 py-1 rounded-full font-black uppercase tracking-wider">
            ⭐ Final results included
          </span>
        </div>
      )}

      {/* View Switcher: Standings Table vs All Matches Editor */}
      {tournament && onSelectMatch && (
        <div className="flex items-center justify-between gap-1 mb-3.5 bg-[#181B22] border border-white/10 rounded-full p-1">
          <button
            onClick={() => setViewMode("table")}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-black uppercase tracking-wide transition-all ${
              viewMode === "table"
                ? "bg-[#F3F4EE] text-[#14161B] shadow-sm"
                : "text-[#8E95A5] hover:text-[#F3F4EE]"
            }`}
          >
            📊 Standings
          </button>
          <button
            onClick={() => setViewMode("matches")}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-black uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 ${
              viewMode === "matches"
                ? "bg-[#F3F4EE] text-[#14161B] shadow-sm"
                : "text-[#8E95A5] hover:text-[#F3F4EE]"
            }`}
          >
            <span>All Matches</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              viewMode === "matches" ? "bg-[#14161B] text-[#F3F4EE]" : "bg-white/10 text-[#8E95A5]"
            }`}>
              {allTournamentMatches.length}
            </span>
          </button>
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
                className="w-full bg-[#1E2128] hover:bg-[#252932] border border-white/10 hover:border-white/20 rounded-[22px] p-3 flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99] group shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex-shrink-0 tracking-wider ${
                    isFinalMatch ? "bg-[#FF5E48] text-white" : "bg-white/10 text-[#8E95A5]"
                  }`}>
                    {isFinalMatch ? "🏆 Final" : `M${idx + 1}`}
                  </span>

                  <div className="flex items-center gap-1.5 truncate">
                    <span className={`text-xs font-black truncate ${aWon ? "text-[#F3F4EE]" : "text-[#8E95A5]"}`}>
                      {pA?.name ?? m.playerA}
                    </span>
                    <span className="text-[#8E95A5]/60 text-xs font-bold">vs</span>
                    <span className={`text-xs font-black truncate ${bWon ? "text-[#F3F4EE]" : "text-[#8E95A5]"}`}>
                      {pB?.name ?? m.playerB}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  {m.played && m.scoreA !== undefined && m.scoreB !== undefined ? (
                    <span className="text-sm font-black tabular-nums text-[#F3F4EE]">
                      {m.scoreA}–{m.scoreB}
                    </span>
                  ) : (
                    <span className="text-[#8E95A5] text-[11px] font-bold uppercase tracking-wider">pending</span>
                  )}

                  <span className="w-7 h-7 rounded-full bg-white/10 group-hover:bg-[#FF5E48] group-hover:text-white text-[#F3F4EE] flex items-center justify-center text-xs font-black transition-colors">
                    ↗
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
            <span className="text-[#8E95A5] text-[10px] font-black uppercase tracking-wider w-7 text-center">#</span>
            <span className="text-[#8E95A5] text-[10px] font-black uppercase tracking-wider flex-1 pl-2">Player</span>
            <span className="text-[#8E95A5] text-[10px] font-black uppercase tracking-wider w-8 text-center">MP</span>
            <span className="text-[#8E95A5] text-[10px] font-black uppercase tracking-wider w-8 text-center">W</span>
            <span className="text-[#8E95A5] text-[10px] font-black uppercase tracking-wider w-10 text-center">+/-</span>
            <span className="text-[#8E95A5] text-[10px] font-black uppercase tracking-wider w-10 text-center">
              {showFinalLabel ? "DAY" : "PTS"}
            </span>
          </div>

      <AnimatePresence>
        {rows.map((row, idx) => {
          const player = getPlayer(row.playerId);
          if (!player) return null;
          const isFinalist = finalistIds?.includes(row.playerId);
          const isExpanded = expandedPlayerId === row.playerId;
          const playerMatches = getPlayerMatches(row.playerId);
          const canExpand = tournament !== undefined;

          return (
            <motion.div
              key={row.playerId}
              layout
              layoutId={`table-row-${row.playerId}`}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.03 }}
              className={`mb-2 rounded-[22px] border overflow-hidden transition-all shadow-sm ${
                isFinalist
                  ? "bg-[#1E2128] border-[#F5BA38]/40 ring-1 ring-[#F5BA38]/20"
                  : "bg-[#1E2128] border-white/5 hover:border-white/15"
              }`}
            >
              {/* Row header */}
              <button
                onClick={() => canExpand && setExpandedPlayerId(isExpanded ? null : row.playerId)}
                className={`w-full flex items-center px-3 py-3 ${canExpand ? "cursor-pointer" : "cursor-default"}`}
              >
                {/* Rank */}
                <div className="w-7 text-center flex-shrink-0">
                  <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[11px] font-black ${
                    idx === 0
                      ? "bg-[#F5BA38] text-[#14161B]"
                      : idx === 1
                      ? "bg-[#FF5E48] text-white"
                      : idx === 2
                      ? "bg-[#6C79E0] text-white"
                      : "bg-white/10 text-[#8E95A5]"
                  }`}>
                    {idx + 1}
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
                    <p className="text-[#F3F4EE] font-black text-xs truncate tracking-tight">{player.name}</p>
                    {isFinalist && (
                      <p className="text-[#F5BA38] text-[9px] font-black uppercase tracking-wider">Finalist ⭐</p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <span className="text-[#8E95A5] text-xs font-bold w-8 text-center tabular-nums">{row.matchesPlayed}</span>
                <span className="text-[#8E95A5] text-xs font-bold w-8 text-center tabular-nums">{row.wins}</span>
                <span className={`text-xs w-10 text-center font-black tabular-nums ${
                  row.pointDiff > 0 ? "text-[#9EC9A8]" : row.pointDiff < 0 ? "text-[#FF5E48]" : "text-[#8E95A5]"
                }`}>
                  {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                </span>
                <motion.span
                  key={showFinalLabel ? (row.dayPoints ?? Math.max(1, rows.length - idx)) : row.points}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="text-base font-black w-10 text-center tabular-nums text-[#F3F4EE]"
                >
                  {showFinalLabel ? (row.dayPoints ?? Math.max(1, rows.length - idx)) : row.points}
                </motion.span>

                {canExpand && (
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-[#8E95A5] text-xs ml-1 flex-shrink-0"
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
                    className="overflow-hidden border-t border-white/5 bg-[#181B22]"
                  >
                    <div className="px-3 py-2.5 space-y-1.5">
                      {playerMatches.length === 0 ? (
                        <p className="text-[#8E95A5] text-xs text-center py-2 font-medium">No matches yet</p>
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
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left bg-[#1E2128] border border-white/5 ${
                                onSelectMatch
                                  ? "cursor-pointer active:scale-[0.99] hover:border-white/20"
                                  : "cursor-default"
                              }`}
                            >
                              {/* Match type tag */}
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex-shrink-0 tracking-wider ${
                                isFinalMatch
                                  ? "bg-[#FF5E48] text-white"
                                  : "bg-white/10 text-[#8E95A5]"
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
                              <span className="text-[#F3F4EE] text-xs flex-1 truncate font-bold">
                                vs {opponent?.name ?? "?"}
                              </span>

                              {/* Score & Points */}
                              {m.played && myScore !== undefined && oppScore !== undefined ? (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`text-xs font-black tabular-nums ${won ? "text-[#9EC9A8]" : lost ? "text-[#8E95A5]" : "text-[#F3F4EE]"}`}>
                                    {myScore}–{oppScore}
                                  </span>
                                  {myPts !== null && (
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                                      myPts > 0 ? "bg-[#9EC9A8]/15 text-[#9EC9A8]"
                                      : myPts < 0 ? "bg-[#FF5E48]/15 text-[#FF5E48]"
                                      : "bg-white/10 text-[#8E95A5]"
                                    }`}>
                                      {myPts > 0 ? "+" : ""}{myPts}
                                    </span>
                                  )}
                                  {onSelectMatch && (
                                    <span className="text-[10px] font-black bg-white/10 text-[#F3F4EE] px-2 py-0.5 rounded-full flex items-center gap-1">
                                      Edit ↗
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-[#8E95A5] text-[10px] font-bold uppercase tracking-wider">pending</span>
                                  {onSelectMatch && (
                                    <span className="text-[10px] font-black bg-[#FF5E48] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                      Score ↗
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
