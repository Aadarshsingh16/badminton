"use client";
// app/day/page.tsx — Day Table tab: cumulative standings + per-player tournament history

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, recoverTournamentsFromSyncQueue, getDeletedTournamentIds, normalizePlayerId } from "@/lib/store";
import { AvatarSVG } from "@/components/avatars/AvatarSVG";
import { computeTournamentTable } from "@/lib/ranking";
import { getMatchShortform } from "@/lib/fixtures";
import { Player, Tournament } from "@/lib/types";

import { PinModal } from "@/components/PinModal";
import { ShareModal } from "@/components/ShareModal";
import { apiSync } from "@/lib/apiSync";
import { firestoreSync } from "@/lib/firestoreSync";
import { isFirebaseConfigured } from "@/lib/firebase";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { isViewerMode, getViewerSlug, clearViewerMode } from "@/lib/viewerMode";
import { getBackendUrl } from "@/lib/backend";
import { formatDateDDMMYY } from "@/lib/dateUtils";

const RANK_LABELS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣"];
const PODIUM_COLORS = ["#D97706", "#475569", "#C2410C", "#64748B"];
const RANK_MEDAL = ["🥇", "🥈", "🥉", "4th", "5th", "6th", "7th"];

export default function DayPage() {
  const { players, dayTable, currentTournament, pastTournaments, startNewDay, resetDayTable, appRole, clearAppSession } = useStore();
  const [isViewer, setIsViewer] = useState(false);
  const [viewerSlug, setViewerSlugState] = useState<string | null>(null);

  useEffect(() => {
    setIsViewer(appRole === "viewer" || (isViewerMode() && !currentTournament));
    setViewerSlugState(getViewerSlug());
  }, [appRole, currentTournament]);

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
    totals: Record<string, number>;
    tournaments: any[];
    dayStandings: any[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState<string>("");

  const fetchCloudDay = useCallback(async () => {
    setLoading(true);
    try {
      const backendUrl = getBackendUrl();
      const dateParam = dayTable.date || new Date().toISOString().split("T")[0];
      const res = await fetch(`${backendUrl}/day-tables/${dateParam}`);
      if (res.ok) {
        const json = await res.json();
        setCloudDayData({
          totals: json.totals || {},
          tournaments: json.tournaments || [],
          dayStandings: json.dayStandings || [],
        });
      }
    } catch (err) {
      console.warn("Failed to fetch cloud day data:", err);
    } finally {
      setLoading(false);
    }
  }, [dayTable.date]);

  useEffect(() => {
    fetchCloudDay();
  }, [currentTournament, fetchCloudDay]);

  const getPlayer = (id: string): Player => {
    const targetId = normalizePlayerId(id);
    return players.find((p) => p.id === targetId || p.id === id) ?? { id, name: id, avatar: "custom" as any };
  };

  // Combine past tournaments + recovered tournaments + cloud fallback tournaments for the current day
  const effectiveTournaments = useMemo<Tournament[]>(() => {
    const deletedIds = getDeletedTournamentIds();
    const currentDate = dayTable.date || new Date().toISOString().split("T")[0];
    let list = pastTournaments.filter(
      (t) =>
        !deletedIds.has(t.id) &&
        (dayTable.tournaments.includes(t.id) ||
          (t.date || (t.createdAt && new Date(t.createdAt).toISOString().split("T")[0])) === currentDate)
    );
    if (list.length === 0) {
      const rec = recoverTournamentsFromSyncQueue();
      if (rec.length > 0) {
        list = rec.filter(
          (t) =>
            !deletedIds.has(t.id) &&
            (dayTable.tournaments.includes(t.id) ||
              (t.date || (t.createdAt && new Date(t.createdAt).toISOString().split("T")[0])) === currentDate)
        );
      }
    }

    if (list.length === 0 && cloudDayData?.tournaments && cloudDayData.tournaments.length > 0) {
      const validCloudTourneys = cloudDayData.tournaments.filter(
        (ct: any) => ct.status !== "cancelled" && !deletedIds.has(ct.id || ct.tournamentId)
      );
      return validCloudTourneys.map((ct: any) => {
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
          id: ct.id || ct.tournamentId,
          shareSlug: ct.shareSlug,
          playerIds: pIds,
          matches: rrMatches,
          final: finalMatch,
          config: ct.config || { winScore: 5, bonusMargin: 4, matchBonusPoints: 1, shutoutBonusPoints: 1, finalBonusPoints: 2 },
          isPractice: false,
          dayPointsAwarded: {},
          byes: {},
          closed: true,
          createdAt: ct.createdAt || new Date().toISOString(),
        } as unknown as Tournament;
      });
    }

    return list;
  }, [pastTournaments, dayTable.tournaments, dayTable.date, cloudDayData]);

  // Helper to get tiebreak stats (wins, pointDiff) across effectiveTournaments
  const playerDayStats = useMemo(() => {
    const stats: Record<string, { wins: number; pointDiff: number }> = {};
    for (const t of effectiveTournaments) {
      const allMatches = [...(t.matches || [])];
      if (t.final && t.final.played) allMatches.push(t.final);
      for (const m of allMatches) {
        if (!m.played || m.scoreA === undefined || m.scoreB === undefined) continue;
        const pA = normalizePlayerId(m.playerA);
        const pB = normalizePlayerId(m.playerB);
        if (!stats[pA]) stats[pA] = { wins: 0, pointDiff: 0 };
        if (!stats[pB]) stats[pB] = { wins: 0, pointDiff: 0 };
        stats[pA].pointDiff += m.scoreA - m.scoreB;
        stats[pB].pointDiff += m.scoreB - m.scoreA;
        if (m.scoreA > m.scoreB) stats[pA].wins += 1;
        if (m.scoreB > m.scoreA) stats[pB].wins += 1;
      }
    }
    return stats;
  }, [effectiveTournaments]);

  // Sort players by cumulative day points with standard sports tiebreakers (wins, pointDiff)
  const sortedPlayers = useMemo(() => {
    const tiebreakCompare = (idA: string, ptsA: number, idB: string, ptsB: number) => {
      if (ptsB !== ptsA) return ptsB - ptsA;
      const sA = playerDayStats[idA] || { wins: 0, pointDiff: 0 };
      const sB = playerDayStats[idB] || { wins: 0, pointDiff: 0 };
      if (sB.wins !== sA.wins) return sB.wins - sA.wins;
      return sB.pointDiff - sA.pointDiff;
    };

    // 1. Authoritative source for scorekeeper: if local effectiveTournaments exist,
    // compute totals directly from them so the Day Table strictly matches the Tournaments tab.
    if (effectiveTournaments.length > 0) {
      const computedTotals: { [playerId: string]: number } = {};
      for (const t of effectiveTournaments) {
        const tTable = computeTournamentTable(t);
        const ptsMap = t.dayPointsAwarded || {};
        tTable.forEach((row, rowIdx) => {
          const targetId = normalizePlayerId(row.playerId);
          const pts = ptsMap[row.playerId] ?? ptsMap[targetId] ?? row.dayPoints ?? Math.max(1, tTable.length - rowIdx);
          computedTotals[targetId] = (computedTotals[targetId] ?? 0) + pts;
        });
      }
      return Object.entries(computedTotals)
        .sort(([idA, a], [idB, b]) => tiebreakCompare(idA, a, idB, b))
        .map(([id, pts], idx) => ({ id, pts, rank: idx + 1 }));
    }

    // 2. Viewer / Remote fallback: If no local tournaments on this device (e.g. spectator view), use backend cloud totals
    const backendTotals = cloudDayData?.totals || {};
    if (Object.keys(backendTotals).length > 0) {
      const merged: Record<string, number> = {};
      for (const [id, pts] of Object.entries(backendTotals)) {
        const targetId = normalizePlayerId(id);
        merged[targetId] = (merged[targetId] || 0) + (pts as number);
      }
      return Object.entries(merged)
        .sort(([idA, a], [idB, b]) => tiebreakCompare(idA, a as number, idB, b as number))
        .map(([id, pts], idx) => ({ id, pts: pts as number, rank: idx + 1 }));
    }

    // 3. Absolute fallback to persisted day table state
    if (Object.keys(dayTable.totals).length > 0) {
      const merged: Record<string, number> = {};
      for (const [id, pts] of Object.entries(dayTable.totals)) {
        const targetId = normalizePlayerId(id);
        merged[targetId] = (merged[targetId] || 0) + pts;
      }
      return Object.entries(merged)
        .sort(([idA, a], [idB, b]) => tiebreakCompare(idA, a, idB, b))
        .map(([id, pts], idx) => ({ id, pts, rank: idx + 1 }));
    }

    return [];
  }, [effectiveTournaments, dayTable.totals, cloudDayData, playerDayStats]);

  // Manual sync triggered by scorekeeper to push all local tournaments & Day Table to cloud
  const handleManualSyncToCloud = async () => {
    if (effectiveTournaments.length === 0) return;
    setSyncState("syncing");
    setSyncMessage("Syncing tournaments and day table to spectators...");

    const computedTotals: { [playerId: string]: number } = {};
    for (const t of effectiveTournaments) {
      const tTable = computeTournamentTable(t);
      const ptsMap = t.dayPointsAwarded || {};
      tTable.forEach((row, rowIdx) => {
        const targetId = normalizePlayerId(row.playerId);
        const pts = ptsMap[row.playerId] ?? ptsMap[targetId] ?? row.dayPoints ?? Math.max(1, tTable.length - rowIdx);
        computedTotals[targetId] = (computedTotals[targetId] ?? 0) + pts;
      });
    }

    const tourneyDate = effectiveTournaments[0]?.date ||
      (effectiveTournaments[0]?.createdAt
        ? new Date(effectiveTournaments[0].createdAt).toISOString().split("T")[0]
        : null);
    const targetDate = tourneyDate || dayTable.date || new Date().toISOString().split("T")[0];
    const success = await apiSync.syncFullDaySession(targetDate, computedTotals, effectiveTournaments, players);

    if (success) {
      setSyncState("success");
      setSyncMessage("All tournaments & Day Table synced to spectators! ✓");
      await fetchCloudDay();
      setTimeout(() => {
        setSyncState("idle");
        setSyncMessage("");
      }, 4000);
    } else {
      setSyncState("error");
      setSyncMessage("Sync failed. Check connection & retry.");
      setTimeout(() => {
        setSyncState("idle");
      }, 5000);
    }
  };

  const handleExportBackup = () => {
    try {
      const data = firestoreSync.exportAllLocalData();
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `badminton-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSyncState("success");
      setSyncMessage(`Backup exported (${data.tournaments.length} tournaments)! ✓`);
      setTimeout(() => {
        setSyncState("idle");
        setSyncMessage("");
      }, 4000);
    } catch (err: any) {
      setSyncState("error");
      setSyncMessage("Export failed: " + (err.message || "Unknown error"));
    }
  };

  const handleUploadAllToFirebase = async () => {
    setSyncState("syncing");
    setSyncMessage("Pushing all local tournaments & days to Firebase...");
    const res = await firestoreSync.uploadAllLocalDataToFirestore();
    if (res.success) {
      setSyncState("success");
      setSyncMessage(`Uploaded ${res.count} tournaments to Firebase! ✓`);
      await fetchCloudDay();
      setTimeout(() => {
        setSyncState("idle");
        setSyncMessage("");
      }, 5000);
    } else {
      setSyncState("error");
      setSyncMessage(res.error || "Firebase upload failed");
      setTimeout(() => {
        setSyncState("idle");
      }, 6000);
    }
  };

  // Self-healing: If scorekeeper has complete effectiveTournaments but cloud day data has stale or mismatched totals,
  // sync the true computed totals and all tournaments atomically to the cloud.
  useEffect(() => {
    if (effectiveTournaments.length > 0 && !isViewer) {
      const computedTotals: { [playerId: string]: number } = {};
      for (const t of effectiveTournaments) {
        const tTable = computeTournamentTable(t);
        const ptsMap = t.dayPointsAwarded || {};
        tTable.forEach((row, rowIdx) => {
          const targetId = normalizePlayerId(row.playerId);
          const pts = ptsMap[row.playerId] ?? ptsMap[targetId] ?? row.dayPoints ?? Math.max(1, tTable.length - rowIdx);
          computedTotals[targetId] = (computedTotals[targetId] ?? 0) + pts;
        });
      }

      const backendTotals = cloudDayData?.totals || {};
      const cloudTourneysCount = cloudDayData?.tournaments?.length ?? 0;
      const isMismatch =
        !cloudDayData ||
        cloudTourneysCount < effectiveTournaments.length ||
        Object.keys(computedTotals).some((id) => (backendTotals[id] ?? 0) !== computedTotals[id]) ||
        Object.keys(computedTotals).length !== Object.keys(backendTotals).length;

      if (isMismatch && Object.keys(computedTotals).length > 0) {
        const tourneyDate = effectiveTournaments[0]?.date ||
          (effectiveTournaments[0]?.createdAt
            ? new Date(effectiveTournaments[0].createdAt).toISOString().split("T")[0]
            : null);
        const targetDate = tourneyDate || dayTable.date || new Date().toISOString().split("T")[0];
        apiSync.syncFullDaySession(targetDate, computedTotals, effectiveTournaments, players).then((ok) => {
          if (ok) {
            fetchCloudDay();
          }
        });
      }
    }
  }, [effectiveTournaments, cloudDayData, isViewer, dayTable.date, players, fetchCloudDay]);

  const hasTournaments = effectiveTournaments.length > 0;
  const hasData = sortedPlayers.length > 0;

  const handleFinishDay = () => {
    if (!apiSync.hasPin()) {
      setPinAction("finish");
      setShowPinModal(true);
      return;
    }

    const effectiveTotals = Object.fromEntries(sortedPlayers.map(p => [p.id, p.pts]));

    // Close day table on backend and crown champions
    apiSync.enqueue("/day-tables/close", "POST", {
      date: dayTable.date,
      totals: effectiveTotals,
    });

    setShowConfetti(true);
    setShowFinishDayModal(false);
    startNewDay(effectiveTotals, effectiveTournaments.map(t => t.id));
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
    const targetNorm = normalizePlayerId(playerId);
    return effectiveTournaments
      .map((t) => {
        const tTable = computeTournamentTable(t);
        const rowIdx = tTable.findIndex((r) => normalizePlayerId(r.playerId) === targetNorm);
        if (rowIdx === -1) return null;
        const row = tTable[rowIdx];
        const dayPts = t.dayPointsAwarded?.[playerId] ?? t.dayPointsAwarded?.[row.playerId] ?? row.dayPoints ?? Math.max(1, tTable.length - rowIdx);
        return { tournament: t, rank: rowIdx + 1, points: row.points, dayPts, rowIdx };
      })
      .filter(Boolean) as { tournament: Tournament; rank: number; points: number; dayPts: number; rowIdx: number }[];
  };

  return (
    <div className="min-h-full bg-[#14161B] text-[#F3F4EE] pb-32">
      <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Spectator Mode Banner */}
      {isViewer && (
        <div className="bg-[#1E2128] border border-white/10 rounded-2xl px-4 py-2.5 mx-4 mt-3 flex items-center justify-between text-xs text-[#F3F4EE] shadow-sm">
          <span className="font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#9EC9A8] animate-pulse" />
            Spectator Mode · Day Table Standings
          </span>
          {viewerSlug && (
            <Link
              href={`/live/${viewerSlug}`}
              className="text-[#14161B] bg-[#9EC9A8] hover:bg-[#8bb794] px-3 py-1 rounded-full font-black uppercase tracking-wider text-[10px] flex items-center gap-1 shadow-xs transition-colors"
            >
              <span>🏸 Live Court ↗</span>
            </Link>
          )}
        </div>
      )}

      {/* Top Header */}
      <div className="px-5 pt-6 pb-3 border-b border-white/10 bg-[#14161B]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <h1 className="text-[#F3F4EE] font-black text-2xl uppercase tracking-tight">Day Table</h1>
            </div>
            <p className="text-[#8E95A5] text-[10px] font-bold uppercase tracking-wider mt-0.5">
              {formatDateDDMMYY(dayTable.date || new Date().toISOString().split("T")[0])} · {effectiveTournaments.length} tournament
              {effectiveTournaments.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isViewer && (
              <button
                onClick={handleExportBackup}
                title="Download JSON backup of all tournaments & days from device"
                className="px-2.5 py-1.5 rounded-full bg-[#1E2128] hover:bg-[#252932] text-[#8E95A5] hover:text-[#F3F4EE] border border-white/10 transition-all active:scale-95 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-xs"
              >
                <span>💾</span>
                <span>Backup</span>
              </button>
            )}
            {!isViewer && isFirebaseConfigured() && (
              <button
                onClick={handleUploadAllToFirebase}
                title="Upload all tournaments & days to Firebase Firestore"
                className="px-2.5 py-1.5 rounded-full bg-[#FF5E48]/20 hover:bg-[#FF5E48]/30 text-[#FF5E48] border border-[#FF5E48]/30 transition-all active:scale-95 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-xs"
              >
                <span>🔥</span>
                <span>Push to Firebase</span>
              </button>
            )}
            {!isViewer && hasTournaments && (
              <button
                onClick={handleManualSyncToCloud}
                disabled={syncState === "syncing"}
                title="Sync all tournaments, matches and standings to Spectators"
                className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs ${
                  syncState === "success"
                    ? "bg-[#9EC9A8]/20 text-[#9EC9A8] border-[#9EC9A8]/40"
                    : syncState === "syncing"
                    ? "bg-[#F5BA38]/20 text-[#F5BA38] border-[#F5BA38]/40 animate-pulse"
                    : syncState === "error"
                    ? "bg-[#FF5E48]/20 text-[#FF5E48] border-[#FF5E48]/40"
                    : "bg-[#1E2128] hover:bg-[#252932] text-[#9EC9A8] border-[#9EC9A8]/30"
                }`}
              >
                <span>{syncState === "syncing" ? "⏳" : syncState === "success" ? "✅" : syncState === "error" ? "⚠️" : "☁️"}</span>
                <span>
                  {syncState === "syncing"
                    ? "Syncing..."
                    : syncState === "success"
                    ? "Synced ✓"
                    : syncState === "error"
                    ? "Retry Sync"
                    : "Sync Cloud"}
                </span>
              </button>
            )}
            {appRole === "admin" && (
              <button
                onClick={() => {
                  clearAppSession();
                  clearViewerMode();
                }}
                title="Logout from Admin"
                className="px-2.5 py-1.5 rounded-full bg-[#1E2128] hover:bg-[#FF5E48]/20 text-[#8E95A5] hover:text-[#FF5E48] border border-white/10 hover:border-[#FF5E48]/30 transition-all active:scale-95 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider cursor-pointer"
              >
                <span>👑</span>
                <span>Logout</span>
              </button>
            )}
            <button
              onClick={() => setShowShareModal(true)}
              title="Share day live stream"
              className="w-8 h-8 rounded-full bg-[#1E2128] hover:bg-[#252932] text-[#F3F4EE] border border-white/10 flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <span className="text-xs">📡</span>
            </button>
            {!isViewer && hasData && (
              <button
                onClick={() => setShowFinishDayModal(true)}
                className="text-xs bg-[#FF5E48] hover:bg-[#fa6249] text-white font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-[0_10px_25px_rgba(255,94,72,0.35)] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>👑</span>
                <span>Finish Day</span>
              </button>
            )}
            {!isViewer && (
              <button
                onClick={() => setShowConfirmReset(true)}
                title="Reset Day"
                className="w-8 h-8 rounded-full bg-[#1E2128] hover:bg-[#FF5E48]/20 text-[#8E95A5] hover:text-[#FF5E48] border border-white/10 hover:border-[#FF5E48]/30 flex items-center justify-center transition-colors shadow-xs cursor-pointer"
              >
                <span className="text-xs">🗑️</span>
              </button>
            )}
          </div>
        </div>

        {syncMessage && (
          <div
            className={`mt-2 py-1 px-3 rounded-lg text-[10px] font-bold text-center transition-all ${
              syncState === "success"
                ? "bg-[#9EC9A8]/15 text-[#9EC9A8] border border-[#9EC9A8]/30"
                : syncState === "error"
                ? "bg-[#FF5E48]/15 text-[#FF5E48] border border-[#FF5E48]/30"
                : "bg-[#F5BA38]/15 text-[#F5BA38] border border-[#F5BA38]/30"
            }`}
          >
            {syncMessage}
          </div>
        )}
      </div>

      {/* Finish Day Celebration Modal */}
      <AnimatePresence>
        {showFinishDayModal && hasData && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40"
              onClick={() => setShowFinishDayModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto bg-[#1E2128] border border-white/15 rounded-[32px] p-6 shadow-2xl space-y-4 text-[#F3F4EE]"
            >
              <div className="text-center space-y-1">
                <div className="w-14 h-14 rounded-full bg-[#F5BA38]/15 border border-[#F5BA38]/30 text-3xl flex items-center justify-center mx-auto mb-2 shadow-xs">
                  👑
                </div>
                <h3 className="text-[#F3F4EE] font-black text-xl uppercase tracking-tight">Crown Day Champions</h3>
                <p className="text-[#8E95A5] text-xs font-semibold uppercase tracking-wider">Session for {formatDateDDMMYY(dayTable.date)}</p>
              </div>

              {/* Honors Preview */}
              <div className="space-y-2 py-1">
                {sortedPlayers[0] && (
                  <div className="p-3.5 rounded-[22px] bg-[#14161B] border border-[#F5BA38]/40 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="text-2xl">👑</div>
                      <div>
                        <p className="text-[9px] uppercase font-black tracking-wider text-[#F5BA38]">
                          Day Champion
                        </p>
                        <p className="text-sm font-black text-[#F3F4EE] uppercase">{getPlayer(sortedPlayers[0].id).name}</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-[#F5BA38] text-[#14161B] font-black text-xs">
                      {sortedPlayers[0].pts} pts
                    </div>
                  </div>
                )}

                {sortedPlayers.length >= 2 && sortedPlayers[sortedPlayers.length - 1] && (
                  <div className="p-3.5 rounded-[22px] bg-[#14161B] border border-[#FF5E48]/40 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="text-2xl">🥄</div>
                      <div>
                        <p className="text-[9px] uppercase font-black tracking-wider text-[#FF5E48]">
                          Wooden Spoon
                        </p>
                        <p className="text-sm font-black text-[#F3F4EE] uppercase">
                          {getPlayer(sortedPlayers[sortedPlayers.length - 1].id).name}
                        </p>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-[#FF5E48] text-white font-black text-xs">
                      {sortedPlayers[sortedPlayers.length - 1].pts} pts
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-[#8E95A5] text-center leading-relaxed font-medium">
                This saves today's champions into the permanent Hall of Fame and starts a fresh day session.
              </p>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFinishDayModal(false)}
                  className="flex-1 py-3 rounded-full bg-[#181B22] border border-white/10 hover:border-white/20 text-[#F3F4EE] font-black text-xs uppercase tracking-wider transition-colors"
                >
                  Keep Playing
                </button>
                <button
                  type="button"
                  onClick={handleFinishDay}
                  className="flex-1 py-3 rounded-full bg-[#FF5E48] hover:bg-[#fa6249] text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all"
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
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40"
              onClick={() => setShowConfirmReset(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-x-5 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto bg-[#1E2128] border border-white/15 rounded-[32px] p-6 text-center shadow-2xl space-y-3 text-[#F3F4EE]"
            >
              <div className="w-14 h-14 rounded-full bg-[#FF5E48]/15 border border-[#FF5E48]/30 text-2xl flex items-center justify-center mx-auto mb-2 text-[#FF5E48] shadow-xs">
                🗑️
              </div>
              <h3 className="text-[#F3F4EE] font-black text-xl uppercase tracking-tight">Reset Day Table?</h3>
              <p className="text-[#8E95A5] text-xs leading-relaxed font-medium">
                This will clear today's table without recording Day Champions. Cannot be undone.
              </p>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmReset(false)}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-full bg-[#181B22] border border-white/10 hover:border-white/20 text-[#F3F4EE] font-black text-xs uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetDay}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-full bg-[#FF5E48] hover:bg-[#fa6249] text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5"
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
          <div className="w-10 h-10 border-2 border-white/10 border-t-[#FF5E48] rounded-full animate-spin" />
          <p className="text-[#8E95A5] text-xs font-semibold uppercase tracking-wider">Loading live session standings...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasData && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
          <div className="w-20 h-20 rounded-[28px] bg-[#1E2128] border border-white/10 flex items-center justify-center text-4xl shadow-sm mb-4">
            🏸
          </div>
          <h3 className="text-[#F3F4EE] font-black text-xl uppercase tracking-tight">No Day Matches Yet</h3>
          <p className="text-[#8E95A5] text-xs mt-1 max-w-xs leading-relaxed font-medium">
            Complete tournament matches to start racking up today&apos;s cumulative points!
          </p>
          <Link
            href="/"
            className="mt-5 px-6 py-3 rounded-full bg-[#FF5E48] text-white font-black text-xs uppercase tracking-wider shadow-[0_10px_25px_rgba(255,94,72,0.35)] hover:bg-[#fa6249] active:scale-95 transition-all flex items-center gap-1.5"
          >
            <span>Start Tournament ↗</span>
          </Link>
        </div>
      )}

      {/* Content when data or tournaments exist */}
      {(hasData || hasTournaments) && (
        <div className="px-5 pt-3">
          {/* Section Segmented Pill Switcher */}
          <div className="flex gap-1.5 p-1 bg-[#181B22] rounded-full border border-white/10 shadow-sm mb-4">
            <button
              onClick={() => setActiveDayTab("standings")}
              className={`flex-1 py-2 px-3 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeDayTab === "standings"
                  ? "bg-[#F3F4EE] text-[#14161B] shadow-sm"
                  : "text-[#8E95A5] hover:text-[#F3F4EE]"
              }`}
            >
              <span>🏆</span>
              <span>Cumulative Standings</span>
            </button>
            <button
              onClick={() => setActiveDayTab("tournaments")}
              className={`flex-1 py-2 px-3 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeDayTab === "tournaments"
                  ? "bg-[#F3F4EE] text-[#14161B] shadow-sm"
                  : "text-[#8E95A5] hover:text-[#F3F4EE]"
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
                <div className="rounded-[28px] p-4 bg-[#1E2128] border border-[#F5BA38]/40 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-[20px] bg-[#14161B] border border-white/10 p-1 flex items-center justify-center relative shadow-xs">
                      <AvatarSVG type={getPlayer(sortedPlayers[0].id).avatar} size={38} />
                      <div className="absolute -top-1 -right-1 text-xs">👑</div>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-black tracking-wider text-[#F5BA38]">
                        Current Session Leader
                      </p>
                      <p className="text-base font-black text-[#F3F4EE] uppercase tracking-tight leading-tight">
                        {getPlayer(sortedPlayers[0].id).name}
                      </p>
                      <p className="text-[10px] text-[#8E95A5] font-bold uppercase tracking-wider">
                        Rank #1 on Day Table
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-[#F5BA38] tabular-nums">
                      {sortedPlayers[0].pts}
                    </span>
                    <p className="text-[9px] text-[#8E95A5] font-black uppercase tracking-wider">day pts</p>
                  </div>
                </div>
              )}

              {/* Player Standings Accordion Rows */}
              {sortedPlayers.map(({ id, pts, rank }, idx) => {
                const player = getPlayer(id);
                const isExpanded = expandedPlayerId === id;
                const history = getPlayerTournamentHistory(id);

                return (
                  <motion.div
                    key={id}
                    layout
                    className="rounded-[26px] bg-[#1E2128] border border-white/10 shadow-sm overflow-hidden transition-all"
                  >
                    {/* Row header button */}
                    <button
                      onClick={() => setExpandedPlayerId(isExpanded ? null : id)}
                      className="w-full flex items-center gap-3 p-4 text-left"
                    >
                      {/* Rank badge */}
                      <span
                        className={`w-8 h-8 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 shadow-xs ${
                          idx === 0
                            ? "bg-[#F5BA38] text-[#14161B]"
                            : idx === 1
                            ? "bg-[#FF5E48] text-white"
                            : idx === 2
                            ? "bg-[#6C79E0] text-white"
                            : "bg-white/10 text-[#8E95A5]"
                        }`}
                      >
                        {idx + 1}
                      </span>

                      <div className="w-10 h-10 rounded-2xl bg-[#14161B] border border-white/10 p-1 flex items-center justify-center flex-shrink-0">
                        <AvatarSVG
                          type={player.avatar}
                          size={32}
                          emoji={player.avatarEmoji}
                          color={player.avatarColor}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[#F3F4EE] font-black text-sm uppercase tracking-tight truncate">{player.name}</p>
                        <p className="text-[#8E95A5] text-[10px] font-bold uppercase tracking-wider">
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
                          className="font-black text-2xl tabular-nums leading-none text-[#F3F4EE]"
                        >
                          {pts}
                        </motion.p>
                        <p className="text-[#8E95A5] text-[9px] font-black uppercase tracking-wider mt-0.5">day pts</p>
                      </div>

                      <motion.span
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-[#8E95A5] text-xs flex-shrink-0"
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
                          className="overflow-hidden border-t border-white/5 bg-[#181B22]"
                        >
                          <div className="p-4 space-y-2.5">
                            {history.length === 0 ? (
                              <p className="text-[#8E95A5] text-xs text-center py-2 font-medium">
                                {pts > 0 ? `${pts} points awarded from tournament play` : "No matches recorded yet"}
                              </p>
                            ) : (
                              history.map(({ tournament: t, rank: tRank, points: tPts, dayPts, rowIdx }, hIdx) => {
                                const tNum = effectiveTournaments.indexOf(t) + 1;
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
                                  <div key={t.id || hIdx} className="bg-[#1E2128] rounded-[20px] border border-white/5 p-3 space-y-2">
                                    {/* Tournament header */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase bg-white/10 text-[#F3F4EE] px-2 py-0.5 rounded-full">
                                          T{tNum}
                                        </span>
                                        <span className="text-xs font-black uppercase text-[#F5BA38]">
                                          Rank #{tRank}
                                        </span>
                                        <span className="text-[#8E95A5] text-xs font-bold">{tPts} pts</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[#8E95A5] text-[11px] font-mono">
                                          {wins}W/{playerMatches.filter((m) => m.played).length - wins}L
                                        </span>
                                        <span className="text-[#9EC9A8] bg-[#9EC9A8]/15 border border-[#9EC9A8]/30 text-xs font-black px-2 py-0.5 rounded-full">
                                          +{dayPts} day
                                        </span>
                                      </div>
                                    </div>

                                    {/* Matches in this tournament */}
                                    <div className="space-y-1">
                                      {playerMatches.map((m) => {
                                        const isDETournament = t.config?.format === "double-elimination" || playerMatches.some((match) => !!(match.bracket || match.bracketRound || match.id.startsWith("de-")));
                                        const isFinalMatch = m.round === -1 || m.isFinal || m.bracketRound === "GF" || m.id === "de-gf";
                                        const matchBadgeText = isDETournament || m.bracketRound || m.id.startsWith("de-")
                                          ? getMatchShortform(m)
                                          : (isFinalMatch ? "🏆 Final" : `R${m.round + 1}`);

                                        const isUpperMatch = matchBadgeText.startsWith("UQ") || matchBadgeText.startsWith("US") || matchBadgeText === "UF";
                                        const isLowerMatch = matchBadgeText.startsWith("LR") || matchBadgeText === "LF";
                                        const isGrandFinal = isFinalMatch || matchBadgeText === "GF";

                                        const badgeStyle = isGrandFinal
                                          ? "bg-[#FF5E48] text-white"
                                          : isUpperMatch
                                          ? "bg-[#9EC9A8]/20 text-[#9EC9A8]"
                                          : isLowerMatch
                                          ? "bg-[#F5BA38]/20 text-[#F5BA38]"
                                          : matchBadgeText.startsWith("P")
                                          ? "bg-blue-500/20 text-blue-300"
                                          : "bg-white/10 text-[#8E95A5]";

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
                                                ? "bg-[#181B22] text-[#8E95A5]"
                                                : won
                                                ? "bg-[#9EC9A8]/10 border border-[#9EC9A8]/20 text-[#F3F4EE]"
                                                : "bg-[#181B22] border border-white/5 text-[#8E95A5]"
                                            }`}
                                          >
                                            <span
                                              className={`font-black uppercase px-1.5 py-0.5 rounded-md text-[9px] flex-shrink-0 tracking-wider ${badgeStyle}`}
                                            >
                                              {matchBadgeText}
                                            </span>
                                            <AvatarSVG
                                              type={opponent.avatar}
                                              size={18}
                                              emoji={opponent.avatarEmoji}
                                              color={opponent.avatarColor}
                                              className="flex-shrink-0"
                                            />
                                            <span className="text-[#F3F4EE] font-bold flex-1 truncate">
                                              vs {opponent.name}
                                            </span>
                                            {m.played && myScore !== undefined && oppScore !== undefined ? (
                                              <>
                                                <span
                                                  className={`font-black tabular-nums text-xs ${
                                                    won ? "text-[#9EC9A8]" : lost ? "text-[#8E95A5]" : "text-[#F3F4EE]"
                                                  }`}
                                                >
                                                  {myScore}–{oppScore}
                                                </span>
                                                {!isDETournament && myPts !== null && (
                                                  <span
                                                    className={`font-black text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                                      myPts > 0
                                                        ? "bg-[#9EC9A8]/15 text-[#9EC9A8]"
                                                        : myPts < 0
                                                        ? "bg-[#FF5E48]/15 text-[#FF5E48]"
                                                        : "bg-white/10 text-[#8E95A5]"
                                                    }`}
                                                  >
                                                    {myPts > 0 ? "+" : ""}
                                                    {myPts}
                                                  </span>
                                                )}
                                              </>
                                            ) : (
                                              <span className="text-[#8E95A5] font-mono">—</span>
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
                <div className="bg-[#1E2128] rounded-[28px] border border-white/10 p-6 text-center shadow-sm">
                  <p className="text-[#8E95A5] text-xs font-medium">No tournaments completed today yet.</p>
                </div>
              ) : (
                effectiveTournaments.map((t: Tournament, tIdx) => {
                  const tTable = computeTournamentTable(t);
                  const isExpanded = expandedTournament === t.id;
                  const tournamentNumber = tIdx + 1;

                  return (
                    <div
                      key={t.id || tIdx}
                      className="rounded-[26px] bg-[#1E2128] border border-white/10 shadow-sm overflow-hidden transition-all"
                    >
                      <button
                        onClick={() => setExpandedTournament(isExpanded ? null : t.id)}
                        className="w-full flex items-center justify-between p-4 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-2xl bg-white/10 text-[#F3F4EE] font-black text-xs flex items-center justify-center flex-shrink-0">
                            #{tournamentNumber}
                          </span>
                          <div>
                            <p className="text-[#F3F4EE] font-black text-sm uppercase tracking-tight">Tournament {tournamentNumber}</p>
                            <p className="text-[#8E95A5] text-[10px] font-bold uppercase tracking-wider">
                              {t.playerIds.length} players · {t.matches.length} matches
                              {t.final?.played ? " + Final" : ""} · First to {t.config?.winScore ?? 5}
                            </p>
                          </div>
                        </div>
                        <motion.span
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-[#8E95A5] text-xs flex-shrink-0"
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
                            className="overflow-hidden border-t border-white/5 bg-[#181B22] p-4 space-y-2.5"
                          >
                            <div className="space-y-1.5">
                              {tTable.map((row, rowIdx) => {
                                const p = getPlayer(row.playerId);
                                const dayPts = t.dayPointsAwarded?.[row.playerId] ?? row.points;
                                return (
                                  <div
                                    key={row.playerId}
                                    className="flex items-center gap-3 py-2 px-3 rounded-xl bg-[#1E2128] border border-white/5"
                                  >
                                    <span className="text-xs font-black w-6 text-center text-[#8E95A5]">
                                      #{rowIdx + 1}
                                    </span>
                                    <AvatarSVG
                                      type={p.avatar}
                                      size={26}
                                      emoji={p.avatarEmoji}
                                      color={p.avatarColor}
                                    />
                                    <p className="text-[#F3F4EE] font-bold text-xs flex-1 truncate">{p.name}</p>
                                    <div className="text-right">
                                      <p className="text-[#F3F4EE] font-black text-xs">{row.points} pts</p>
                                      <p className="text-[#9EC9A8] text-[10px] font-bold">+{dayPts} day</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Final result callout */}
                            {t.final?.played && t.final.scoreA !== undefined && t.final.scoreB !== undefined && (
                              <div className="mt-2.5 bg-[#1E2128] border border-[#F5BA38]/40 rounded-[18px] p-3 text-center shadow-xs">
                                <p className="text-[#F5BA38] text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5">
                                  <span>🏆 Final:</span>
                                  <span className="text-[#F3F4EE]">
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
