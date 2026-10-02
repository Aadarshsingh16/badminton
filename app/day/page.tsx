"use client";
// app/day/page.tsx — Day Table tab: cumulative standings + per-player tournament history

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";
import { AvatarSVG } from "@/components/avatars/AvatarSVG";
import { computeTournamentTable } from "@/lib/ranking";
import { Player, Tournament } from "@/lib/types";

import { PinModal } from "@/components/PinModal";
import { apiSync } from "@/lib/apiSync";
import { ConfettiBurst } from "@/components/ConfettiBurst";

const RANK_LABELS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣"];
const PODIUM_COLORS = ["#FFD166", "#A8DADC", "#FF6B35", "#9E9E9E"];
const RANK_MEDAL = ["🥇", "🥈", "🥉", "4th", "5th", "6th", "7th"];

export default function DayPage() {
  const { players, dayTable, pastTournaments, startNewDay } = useStore();
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [expandedTournament, setExpandedTournament] = useState<string | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showFinishDayModal, setShowFinishDayModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const getPlayer = (id: string): Player =>
    players.find((p) => p.id === id) ?? { id, name: id, avatar: "custom" as any };

  // Sort players by day total
  const sortedPlayers = Object.entries(dayTable.totals)
    .sort(([, a], [, b]) => b - a)
    .map(([id, pts], idx) => ({ id, pts, rank: idx + 1 }));

  const hasTournaments = pastTournaments.length > 0;
  const hasData = sortedPlayers.length > 0;

  const handleFinishDay = () => {
    if (!apiSync.hasPin()) {
      setShowPinModal(true);
      return;
    }

    // Close day table on backend and crown champions
    apiSync.enqueue("/day-tables/close", "POST", {
      date: dayTable.date,
      totals: dayTable.totals,
    });

    setShowConfetti(true);
    setShowFinishDayModal(false);
    startNewDay();
  };

  /** For a given player, get their position in each past tournament */
  const getPlayerTournamentHistory = (playerId: string) => {
    return pastTournaments.map((t) => {
      const tTable = computeTournamentTable(t);
      const rowIdx = tTable.findIndex((r) => r.playerId === playerId);
      if (rowIdx === -1) return null;
      const row = tTable[rowIdx];
      const dayPts = t.dayPointsAwarded?.[playerId] ?? 0;
      return { tournament: t, rank: rowIdx + 1, points: row.points, dayPts, rowIdx };
    }).filter(Boolean) as { tournament: Tournament; rank: number; points: number; dayPts: number; rowIdx: number }[];
  };

  return (
    <div className="min-h-full flex flex-col relative">
      <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-white font-black text-2xl leading-tight">Day Table</h1>
            <p className="text-white/40 text-xs">
              {dayTable.date} · {dayTable.tournaments.length} tournament{dayTable.tournaments.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasData && (
              <button
                onClick={() => setShowFinishDayModal(true)}
                className="text-xs bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black px-3.5 py-1.5 rounded-full shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <span>👑</span>
                <span>Finish Day</span>
              </button>
            )}
            <button
              onClick={() => setShowConfirmReset(true)}
              title="Reset Day"
              className="text-xs bg-white/5 hover:bg-white/10 text-gray-400 hover:text-red-400 border border-white/10 p-1.5 rounded-full transition-colors"
            >
              <span>🗑️</span>
            </button>
          </div>
        </div>
      </div>

      {/* Finish Day Celebration Modal */}
      <AnimatePresence>
        {showFinishDayModal && hasData && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
              onClick={() => setShowFinishDayModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="text-center space-y-1">
                <div className="text-4xl mb-2">👑</div>
                <h3 className="text-white font-black text-xl">Crown Day Champions</h3>
                <p className="text-white/40 text-xs">Finish session for {dayTable.date}</p>
              </div>

              {/* Honors Preview */}
              <div className="space-y-2 py-1">
                {sortedPlayers[0] && (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="text-xl">👑</div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-amber-400">Day Champion</p>
                        <p className="text-sm font-black text-white">{getPlayer(sortedPlayers[0].id).name}</p>
                      </div>
                    </div>
                    <div className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs">
                      {sortedPlayers[0].pts} pts
                    </div>
                  </div>
                )}

                {sortedPlayers.length >= 2 && sortedPlayers[sortedPlayers.length - 1] && (
                  <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="text-xl">🥄</div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-red-400">Wooden Spoon</p>
                        <p className="text-sm font-black text-white">
                          {getPlayer(sortedPlayers[sortedPlayers.length - 1].id).name}
                        </p>
                      </div>
                    </div>
                    <div className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 font-bold text-xs">
                      {sortedPlayers[sortedPlayers.length - 1].pts} pts
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                This saves today's champions into your permanent Hall of Fame and starts a fresh day table for your next session.
              </p>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFinishDayModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 font-semibold text-xs transition-colors"
                >
                  Keep Playing
                </button>
                <button
                  type="button"
                  onClick={handleFinishDay}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  Crown &amp; Finish 👑
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* New Day confirmation */}
      <AnimatePresence>
        {showConfirmReset && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-40"
              onClick={() => setShowConfirmReset(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-x-6 top-1/2 -translate-y-1/2 z-50 bg-slate-900 border border-red-500/30 rounded-2xl p-6 text-center"
            >
              <div className="text-4xl mb-3">🗑️</div>
              <h3 className="text-white font-black text-xl mb-2">Reset Day Table?</h3>
              <p className="text-white/50 text-sm mb-6">
                This will clear today's table without recording Day Champions. Cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmReset(false)}
                  className="flex-1 py-3 rounded-xl bg-white/10 text-white/70 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { startNewDay(); setShowConfirmReset(false); }}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold"
                >
                  Reset
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Scorekeeper PIN Modal */}
      <PinModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          setShowPinModal(false);
          handleFinishDay();
        }}
      />

      {/* Empty state */}
      {!hasData && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
          <div className="text-6xl">📊</div>
          <h3 className="text-white font-bold text-xl">No data yet</h3>
          <p className="text-white/40 text-sm">Complete a tournament to see standings here</p>
        </div>
      )}

      {/* Day standings — expandable per player */}
      {hasData && (
        <div className="px-4 mb-6">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Cumulative Standings</p>

          {sortedPlayers.map(({ id, pts, rank }, idx) => {
            const player = getPlayer(id);
            const color = PODIUM_COLORS[idx] ?? "#9E9E9E";
            const isExpanded = expandedPlayerId === id;
            const history = getPlayerTournamentHistory(id);

            return (
              <motion.div
                key={id}
                layout
                className="mb-3 rounded-2xl border border-white/5 overflow-hidden bg-white/5"
              >
                {/* Row header */}
                <button
                  onClick={() => setExpandedPlayerId(isExpanded ? null : id)}
                  className="w-full flex items-center gap-3 px-4 py-3"
                >
                  <span className="text-xl w-8 text-center flex-shrink-0">
                    {RANK_LABELS[idx] ?? `${rank}`}
                  </span>
                  <AvatarSVG
                    type={player.avatar}
                    size={40}
                    emoji={player.avatarEmoji}
                    color={player.avatarColor}
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-white font-semibold truncate">{player.name}</p>
                    <p className="text-white/30 text-xs">
                      {history.length} tournament{history.length !== 1 ? "s" : ""} played
                    </p>
                  </div>
                  <div className="text-right mr-2">
                    <motion.p
                      key={pts}
                      initial={{ scale: 1.3 }}
                      animate={{ scale: 1 }}
                      className="font-black text-2xl tabular-nums"
                      style={{ color }}
                    >
                      {pts}
                    </motion.p>
                    <p className="text-white/30 text-xs">day pts</p>
                  </div>
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-white/30 text-sm flex-shrink-0"
                  >
                    ▾
                  </motion.span>
                </button>

                {/* Expandable: per-tournament positions */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-white/5"
                    >
                      <div className="px-4 py-3 space-y-2">
                        {history.length === 0 ? (
                          <p className="text-white/30 text-xs text-center py-1">No tournament history</p>
                        ) : (
                          history.map(({ tournament: t, rank: tRank, points: tPts, dayPts, rowIdx }, hIdx) => {
                            const tNum = pastTournaments.indexOf(t) + 1;
                            const rankColor = PODIUM_COLORS[rowIdx] ?? "#9E9E9E";
                            // Get player's matches in this tournament
                            const playerMatches = [
                              ...t.matches.filter(m => m.playerA === id || m.playerB === id),
                              ...(t.final && (t.final.playerA === id || t.final.playerB === id) ? [t.final] : []),
                            ];
                            const wins = playerMatches.filter(m => {
                              if (!m.played) return false;
                              const isA = m.playerA === id;
                              const myScore = isA ? m.scoreA : m.scoreB;
                              const oppScore = isA ? m.scoreB : m.scoreA;
                              return myScore !== undefined && oppScore !== undefined && myScore > oppScore;
                            }).length;

                            return (
                              <div key={t.id} className="bg-white/5 rounded-xl px-3 py-2">
                                {/* Tournament header */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/40 text-xs font-bold">T{tNum}</span>
                                    <span className="text-sm" style={{ color: rankColor }}>
                                      {RANK_MEDAL[rowIdx] ?? `${tRank}th`}
                                    </span>
                                    <span className="text-white text-sm font-semibold">{tPts} pts</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/40 text-xs">{wins}W/{playerMatches.filter(m => m.played).length - wins}L</span>
                                    <span className="text-green-400 text-xs font-bold">+{dayPts} day</span>
                                  </div>
                                </div>

                                {/* Matches in this tournament */}
                                <div className="space-y-1">
                                  {playerMatches.map((m) => {
                                    const isFinalMatch = m.round === -1;
                                    const isPlayerA = m.playerA === id;
                                    const opponent = getPlayer(isPlayerA ? m.playerB : m.playerA);
                                    const myScore = isPlayerA ? m.scoreA : m.scoreB;
                                    const oppScore = isPlayerA ? m.scoreB : m.scoreA;
                                    const myPts = m.pointsAwarded?.[id] ?? null;
                                    const won = m.played && myScore !== undefined && oppScore !== undefined && myScore > oppScore;
                                    const lost = m.played && myScore !== undefined && oppScore !== undefined && myScore < oppScore;

                                    return (
                                      <div key={m.id} className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs ${
                                        !m.played ? "bg-white/3" : won ? "bg-green-500/10" : "bg-white/3"
                                      }`}>
                                        <span className={`font-bold px-1 py-0.5 rounded flex-shrink-0 ${
                                          isFinalMatch ? "bg-yellow-500/20 text-yellow-300" : "bg-white/10 text-white/40"
                                        }`}>
                                          {isFinalMatch ? "🏆" : `R${m.round + 1}`}
                                        </span>
                                        <AvatarSVG type={opponent.avatar} size={16} emoji={opponent.avatarEmoji} color={opponent.avatarColor} className="flex-shrink-0" />
                                        <span className="text-white/50 flex-1 truncate">vs {opponent.name}</span>
                                        {m.played && myScore !== undefined && oppScore !== undefined ? (
                                          <>
                                            <span className={`font-bold tabular-nums ${won ? "text-green-400" : lost ? "text-white/30" : "text-white/50"}`}>
                                              {myScore}–{oppScore}
                                            </span>
                                            {myPts !== null && (
                                              <span className={`font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                                myPts > 0 ? "bg-green-500/20 text-green-400"
                                                : myPts < 0 ? "bg-red-500/20 text-red-400"
                                                : "bg-white/10 text-white/40"
                                              }`}>
                                                {myPts > 0 ? "+" : ""}{myPts}
                                              </span>
                                            )}
                                          </>
                                        ) : (
                                          <span className="text-white/20">—</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
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
        </div>
      )}

      {/* Tournament history (accordion by tournament) */}
      {hasTournaments && (
        <div className="px-4 mb-8">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Tournament History</p>

          {pastTournaments.map((t: Tournament, tIdx) => {
            const tTable = computeTournamentTable(t);
            const isExpanded = expandedTournament === t.id;
            const tournamentNumber = tIdx + 1;

            return (
              <div key={t.id} className="mb-3 bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedTournament(isExpanded ? null : t.id)}
                  className="w-full flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-white/30 text-sm font-bold">#{tournamentNumber}</span>
                    <div className="text-left">
                      <p className="text-white font-semibold text-sm">Tournament {tournamentNumber}</p>
                      <p className="text-white/40 text-xs">
                        {t.playerIds.length} players · {t.matches.length} matches
                        {t.final?.played ? " + Final" : ""}
                        {" · "}First to {t.config?.winScore ?? 5}
                      </p>
                    </div>
                  </div>
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    className="text-white/30 text-lg"
                  >
                    ▾
                  </motion.span>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-white/5"
                    >
                      <div className="px-4 py-3">
                        {tTable.map((row, rowIdx) => {
                          const p = getPlayer(row.playerId);
                          const dayPts = t.dayPointsAwarded?.[row.playerId] ?? 0;
                          return (
                            <div key={row.playerId} className="flex items-center gap-3 py-2">
                              <span className="text-white/30 text-sm w-6 text-center">
                                {RANK_MEDAL[rowIdx] ?? `${rowIdx + 1}`}
                              </span>
                              <AvatarSVG type={p.avatar} size={28} emoji={p.avatarEmoji} color={p.avatarColor} />
                              <p className="text-white text-sm flex-1">{p.name}</p>
                              <div className="text-right">
                                <p className="text-white font-bold text-sm">{row.points} pts</p>
                                <p className="text-green-400 text-xs">+{dayPts} day</p>
                              </div>
                            </div>
                          );
                        })}

                        {/* Final result */}
                        {t.final?.played && t.final.scoreA !== undefined && t.final.scoreB !== undefined && (
                          <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2 text-center">
                            <p className="text-yellow-400 text-xs font-semibold">
                              🏆 Final: {getPlayer(t.final.playerA).name} {t.final.scoreA} – {t.final.scoreB} {getPlayer(t.final.playerB).name}
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
