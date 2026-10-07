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
import { ShareModal } from "@/components/ShareModal";
import { apiSync } from "@/lib/apiSync";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { isViewerMode, getViewerSlug } from "@/lib/viewerMode";
import { getBackendUrl } from "@/lib/backend";

const RANK_LABELS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣"];
const PODIUM_COLORS = ["#D97706", "#475569", "#C2410C", "#64748B"];
const RANK_MEDAL = ["🥇", "🥈", "🥉", "4th", "5th", "6th", "7th"];

export default function DayPage() {
  const { players, dayTable, currentTournament, pastTournaments, startNewDay, resetDayTable } = useStore();
  const [activeDayTab, setActiveDayTab] = useState<"standings" | "tournaments">("standings");
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [expandedTournament, setExpandedTournament] = useState<string | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showFinishDayModal, setShowFinishDayModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState<"finish" | "reset">("finish");
  const [showConfetti, setShowConfetti] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [cloudDayData, setCloudDayData] = useState<{
    miniLeaderboard: Array<{ playerId: string; name: string; points: number; matches: number; wins: number }>;
    tournaments: any[];
    totalMatches: number;
    totalPoints: number;
  } | null>(null);
  const [isViewer, setIsViewer] = useState(false);
  const [viewerSlug, setViewerSlugState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCloudDay = async () => {
    setLoading(true);
    try {
      const backendUrl = getBackendUrl();
      const dateParam = dayTable.date || new Date().toISOString().split("T")[0];
      const res = await fetch(`${backendUrl}/history?from=${dateParam}&to=${dateParam}`);
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

  useEffect(() => {
    const viewer = isViewerMode() && !currentTournament;
    setIsViewer(viewer);
    setViewerSlugState(getViewerSlug());

    fetchCloudDay();
  }, [currentTournament, dayTable.date]);

  const getPlayer = (id: string): Player =>
    players.find((p) => p.id === id) ?? { id, name: id, avatar: "custom" as any };

  // Combine past tournaments + recovered tournaments + cloud fallback tournaments
  const effectiveTournaments = useMemo<Tournament[]>(() => {
    let list = [...pastTournaments];
    if (list.length === 0) {
      const rec = recoverTournamentsFromSyncQueue();
      if (rec.length > 0) list = rec;
    }

    if (isViewer && list.length === 0 && cloudDayData?.tournaments && cloudDayData.tournaments.length > 0) {
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
  }, [pastTournaments, cloudDayData, isViewer]);

  // Sort players by day total (use local dayTable if host has it, else cloud day summary for viewers)
  const sortedPlayers = useMemo(() => {
    if (Object.keys(dayTable.totals).length > 0 && !isViewer) {
      return Object.entries(dayTable.totals)
        .sort(([, a], [, b]) => b - a)
        .map(([id, pts], idx) => ({ id, pts, rank: idx + 1 }));
    }

    if (isViewer && cloudDayData?.miniLeaderboard && cloudDayData.miniLeaderboard.length > 0) {
      return cloudDayData.miniLeaderboard.map((item, idx) => ({
        id: item.playerId,
        pts: item.points,
        rank: idx + 1,
      }));
    }

    return [];
  }, [dayTable.totals, cloudDayData, isViewer]);

  const hasTournaments = effectiveTournaments.length > 0;
  const hasData = sortedPlayers.length > 0;

  const handleFinishDay = () => {
    if (!apiSync.hasPin()) {
      setPinAction("finish");
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

  const handleResetDay = async () => {
    if (!apiSync.hasPin()) {
      setPinAction("reset");
      setShowPinModal(true);
      return;
    }

    setIsDeleting(true);
    const targetDate = dayTable.date || new Date().toISOString().split("T")[0];

    // 1. Immediately wipe cloud state in UI
    setCloudDayData(null);

    // 2. Call store resetDayTable
    resetDayTable(targetDate);

    setShowConfirmReset(false);

    // 3. Directly call backend to delete the day table & day results
    try {
      const backendUrl = getBackendUrl();
      const headers = {
        "Content-Type": "application/json",
        "x-scorekeeper-pin": apiSync.getPin(),
      };
      await Promise.all([
        fetch(`${backendUrl}/day-tables/${targetDate}`, { method: "DELETE", headers }),
        fetch(`${backendUrl}/day-results/${targetDate}`, { method: "DELETE", headers }),
      ]);
    } catch (e) {
      console.warn("Direct day delete failed, queued in background:", e);
    } finally {
      setIsDeleting(false);
    }

    // 4. Re-fetch cloud day
    fetchCloudDay();
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
    <div className="min-h-screen bg-[#F7F9FD] text-slate-900 pb-32">
      <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Top Header */}
      <div className="px-5 pt-6 pb-3 border-b border-slate-200/60 bg-[#F7F9FD]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <h1 className="text-slate-900 font-black text-2xl tracking-tight">Day Table</h1>
            </div>
            <p className="text-slate-500 text-xs mt-0.5 font-medium">
              {dayTable.date || new Date().toISOString().split("T")[0]} · {effectiveTournaments.length} tournament
              {effectiveTournaments.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isViewer ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-indigo-900 bg-indigo-100/90 border border-indigo-200 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live View
                </span>
                <Link
                  href={`/live/${dayTable.date || new Date().toISOString().split("T")[0]}`}
                  className="text-[11px] font-bold text-white bg-slate-950 px-3 py-1 rounded-full flex items-center gap-1 shadow-xs hover:bg-slate-800 transition-all"
                >
                  <span>🏸 Stream</span>
                </Link>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowShareModal(true)}
                  title="Share day live stream"
                  className="w-8 h-8 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <span className="text-xs">📡</span>
                </button>
                {hasData && (
                  <button
                    onClick={() => setShowFinishDayModal(true)}
                    className="text-xs bg-slate-950 hover:bg-slate-800 text-white font-black px-3.5 py-1.5 rounded-full shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <span>👑</span>
                    <span>Finish Day</span>
                  </button>
                )}
                <button
                  onClick={() => setShowConfirmReset(true)}
                  title="Reset Day"
                  className="w-8 h-8 rounded-full bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200/80 hover:border-rose-200 flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                >
                  <span className="text-xs">🗑️</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Spectator Mode Banner */}
      {isViewer && (
        <div className="mx-5 mt-3 px-4 py-2.5 rounded-[22px] bg-purple-50 border border-purple-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span>📡</span>
            <span className="text-purple-900 font-medium">
              Viewing live session for <strong>{dayTable.date || new Date().toISOString().split("T")[0]}</strong>
            </span>
          </div>
          {viewerSlug && (
            <Link
              href={`/live/${viewerSlug}`}
              className="text-purple-700 font-black text-xs hover:underline flex items-center gap-0.5"
            >
              <span>Court</span>
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
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40"
              onClick={() => setShowFinishDayModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto bg-white border border-slate-200/80 rounded-[32px] p-6 shadow-2xl space-y-4"
            >
              <div className="text-center space-y-1">
                <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-3xl flex items-center justify-center mx-auto mb-2 shadow-xs">
                  👑
                </div>
                <h3 className="text-slate-900 font-black text-xl">Crown Day Champions</h3>
                <p className="text-slate-400 text-xs font-medium">Finish session for {dayTable.date}</p>
              </div>

              {/* Honors Preview */}
              <div className="space-y-2 py-1">
                {sortedPlayers[0] && (
                  <div className="p-3.5 rounded-[22px] bg-amber-50/80 border border-amber-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="text-2xl">👑</div>
                      <div>
                        <p className="text-[10px] uppercase font-black tracking-wider text-amber-800">
                          Day Champion
                        </p>
                        <p className="text-sm font-black text-slate-900">{getPlayer(sortedPlayers[0].id).name}</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-black text-xs">
                      {sortedPlayers[0].pts} pts
                    </div>
                  </div>
                )}

                {sortedPlayers.length >= 2 && sortedPlayers[sortedPlayers.length - 1] && (
                  <div className="p-3.5 rounded-[22px] bg-rose-50/80 border border-rose-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="text-2xl">🥄</div>
                      <div>
                        <p className="text-[10px] uppercase font-black tracking-wider text-rose-800">
                          Wooden Spoon
                        </p>
                        <p className="text-sm font-black text-slate-900">
                          {getPlayer(sortedPlayers[sortedPlayers.length - 1].id).name}
                        </p>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 font-black text-xs">
                      {sortedPlayers[sortedPlayers.length - 1].pts} pts
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-500 text-center leading-relaxed font-medium">
                This saves today's champions into your permanent Hall of Fame and starts a fresh day table for your next session.
              </p>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFinishDayModal(false)}
                  className="flex-1 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                >
                  Keep Playing
                </button>
                <button
                  type="button"
                  onClick={handleFinishDay}
                  className="flex-1 py-3 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-black text-xs shadow-md active:scale-95 transition-all"
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
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40"
              onClick={() => setShowConfirmReset(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-x-5 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto bg-white border border-slate-200/80 rounded-[32px] p-6 text-center shadow-2xl space-y-3"
            >
              <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 text-2xl flex items-center justify-center mx-auto mb-2 text-rose-600 shadow-xs">
                🗑️
              </div>
              <h3 className="text-slate-900 font-black text-xl">Reset Day Table?</h3>
              <p className="text-slate-500 text-xs leading-relaxed font-medium">
                This will clear today's table without recording Day Champions. Cannot be undone.
              </p>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmReset(false)}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetDay}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? <span>Resetting...</span> : <span>Reset</span>}
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
          if (pinAction === "reset") {
            handleResetDay();
          } else {
            handleFinishDay();
          }
        }}
      />

      {/* Loading state */}
      {loading && !hasData && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3 py-16">
          <div className="w-10 h-10 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-xs font-semibold">Loading live session standings...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasData && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
          <div className="w-20 h-20 rounded-[28px] bg-white border border-slate-200/80 flex items-center justify-center text-4xl shadow-xs mb-4">
            🏸
          </div>
          <h3 className="text-slate-900 font-black text-xl tracking-tight">No Day Matches Yet</h3>
          <p className="text-slate-500 text-xs mt-1 max-w-xs leading-relaxed font-medium">
            {isViewer
              ? "Waiting for live tournament matches to finish..."
              : "Complete tournament matches to start racking up today's cumulative points!"}
          </p>
          {isViewer && viewerSlug ? (
            <Link
              href={`/live/${viewerSlug}`}
              className="mt-5 px-5 py-2.5 rounded-full bg-slate-950 text-white font-black text-xs shadow-sm hover:bg-slate-800 active:scale-95 transition-all"
            >
              Watch Live Stream 👁️
            </Link>
          ) : (
            <Link
              href="/"
              className="mt-5 px-5 py-2.5 rounded-full bg-slate-950 text-white font-black text-xs shadow-sm hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span>Start Tournament</span>
              <span>&rarr;</span>
            </Link>
          )}
        </div>
      )}

      {/* Content when data or tournaments exist */}
      {(hasData || hasTournaments) && (
        <div className="px-5 pt-3">
          {/* Section Segmented Pill Switcher */}
          <div className="flex gap-1.5 p-1 bg-white rounded-full border border-slate-200/80 shadow-xs mb-4">
            <button
              onClick={() => setActiveDayTab("standings")}
              className={`flex-1 py-2 px-3 rounded-full text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                activeDayTab === "standings"
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>🏆</span>
              <span>Cumulative Standings</span>
            </button>
            <button
              onClick={() => setActiveDayTab("tournaments")}
              className={`flex-1 py-2 px-3 rounded-full text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                activeDayTab === "tournaments"
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>🏸</span>
              <span>Tournaments ({effectiveTournaments.length})</span>
            </button>
          </div>

          {/* Tab 1: Cumulative Standings */}
          {activeDayTab === "standings" && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {/* Highlight Hero Card for Session Leader */}
              {sortedPlayers[0] && (
                <div className="rounded-[28px] p-4 bg-gradient-to-br from-amber-50/90 via-yellow-50/50 to-white border border-amber-200/70 shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-[20px] bg-white border border-amber-200 p-1 flex items-center justify-center relative shadow-xs">
                      <AvatarSVG type={getPlayer(sortedPlayers[0].id).avatar} size={38} />
                      <div className="absolute -top-1 -right-1 text-xs">👑</div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-black tracking-wider text-amber-800">
                        Current Session Leader
                      </p>
                      <p className="text-base font-black text-slate-900 leading-tight">
                        {getPlayer(sortedPlayers[0].id).name}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Rank #1 on Day Table
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-amber-900 tabular-nums">
                      {sortedPlayers[0].pts}
                    </span>
                    <p className="text-[10px] text-amber-700 font-bold">day pts</p>
                  </div>
                </div>
              )}

              {/* Player Standings Accordion Rows */}
              {sortedPlayers.map(({ id, pts, rank }, idx) => {
                const player = getPlayer(id);
                const color = PODIUM_COLORS[idx] ?? "#64748B";
                const isExpanded = expandedPlayerId === id;
                const history = getPlayerTournamentHistory(id);

                return (
                  <motion.div
                    key={id}
                    layout
                    className="rounded-[26px] bg-white border border-slate-200/80 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Row header button */}
                    <button
                      onClick={() => setExpandedPlayerId(isExpanded ? null : id)}
                      className="w-full flex items-center gap-3 p-4 text-left"
                    >
                      {/* Rank badge */}
                      <span
                        className={`w-8 h-8 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 shadow-2xs ${
                          idx === 0
                            ? "bg-amber-100 border border-amber-300 text-amber-900"
                            : idx === 1
                            ? "bg-slate-100 border border-slate-300 text-slate-800"
                            : idx === 2
                            ? "bg-orange-100 border border-orange-300 text-orange-900"
                            : "bg-slate-50 border border-slate-200 text-slate-600"
                        }`}
                      >
                        {RANK_LABELS[idx] ?? `${rank}`}
                      </span>

                      <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200/70 p-1 flex items-center justify-center flex-shrink-0">
                        <AvatarSVG
                          type={player.avatar}
                          size={32}
                          emoji={player.avatarEmoji}
                          color={player.avatarColor}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 font-black text-sm truncate">{player.name}</p>
                        <p className="text-slate-400 text-xs font-medium">
                          {history.length > 0
                            ? `${history.length} tournament${history.length !== 1 ? "s" : ""} played`
                            : "Active today"}
                        </p>
                      </div>

                      <div className="text-right mr-1">
                        <motion.p
                          key={pts}
                          initial={{ scale: 1.2 }}
                          animate={{ scale: 1 }}
                          className="font-black text-2xl tabular-nums leading-none text-slate-900"
                        >
                          {pts}
                        </motion.p>
                        <p className="text-slate-400 text-[10px] font-bold mt-0.5">day pts</p>
                      </div>

                      <motion.span
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-slate-400 text-xs flex-shrink-0"
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
                          className="overflow-hidden border-t border-slate-100 bg-slate-50/50"
                        >
                          <div className="p-4 space-y-2.5">
                            {history.length === 0 ? (
                              <p className="text-slate-400 text-xs text-center py-2 font-medium">
                                {pts > 0 ? `${pts} points awarded from tournament play` : "No matches recorded yet"}
                              </p>
                            ) : (
                              history.map(({ tournament: t, rank: tRank, points: tPts, dayPts, rowIdx }, hIdx) => {
                                const tNum = effectiveTournaments.indexOf(t) + 1;
                                const rankColor = PODIUM_COLORS[rowIdx] ?? "#64748B";
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
                                  <div key={t.id || hIdx} className="bg-white rounded-[20px] border border-slate-200/70 p-3 shadow-xs space-y-2">
                                    {/* Tournament header */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                                          T{tNum}
                                        </span>
                                        <span className="text-xs font-black" style={{ color: rankColor }}>
                                          {RANK_MEDAL[rowIdx] ?? `${tRank}th`}
                                        </span>
                                        <span className="text-slate-700 text-xs font-bold">{tPts} pts</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-slate-400 text-[11px] font-mono">
                                          {wins}W/{playerMatches.filter((m) => m.played).length - wins}L
                                        </span>
                                        <span className="text-emerald-800 bg-emerald-50 border border-emerald-200/60 text-xs font-black px-2 py-0.5 rounded-full">
                                          +{dayPts} day
                                        </span>
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
                                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-colors ${
                                              !m.played
                                                ? "bg-slate-50 text-slate-400"
                                                : won
                                                ? "bg-emerald-50/80 border border-emerald-200/50 text-slate-800"
                                                : "bg-slate-50 border border-slate-200/50 text-slate-700"
                                            }`}
                                          >
                                            <span
                                              className={`font-black px-1.5 py-0.5 rounded-md text-[10px] flex-shrink-0 ${
                                                isFinalMatch
                                                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                                                  : "bg-white text-slate-500 border border-slate-200"
                                              }`}
                                            >
                                              {isFinalMatch ? "🏆 Final" : `R${m.round + 1}`}
                                            </span>
                                            <AvatarSVG
                                              type={opponent.avatar}
                                              size={18}
                                              emoji={opponent.avatarEmoji}
                                              color={opponent.avatarColor}
                                              className="flex-shrink-0"
                                            />
                                            <span className="text-slate-600 font-bold flex-1 truncate">
                                              vs {opponent.name}
                                            </span>
                                            {m.played && myScore !== undefined && oppScore !== undefined ? (
                                              <>
                                                <span
                                                  className={`font-black tabular-nums text-xs ${
                                                    won ? "text-emerald-700" : lost ? "text-slate-400" : "text-slate-700"
                                                  }`}
                                                >
                                                  {myScore}–{oppScore}
                                                </span>
                                                {myPts !== null && (
                                                  <span
                                                    className={`font-black text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                                      myPts > 0
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : myPts < 0
                                                        ? "bg-rose-100 text-rose-800"
                                                        : "bg-slate-100 text-slate-500"
                                                    }`}
                                                  >
                                                    {myPts > 0 ? "+" : ""}
                                                    {myPts}
                                                  </span>
                                                )}
                                              </>
                                            ) : (
                                              <span className="text-slate-300 font-mono">—</span>
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
            </motion.div>
          )}

          {/* Tab 2: Tournament History */}
          {activeDayTab === "tournaments" && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {effectiveTournaments.length === 0 ? (
                <div className="bg-white rounded-[28px] border border-slate-200/80 p-6 text-center shadow-xs">
                  <p className="text-slate-400 text-xs font-medium">No tournaments completed today yet.</p>
                </div>
              ) : (
                effectiveTournaments.map((t: Tournament, tIdx) => {
                  const tTable = computeTournamentTable(t);
                  const isExpanded = expandedTournament === t.id;
                  const tournamentNumber = tIdx + 1;

                  return (
                    <div
                      key={t.id || tIdx}
                      className="rounded-[26px] bg-white border border-slate-200/80 shadow-xs overflow-hidden transition-all"
                    >
                      <button
                        onClick={() => setExpandedTournament(isExpanded ? null : t.id)}
                        className="w-full flex items-center justify-between p-4 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                            #{tournamentNumber}
                          </span>
                          <div>
                            <p className="text-slate-900 font-black text-sm">Tournament {tournamentNumber}</p>
                            <p className="text-slate-400 text-xs font-medium">
                              {t.playerIds.length} players · {t.matches.length} matches
                              {t.final?.played ? " + Final" : ""} · First to {t.config?.winScore ?? 5}
                            </p>
                          </div>
                        </div>
                        <motion.span
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-slate-400 text-xs flex-shrink-0"
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
                            className="overflow-hidden border-t border-slate-100 bg-slate-50/40 p-4 space-y-2.5"
                          >
                            <div className="space-y-1.5">
                              {tTable.map((row, rowIdx) => {
                                const p = getPlayer(row.playerId);
                                const dayPts = t.dayPointsAwarded?.[row.playerId] ?? row.points;
                                return (
                                  <div
                                    key={row.playerId}
                                    className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white border border-slate-200/60 shadow-xs"
                                  >
                                    <span className="text-xs font-black w-6 text-center text-slate-500">
                                      {RANK_MEDAL[rowIdx] ?? `${rowIdx + 1}`}
                                    </span>
                                    <AvatarSVG
                                      type={p.avatar}
                                      size={26}
                                      emoji={p.avatarEmoji}
                                      color={p.avatarColor}
                                    />
                                    <p className="text-slate-900 font-bold text-xs flex-1 truncate">{p.name}</p>
                                    <div className="text-right">
                                      <p className="text-slate-900 font-black text-xs">{row.points} pts</p>
                                      <p className="text-emerald-700 text-[10px] font-bold">+{dayPts} day</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Final result callout */}
                            {t.final?.played && t.final.scoreA !== undefined && t.final.scoreB !== undefined && (
                              <div className="mt-2.5 bg-amber-50 border border-amber-200/80 rounded-[18px] p-3 text-center shadow-xs">
                                <p className="text-amber-900 text-xs font-black flex items-center justify-center gap-1.5">
                                  <span>🏆 Final:</span>
                                  <span>
                                    {getPlayer(t.final.playerA).name} {t.final.scoreA} – {t.final.scoreB}{" "}
                                    {getPlayer(t.final.playerB).name}
                                  </span>
                                </p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* Share Modal for Day */}
      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        date={dayTable.date || new Date().toISOString().split("T")[0]}
        slug={currentTournament?.shareSlug ?? currentTournament?.id}
      />
    </div>
  );
}
