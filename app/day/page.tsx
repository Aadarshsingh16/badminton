"use client";
// app/day/page.tsx — Day Table tab: cumulative standings + per-player tournament history

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, recoverTournamentsFromSyncQueue } from "@/lib/store";
import { AvatarSVG } from "@/components/avatars/AvatarSVG";
import { computeTournamentTable } from "@/lib/ranking";
import { Player, Tournament } from "@/lib/types";

import { PinModal } from "@/components/PinModal";
import { apiSync } from "@/lib/apiSync";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { isViewerMode, getViewerSlug } from "@/lib/viewerMode";
import { getBackendUrl } from "@/lib/backend";

const RANK_LABELS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣"];
const PODIUM_COLORS = ["#FFD166", "#A8DADC", "#FF6B35", "#9E9E9E"];
const RANK_MEDAL = ["🥇", "🥈", "🥉", "4th", "5th", "6th", "7th"];

export default function DayPage() {
  const { players, dayTable, currentTournament, pastTournaments, startNewDay } = useStore();
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [expandedTournament, setExpandedTournament] = useState<string | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showFinishDayModal, setShowFinishDayModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const [cloudDayData, setCloudDayData] = useState<{
    miniLeaderboard: Array<{ playerId: string; name: string; points: number; matches: number; wins: number }>;
    tournaments: any[];
    totalMatches: number;
    totalPoints: number;
  } | null>(null);
  const [isViewer, setIsViewer] = useState(false);
  const [viewerSlug, setViewerSlugState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const viewer = isViewerMode() && !currentTournament;
    setIsViewer(viewer);
    setViewerSlugState(getViewerSlug());

    const fetchCloudDay = async () => {
      setLoading(true);
      try {
        const backendUrl = getBackendUrl();
        const res = await fetch(`${backendUrl}/history?range=day`);
        if (res.ok) {
          const json = await res.json();
          const todayGroup = json.days?.[0];
          setCloudDayData({
            miniLeaderboard: json.miniLeaderboard || [],
            tournaments: todayGroup?.tournaments || [],
            totalMatches: json.totalMatches || 0,
            totalPoints: json.totalPoints || 0,
          });
        }
      } catch (err) {
        console.warn("Failed to fetch cloud day data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCloudDay();
  }, [currentTournament]);

  const getPlayer = (id: string): Player =>
    players.find((p) => p.id === id) ?? { id, name: id, avatar: "custom" as any };

  // Combine past tournaments + recovered tournaments + cloud fallback tournaments
  const effectiveTournaments = useMemo<Tournament[]>(() => {
    let list = [...pastTournaments];
    if (list.length === 0) {
      const rec = recoverTournamentsFromSyncQueue();
      if (rec.length > 0) list = rec;
    }

    if (list.length === 0 && cloudDayData?.tournaments && cloudDayData.tournaments.length > 0) {
      return cloudDayData.tournaments.map((ct: any) => {
        const mappedMatches = (ct.matches || []).map((m: any) => ({
          ...m,
          pointsAwarded: m.pointsAwarded || {
            [m.playerA]: m.pointsA ?? 0,
            [m.playerB]: m.pointsB ?? 0,
          },
        }));
        const finalMatch = mappedMatches.find((m: any) => m.isFinal);
        const rrMatches = mappedMatches.filter((m: any) => !m.isFinal);
        const pIds = Array.from(new Set(mappedMatches.flatMap((m: any) => [m.playerA, m.playerB]))).filter(Boolean) as string[];

        return {
          id: ct.tournamentId,
          shareSlug: ct.shareSlug,
          playerIds: pIds,
          matches: rrMatches,
          final: finalMatch,
          config: { winScore: 5, bonusMargin: 4, matchBonusPoints: 1, shutoutBonusPoints: 1, finalBonusPoints: 2 },
          isPractice: false,
          dayPointsAwarded: {},
          byes: {},
          closed: true,
          createdAt: new Date().toISOString(),
        } as unknown as Tournament;
      });
    }

    return list;
  }, [pastTournaments, cloudDayData]);

  // Sort players by day total (use local dayTable if host has it, else cloud day summary)
  const sortedPlayers = useMemo(() => {
    if (Object.keys(dayTable.totals).length > 0 && !isViewer) {
      return Object.entries(dayTable.totals)
        .sort(([, a], [, b]) => b - a)
        .map(([id, pts], idx) => ({ id, pts, rank: idx + 1 }));
    }

    if (cloudDayData?.miniLeaderboard && cloudDayData.miniLeaderboard.length > 0) {
      return cloudDayData.miniLeaderboard.map((item, idx) => ({
        id: item.playerId,
        pts: item.points,
        rank: idx + 1,
      }));
    }

    return Object.entries(dayTable.totals)
      .sort(([, a], [, b]) => b - a)
      .map(([id, pts], idx) => ({ id, pts, rank: idx + 1 }));
  }, [dayTable.totals, cloudDayData, isViewer]);

  const hasTournaments = effectiveTournaments.length > 0;
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

  /** For a given player, get their position in each tournament */
  const getPlayerTournamentHistory = (playerId: string) => {
    return effectiveTournaments
      .map((t) => {
        const tTable = computeTournamentTable(t);
        const rowIdx = tTable.findIndex((r) => r.playerId === playerId);
        if (rowIdx === -1) return null;
        const row = tTable[rowIdx];
        const dayPts = t.dayPointsAwarded?.[playerId] ?? row.points;
        return { tournament: t, rank: rowIdx + 1, points: row.points, dayPts, rowIdx };
      })
      .filter(Boolean) as { tournament: Tournament; rank: number; points: number; dayPts: number; rowIdx: number }[];
  };

  return (
    <div className="min-h-full flex flex-col relative pb-24">
      <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-white font-black text-2xl leading-tight">Day Table</h1>
            <p className="text-white/40 text-xs">
              {dayTable.date || new Date().toISOString().split("T")[0]} · {effectiveTournaments.length} tournament
              {effectiveTournaments.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isViewer ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-purple-300 bg-purple-500/20 border border-purple-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Spectator Mode
                </span>
                {viewerSlug && (
                  <Link
                    href={`/live/${viewerSlug}`}
                    className="text-[11px] font-bold text-white bg-purple-600/40 hover:bg-purple-600/60 border border-purple-500/40 px-3 py-1 rounded-full flex items-center gap-1 transition-colors"
                  >
                    <span>🏸 Match Stream</span>
                  </Link>
                )}
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Spectator Mode Banner */}
      {isViewer && (
        <div className="mx-4 mb-3 px-3.5 py-2.5 rounded-2xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span>📡</span>
            <span className="text-purple-200">
              Viewing live session standings for <strong>{dayTable.date || new Date().toISOString().split("T")[0]}</strong>
            </span>
          </div>
          {viewerSlug && (
            <Link
              href={`/live/${viewerSlug}`}
              className="text-emerald-400 font-bold text-[11px] hover:underline flex items-center gap-1"
            >
              <span>Live Court</span>
              <span>&rarr;</span>
            </Link>
          )}
        </div>
      )}

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
                  onClick={() => {
                    startNewDay();
                    setShowConfirmReset(false);
                  }}
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

      {/* Loading state */}
      {loading && !hasData && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3 py-16">
          <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-xs font-semibold">Loading live session standings...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasData && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4 py-16">
          <div className="text-6xl">📊</div>
          <h3 className="text-white font-bold text-xl">No day matches yet</h3>
          <p className="text-white/40 text-sm">
            {isViewer ? "Waiting for tournament matches to finish..." : "Complete a tournament to see standings here"}
          </p>
          {isViewer && viewerSlug && (
            <Link
              href={`/live/${viewerSlug}`}
              className="mt-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md"
            >
              Watch Live Stream 👁️
            </Link>
          )}
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
                      {history.length > 0
                        ? `${history.length} tournament${history.length !== 1 ? "s" : ""} played`
                        : "Active today"}
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
                          <p className="text-white/30 text-xs text-center py-2">
                            {pts > 0 ? `${pts} points awarded from tournament play` : "No matches recorded yet"}
                          </p>
                        ) : (
                          history.map(({ tournament: t, rank: tRank, points: tPts, dayPts, rowIdx }, hIdx) => {
                            const tNum = effectiveTournaments.indexOf(t) + 1;
                            const rankColor = PODIUM_COLORS[rowIdx] ?? "#9E9E9E";
                            // Get player's matches in this tournament
                            const playerMatches = [
                              ...t.matches.filter((m) => m.playerA === id || m.playerB === id),
                              ...(t.final && (t.final.playerA === id || t.final.playerB === id) ? [t.final] : []),
                            ];
                            const wins = playerMatches.filter((m) => {
                              if (!m.played) return false;
                              const isA = m.playerA === id;
                              const myScore = isA ? m.scoreA : m.scoreB;
                              const oppScore = isA ? m.scoreB : m.scoreA;
                              return myScore !== undefined && oppScore !== undefined && myScore > oppScore;
                            }).length;

                            return (
                              <div key={t.id || hIdx} className="bg-white/5 rounded-xl px-3 py-2">
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
                                    <span className="text-white/40 text-xs">
                                      {wins}W/{playerMatches.filter((m) => m.played).length - wins}L
                                    </span>
                                    <span className="text-green-400 text-xs font-bold">+{dayPts} day</span>
                                  </div>
                                </div>

                                {/* Matches in this tournament */}
                                <div className="space-y-1">
                                  {playerMatches.map((m) => {
                                    const isFinalMatch = m.round === -1 || m.isFinal;
                                    const isPlayerA = m.playerA === id;
                                    const opponent = getPlayer(isPlayerA ? m.playerB : m.playerA);
                                    const myScore = isPlayerA ? m.scoreA : m.scoreB;
                                    const oppScore = isPlayerA ? m.scoreB : m.scoreA;
                                    const myPts = m.pointsAwarded?.[id] ?? (isPlayerA ? (m as any).pointsA : (m as any).pointsB) ?? null;
                                    const won =
                                      m.played && myScore !== undefined && oppScore !== undefined && myScore > oppScore;
                                    const lost =
                                      m.played && myScore !== undefined && oppScore !== undefined && myScore < oppScore;

                                    return (
                                      <div
                                        key={m.id}
                                        className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs ${
                                          !m.played ? "bg-white/3" : won ? "bg-green-500/10" : "bg-white/3"
                                        }`}
                                      >
                                        <span
                                          className={`font-bold px-1 py-0.5 rounded flex-shrink-0 ${
                                            isFinalMatch
                                              ? "bg-yellow-500/20 text-yellow-300"
                                              : "bg-white/10 text-white/40"
                                          }`}
                                        >
                                          {isFinalMatch ? "🏆" : `R${m.round + 1}`}
                                        </span>
                                        <AvatarSVG
                                          type={opponent.avatar}
                                          size={16}
                                          emoji={opponent.avatarEmoji}
                                          color={opponent.avatarColor}
                                          className="flex-shrink-0"
                                        />
                                        <span className="text-white/50 flex-1 truncate">vs {opponent.name}</span>
                                        {m.played && myScore !== undefined && oppScore !== undefined ? (
                                          <>
                                            <span
                                              className={`font-bold tabular-nums ${
                                                won ? "text-green-400" : lost ? "text-white/30" : "text-white/50"
                                              }`}
                                            >
                                              {myScore}–{oppScore}
                                            </span>
                                            {myPts !== null && (
                                              <span
                                                className={`font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                                  myPts > 0
                                                    ? "bg-green-500/20 text-green-400"
                                                    : myPts < 0
                                                    ? "bg-red-500/20 text-red-400"
                                                    : "bg-white/10 text-white/40"
                                                }`}
                                              >
                                                {myPts > 0 ? "+" : ""}
                                                {myPts}
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

          {effectiveTournaments.map((t: Tournament, tIdx) => {
            const tTable = computeTournamentTable(t);
            const isExpanded = expandedTournament === t.id;
            const tournamentNumber = tIdx + 1;

            return (
              <div key={t.id || tIdx} className="mb-3 bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
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
                  <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} className="text-white/30 text-lg">
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
                          const dayPts = t.dayPointsAwarded?.[row.playerId] ?? row.points;
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
                              🏆 Final: {getPlayer(t.final.playerA).name} {t.final.scoreA} – {t.final.scoreB}{" "}
                              {getPlayer(t.final.playerB).name}
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
