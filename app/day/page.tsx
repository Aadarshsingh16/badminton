"use client";
// app/day/page.tsx — Day Table tab: cumulative standings + history

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";
import { AvatarSVG } from "@/components/avatars/AvatarSVG";
import { computeTournamentTable } from "@/lib/ranking";
import { Player, Tournament } from "@/lib/types";

const RANK_LABELS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣"];
const PODIUM_COLORS = ["#FFD166", "#A8DADC", "#FF6B35", "#9E9E9E"];

export default function DayPage() {
  const { players, dayTable, pastTournaments, startNewDay } = useStore();
  const [expandedTournament, setExpandedTournament] = useState<string | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const getPlayer = (id: string): Player =>
    players.find((p) => p.id === id) ?? { id, name: id, avatar: "custom" as any };

  // Sort players by day total
  const sortedPlayers = Object.entries(dayTable.totals)
    .sort(([, a], [, b]) => b - a)
    .map(([id, pts], idx) => ({ id, pts, rank: idx + 1 }));

  const hasTournaments = pastTournaments.length > 0;
  const hasData = sortedPlayers.length > 0;

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-white font-black text-2xl leading-tight">Day Table</h1>
            <p className="text-white/40 text-xs">
              {dayTable.date} · {dayTable.tournaments.length} tournament{dayTable.tournaments.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowConfirmReset(true)}
            className="text-xs bg-red-500/15 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-full hover:bg-red-500/25 transition-colors"
          >
            New Day
          </button>
        </div>
      </div>

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
              <h3 className="text-white font-black text-xl mb-2">Start New Day?</h3>
              <p className="text-white/50 text-sm mb-6">
                This will reset the day table and all tournament history. Cannot be undone.
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

      {/* Empty state */}
      {!hasData && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
          <div className="text-6xl">📊</div>
          <h3 className="text-white font-bold text-xl">No data yet</h3>
          <p className="text-white/40 text-sm">Complete a tournament to see standings here</p>
        </div>
      )}

      {/* Day standings */}
      {hasData && (
        <div className="px-4 mb-6">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Cumulative Standings</p>

          {sortedPlayers.map(({ id, pts, rank }, idx) => {
            const player = getPlayer(id);
            const color = PODIUM_COLORS[idx] ?? "#9E9E9E";

            return (
              <motion.div
                key={id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06 }}
                className="flex items-center gap-3 mb-3 bg-white/5 border border-white/5 rounded-2xl px-4 py-3"
              >
                <span className="text-xl w-8 text-center">
                  {RANK_LABELS[idx] ?? `${rank}`}
                </span>
                <AvatarSVG
                  type={player.avatar}
                  size={40}
                  emoji={player.avatarEmoji}
                  color={player.avatarColor}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{player.name}</p>
                  <p className="text-white/30 text-xs">{dayTable.tournaments.length} tournament{dayTable.tournaments.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-right">
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
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Tournament history */}
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
                              <span className="text-white/30 text-sm w-6 text-center">{rowIdx + 1}</span>
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
