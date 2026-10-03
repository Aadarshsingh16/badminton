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
          <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-full font-bold">
            ⭐ Final results included
          </span>
        </div>
      )}

      {/* View Switcher: Standings Table vs All Matches Editor */}
      {tournament && onSelectMatch && (
        <div className="flex items-center justify-between gap-2 mb-3 bg-slate-100/90 border border-slate-200/80 rounded-2xl p-1">
          <div className="flex gap-1 flex-1">
            <button
              onClick={() => setViewMode("table")}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition-all ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              📊 Standings Table
            </button>
            <button
              onClick={() => setViewMode("matches")}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                viewMode === "matches"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>✏️</span>
              <span>All Matches</span>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full border border-slate-200">
                {allTournamentMatches.length}
              </span>
            </button>
          </div>
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
                className="w-full bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300 rounded-[20px] p-3 flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99] shadow-2xs group"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
                    isFinalMatch ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}>
                    {isFinalMatch ? "🏆 Final" : `M${idx + 1}`}
                  </span>

                  <div className="flex items-center gap-1.5 truncate">
                    <span className={`text-xs font-bold truncate ${aWon ? "text-slate-900 font-black" : "text-slate-600"}`}>
                      {pA?.name ?? m.playerA}
                    </span>
                    <span className="text-slate-300 text-xs font-normal">vs</span>
                    <span className={`text-xs font-bold truncate ${bWon ? "text-slate-900 font-black" : "text-slate-600"}`}>
                      {pB?.name ?? m.playerB}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  {m.played && m.scoreA !== undefined && m.scoreB !== undefined ? (
                    <span className="text-sm font-black tabular-nums text-slate-900">
                      {m.scoreA}–{m.scoreB}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs font-medium">pending</span>
                  )}

                  <span className="text-[11px] font-bold bg-slate-100 border border-slate-200 text-slate-700 group-hover:bg-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
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
            <span className="text-slate-400 text-xs font-extrabold w-7 text-center">#</span>
            <span className="text-slate-400 text-xs font-extrabold flex-1 pl-2">Player</span>
            <span className="text-slate-400 text-xs font-extrabold w-8 text-center">MP</span>
            <span className="text-slate-400 text-xs font-extrabold w-8 text-center">W</span>
            <span className="text-slate-400 text-xs font-extrabold w-10 text-center">+/-</span>
            <span className="text-slate-400 text-xs font-extrabold w-10 text-center font-black">PTS</span>
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
              className={`mb-2.5 rounded-[22px] border overflow-hidden transition-all shadow-2xs ${
                isFinalist
                  ? "bg-gradient-to-r from-amber-50/60 via-amber-50/20 to-white border-amber-300"
                  : "bg-white border-slate-200/80 hover:border-slate-300"
              }`}
            >
              {/* Row header */}
              <button
                onClick={() => canExpand && setExpandedPlayerId(isExpanded ? null : row.playerId)}
                className={`w-full flex items-center px-3 py-3 ${canExpand ? "cursor-pointer" : "cursor-default"}`}
              >
                {/* Rank */}
                <div className="w-7 text-center flex-shrink-0">
                  <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-black ${
                    idx === 0
                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                      : idx === 1
                      ? "bg-slate-100 text-slate-800 border border-slate-300"
                      : idx === 2
                      ? "bg-orange-100 text-orange-900 border border-orange-300"
                      : "text-slate-500 font-bold"
                  }`}>
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
                    <p className="text-slate-900 font-extrabold text-xs truncate">{player.name}</p>
                    {isFinalist && (
                      <p className="text-amber-700 text-[10px] font-bold">Finalist ⭐</p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <span className="text-slate-500 text-xs font-semibold w-8 text-center">{row.matchesPlayed}</span>
                <span className="text-slate-500 text-xs font-semibold w-8 text-center">{row.wins}</span>
                <span className={`text-xs w-10 text-center font-bold ${
                  row.pointDiff > 0 ? "text-emerald-600" : row.pointDiff < 0 ? "text-rose-600" : "text-slate-400"
                }`}>
                  {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                </span>
                <motion.span
                  key={row.points}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="text-base font-black w-10 text-center tabular-nums text-slate-900"
                >
                  {row.points}
                </motion.span>

                {canExpand && (
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-slate-400 text-xs ml-1 flex-shrink-0"
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
                    className="overflow-hidden border-t border-slate-100 bg-slate-50/60"
                  >
                    <div className="px-3 py-2.5 space-y-1.5">
                      {playerMatches.length === 0 ? (
                        <p className="text-slate-400 text-xs text-center py-2 font-medium">No matches yet</p>
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
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left bg-white border border-slate-200/70 shadow-2xs ${
                                onSelectMatch
                                  ? "cursor-pointer active:scale-[0.99] hover:border-slate-300"
                                  : "cursor-default"
                              }`}
                            >
                              {/* Match type tag */}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 border ${
                                isFinalMatch
                                  ? "bg-amber-100 text-amber-900 border-amber-300"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
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
                              <span className="text-slate-700 text-xs flex-1 truncate font-semibold">
                                vs {opponent?.name ?? "?"}
                              </span>

                              {/* Score & Points */}
                              {m.played && myScore !== undefined && oppScore !== undefined ? (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`text-xs font-black tabular-nums ${won ? "text-slate-900 font-black" : lost ? "text-slate-400" : "text-slate-600"}`}>
                                    {myScore}–{oppScore}
                                  </span>
                                  {myPts !== null && (
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                                      myPts > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : myPts < 0 ? "bg-rose-50 text-rose-700 border-rose-200"
                                      : "bg-slate-100 text-slate-600 border-slate-200"
                                    }`}>
                                      {myPts > 0 ? "+" : ""}{myPts}
                                    </span>
                                  )}
                                  {onSelectMatch && (
                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                                      ✏️ Edit
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-slate-400 text-xs font-medium">pending</span>
                                  {onSelectMatch && (
                                    <span className="text-[10px] font-bold bg-slate-950 text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
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
