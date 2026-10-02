"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  useStore,
  recoverTournamentsFromSyncQueue,
  recoverCompletedDaysFromSyncQueue,
} from "@/lib/store";
import { AvatarSVG } from "@/components/avatars/AvatarSVG";
import { AvatarType } from "@/lib/types";
import { PinModal } from "@/components/PinModal";
import { apiSync } from "@/lib/apiSync";

interface MiniLeaderboardEntry {
  playerId: string;
  name: string;
  points: number;
  matches: number;
  wins: number;
}

interface MatchHistoryItem {
  id: string;
  tournamentId: string;
  round: number;
  isFinal: boolean;
  playerA: string;
  playerB: string;
  playerAName: string;
  playerAAvatar: AvatarType;
  playerAAvatarEmoji?: string;
  playerAAvatarColor?: string;
  playerBName: string;
  playerBAvatar: AvatarType;
  playerBAvatarEmoji?: string;
  playerBAvatarColor?: string;
  scoreA: number;
  scoreB: number;
  pointsA: number;
  pointsB: number;
  played: boolean;
  playedAt?: string;
  shareSlug?: string;
  date: string;
}

interface TournamentGroup {
  tournamentId: string;
  shareSlug?: string;
  matches: MatchHistoryItem[];
}

interface DayGroup {
  date: string;
  tournaments: TournamentGroup[];
}

interface HistoryData {
  totalMatches: number;
  totalPoints: number;
  days: DayGroup[];
  miniLeaderboard: MiniLeaderboardEntry[];
}

interface LeaderboardEntry {
  playerId: string;
  name: string;
  avatar: AvatarType;
  avatarEmoji?: string;
  avatarColor?: string;
  matchesPlayed: number;
  wins: number;
  totalPoints: number;
  pointDiff: number;
  winRate: number;
}

interface DayHonors {
  dayChampions: Array<{
    playerId: string;
    name: string;
    avatar: AvatarType;
    emoji?: string;
    color?: string;
    count: number;
  }>;
  dayLastPlaces: Array<{
    playerId: string;
    name: string;
    avatar: AvatarType;
    emoji?: string;
    color?: string;
    count: number;
  }>;
  history: Array<{
    id: string;
    date: string;
    topPlayerId: string;
    topPlayerName: string;
    topPlayerAvatar: AvatarType;
    topPlayerAvatarEmoji?: string;
    topPlayerAvatarColor?: string;
    bottomPlayerId: string;
    bottomPlayerName: string;
    bottomPlayerAvatar: AvatarType;
    bottomPlayerAvatarEmoji?: string;
    bottomPlayerAvatarColor?: string;
  }>;
}

export default function HistoryPage() {
  const { players, dayTable, currentTournament, pastTournaments, completedDays } = useStore();
  const [activeSubTab, setActiveSubTab] = useState<"log" | "leaderboards">("log");
  const [rangeFilter, setRangeFilter] = useState<"day" | "week" | "month" | "all">("all");
  const [playerFilter, setPlayerFilter] = useState<string>("all");
  const [patternFilter, setPatternFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"points" | "wins" | "matches">("points");

  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [dayHonors, setDayHonors] = useState<DayHonors | null>(null);
  const [expandedTournaments, setExpandedTournaments] = useState<{ [tId: string]: boolean }>({});
  const [tournamentToDelete, setTournamentToDelete] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const handleDeleteTournament = async (tId: string) => {
    if (!apiSync.hasPin()) {
      setShowPinModal(true);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`${backendUrl}/tournaments/${tId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-scorekeeper-pin": apiSync.getPin(),
        },
      });

      if (res.ok || res.status === 404) {
        useStore.getState().deleteTournament(tId);
        setTournamentToDelete(null);
        await Promise.all([fetchHistory(), fetchLeaderboards()]);
      } else if (res.status === 401) {
        setShowPinModal(true);
      }
    } catch (e) {
      console.warn("Failed to delete tournament on backend, deleting locally:", e);
      useStore.getState().deleteTournament(tId);
      setTournamentToDelete(null);
      await fetchHistory();
    } finally {
      setIsDeleting(false);
    }
  };

  // Fetch History data for Log tab
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (rangeFilter !== "all") params.append("range", rangeFilter);
      if (playerFilter !== "all") params.append("playerId", playerFilter);
      if (patternFilter !== "all") params.append("scorePattern", patternFilter);

      const res = await fetch(`${backendUrl}/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
        if (data.days?.[0]?.tournaments?.[0]) {
          setExpandedTournaments((prev) => ({
            ...prev,
            [data.days[0].tournaments[0].tournamentId]: true,
          }));
        }
      }
    } catch (err) {
      console.warn("Failed to fetch /history from backend, fallback to local store:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Leaderboard data
  const fetchLeaderboards = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (rangeFilter !== "all") params.append("range", rangeFilter);
      params.append("sortBy", sortBy);

      const [resLb, resDays] = await Promise.all([
        fetch(`${backendUrl}/leaderboard?${params.toString()}`),
        fetch(`${backendUrl}/day-results`),
      ]);

      if (resLb.ok) {
        const lb = await resLb.json();
        setLeaderboardData(lb);
      }
      if (resDays.ok) {
        const dh = await resDays.json();
        setDayHonors(dh);
      }
    } catch (err) {
      console.warn("Failed to fetch /leaderboard from backend:", err);
    } finally {
      setLoading(false);
    }
  };

  // Automatic data recovery if pastTournaments or completedDays was lost from state
  useEffect(() => {
    if (pastTournaments.length === 0) {
      const recovered = recoverTournamentsFromSyncQueue();
      if (recovered.length > 0) {
        useStore.setState({ pastTournaments: recovered });
      }
    }
    if (!completedDays || completedDays.length === 0) {
      const recoveredDays = recoverCompletedDaysFromSyncQueue();
      if (recoveredDays.length > 0) {
        useStore.setState({ completedDays: recoveredDays });
      }
    }
  }, [pastTournaments.length, completedDays?.length]);

  useEffect(() => {
    if (activeSubTab === "log") {
      fetchHistory();
    } else {
      fetchLeaderboards();
    }
  }, [activeSubTab, rangeFilter, playerFilter, patternFilter, sortBy]);

  // Local fallback synthesis if backend returned no records or offline
  const localHistoryFallback = useMemo<HistoryData>(() => {
    let allTourneys = [...pastTournaments];
    if (allTourneys.length === 0) {
      const rec = recoverTournamentsFromSyncQueue();
      if (rec.length > 0) allTourneys = rec;
    }
    if (currentTournament) {
      allTourneys.push(currentTournament);
    }

    if (allTourneys.length === 0) {
      return { totalMatches: 0, totalPoints: 0, days: [], miniLeaderboard: [] };
    }

    const allMatches: MatchHistoryItem[] = [];
    const daysMap: { [dateStr: string]: TournamentGroup[] } = {};

    allTourneys.forEach((t) => {
      const tourneyMatches: MatchHistoryItem[] = [];
      const tourneyDate = t.createdAt
        ? new Date(t.createdAt).toISOString().split("T")[0]
        : dayTable.date;

      t.matches
        .filter((m) => m.played)
        .forEach((m) => {
          const pa = players.find((p) => p.id === m.playerA);
          const pb = players.find((p) => p.id === m.playerB);
          const item: MatchHistoryItem = {
            id: m.id,
            tournamentId: t.id,
            round: m.round,
            isFinal: !!m.isFinal,
            playerA: m.playerA,
            playerB: m.playerB,
            playerAName: pa?.name || m.playerA,
            playerAAvatar: pa?.avatar || "clumsy",
            playerAAvatarEmoji: pa?.avatarEmoji,
            playerAAvatarColor: pa?.avatarColor,
            playerBName: pb?.name || m.playerB,
            playerBAvatar: pb?.avatar || "fighter",
            playerBAvatarEmoji: pb?.avatarEmoji,
            playerBAvatarColor: pb?.avatarColor,
            scoreA: m.scoreA ?? 0,
            scoreB: m.scoreB ?? 0,
            pointsA: m.pointsAwarded?.[m.playerA] ?? 0,
            pointsB: m.pointsAwarded?.[m.playerB] ?? 0,
            played: true,
            shareSlug: t.shareSlug,
            date: tourneyDate,
          };
          tourneyMatches.push(item);
          allMatches.push(item);
        });

      if (t.final && t.final.played) {
        const m = t.final;
        const pa = players.find((p) => p.id === m.playerA);
        const pb = players.find((p) => p.id === m.playerB);
        const item: MatchHistoryItem = {
          id: m.id,
          tournamentId: t.id,
          round: m.round,
          isFinal: true,
          playerA: m.playerA,
          playerB: m.playerB,
          playerAName: pa?.name || m.playerA,
          playerAAvatar: pa?.avatar || "clumsy",
          playerAAvatarEmoji: pa?.avatarEmoji,
          playerAAvatarColor: pa?.avatarColor,
          playerBName: pb?.name || m.playerB,
          playerBAvatar: pb?.avatar || "fighter",
          playerBAvatarEmoji: pb?.avatarEmoji,
          playerBAvatarColor: pb?.avatarColor,
          scoreA: m.scoreA ?? 0,
          scoreB: m.scoreB ?? 0,
          pointsA: m.pointsAwarded?.[m.playerA] ?? 0,
          pointsB: m.pointsAwarded?.[m.playerB] ?? 0,
          played: true,
          shareSlug: t.shareSlug,
          date: tourneyDate,
        };
        tourneyMatches.push(item);
        allMatches.push(item);
      }

      // Filter matches within tournament if filters are set
      let filteredTourneyMatches = tourneyMatches;
      if (playerFilter !== "all") {
        filteredTourneyMatches = filteredTourneyMatches.filter(
          (m) => m.playerA === playerFilter || m.playerB === playerFilter
        );
      }
      if (patternFilter !== "all") {
        if (patternFilter === "blowout") {
          filteredTourneyMatches = filteredTourneyMatches.filter(
            (m) => Math.abs(m.scoreA - m.scoreB) >= 4
          );
        } else if (patternFilter.includes("-")) {
          const [s1, s2] = patternFilter.split("-").map((s) => parseInt(s.trim(), 10));
          filteredTourneyMatches = filteredTourneyMatches.filter(
            (m) => (m.scoreA === s1 && m.scoreB === s2) || (m.scoreA === s2 && m.scoreB === s1)
          );
        }
      }

      if (filteredTourneyMatches.length > 0 || (playerFilter === "all" && patternFilter === "all")) {
        if (!daysMap[tourneyDate]) {
          daysMap[tourneyDate] = [];
        }
        daysMap[tourneyDate].push({
          tournamentId: t.id,
          shareSlug: t.shareSlug,
          matches: filteredTourneyMatches,
        });
      }
    });

    let displayMatches = allMatches;
    if (playerFilter !== "all") {
      displayMatches = displayMatches.filter(
        (m) => m.playerA === playerFilter || m.playerB === playerFilter
      );
    }
    if (patternFilter !== "all") {
      if (patternFilter === "blowout") {
        displayMatches = displayMatches.filter((m) => Math.abs(m.scoreA - m.scoreB) >= 4);
      } else if (patternFilter.includes("-")) {
        const [s1, s2] = patternFilter.split("-").map((s) => parseInt(s.trim(), 10));
        displayMatches = displayMatches.filter(
          (m) => (m.scoreA === s1 && m.scoreB === s2) || (m.scoreA === s2 && m.scoreB === s1)
        );
      }
    }

    const days: DayGroup[] = Object.entries(daysMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, tournaments]) => ({ date, tournaments }));

    const miniLeaderboard = players
      .map((p) => {
        let points = 0;
        allTourneys.forEach((t) => {
          if (t.dayPointsAwarded && t.dayPointsAwarded[p.id] !== undefined) {
            points += t.dayPointsAwarded[p.id];
          } else {
            t.matches.filter((m) => m.played).forEach((m) => {
              points += m.pointsAwarded?.[p.id] || 0;
            });
            if (t.final?.played) {
              points += t.final.pointsAwarded?.[p.id] || 0;
            }
          }
        });
        if (points === 0 && dayTable.totals[p.id]) {
          points = dayTable.totals[p.id];
        }

        const pMatches = allMatches.filter((m) => m.playerA === p.id || m.playerB === p.id);
        const wins = pMatches.filter(
          (m) =>
            (m.playerA === p.id && m.scoreA > m.scoreB) ||
            (m.playerB === p.id && m.scoreB > m.scoreA)
        ).length;

        return {
          playerId: p.id,
          name: p.name,
          points,
          matches: pMatches.length,
          wins,
        };
      })
      .filter((p) => p.matches > 0 || p.points > 0)
      .sort((a, b) => b.points - a.points);

    return {
      totalMatches: displayMatches.length,
      totalPoints: displayMatches.reduce((acc, m) => acc + m.pointsA + m.pointsB, 0),
      days,
      miniLeaderboard,
    };
  }, [currentTournament, pastTournaments, dayTable, players, playerFilter, patternFilter]);

  // Local fallback synthesis for Leaderboards if backend has no records yet
  const localLeaderboardFallback = useMemo<LeaderboardEntry[]>(() => {
    let allTourneys = [...pastTournaments];
    if (allTourneys.length === 0) {
      const rec = recoverTournamentsFromSyncQueue();
      if (rec.length > 0) allTourneys = rec;
    }
    if (currentTournament) allTourneys.push(currentTournament);

    const allMatches: Array<{
      playerA: string;
      playerB: string;
      scoreA: number;
      scoreB: number;
      played: boolean;
    }> = [];

    allTourneys.forEach((t) => {
      t.matches.filter((m) => m.played).forEach((m) => {
        allMatches.push({
          playerA: m.playerA,
          playerB: m.playerB,
          scoreA: m.scoreA ?? 0,
          scoreB: m.scoreB ?? 0,
          played: true,
        });
      });
      if (t.final && t.final.played) {
        allMatches.push({
          playerA: t.final.playerA,
          playerB: t.final.playerB,
          scoreA: t.final.scoreA ?? 0,
          scoreB: t.final.scoreB ?? 0,
          played: true,
        });
      }
    });

    const entries: LeaderboardEntry[] = players.map((p) => {
      const pMatches = allMatches.filter((m) => m.playerA === p.id || m.playerB === p.id);
      const wins = allMatches.filter(
        (m) =>
          (m.playerA === p.id && m.scoreA > m.scoreB) ||
          (m.playerB === p.id && m.scoreB > m.scoreA)
      ).length;

      let totalPoints = 0;
      allTourneys.forEach((t) => {
        if (t.dayPointsAwarded && t.dayPointsAwarded[p.id] !== undefined) {
          totalPoints += t.dayPointsAwarded[p.id];
        } else {
          t.matches.filter((m) => m.played).forEach((m) => {
            totalPoints += m.pointsAwarded?.[p.id] || 0;
          });
          if (t.final?.played) {
            totalPoints += t.final.pointsAwarded?.[p.id] || 0;
          }
        }
      });
      if (totalPoints === 0 && dayTable.totals[p.id]) {
        totalPoints = dayTable.totals[p.id];
      }

      let pointDiff = 0;
      pMatches.forEach((m) => {
        if (m.playerA === p.id) pointDiff += m.scoreA - m.scoreB;
        else pointDiff += m.scoreB - m.scoreA;
      });
      const matchesPlayed = pMatches.length;
      const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 1000) / 10 : 0;

      return {
        playerId: p.id,
        name: p.name,
        avatar: p.avatar,
        avatarEmoji: p.avatarEmoji,
        avatarColor: p.avatarColor,
        matchesPlayed,
        wins,
        totalPoints,
        pointDiff,
        winRate,
      };
    }).filter((p) => p.matchesPlayed > 0 || p.totalPoints > 0);

    if (sortBy === "matches") {
      entries.sort((a, b) => b.matchesPlayed - a.matchesPlayed || b.totalPoints - a.totalPoints);
    } else if (sortBy === "wins") {
      entries.sort((a, b) => b.wins - a.wins || b.totalPoints - a.totalPoints);
    } else {
      entries.sort((a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins || b.pointDiff - a.pointDiff);
    }

    return entries;
  }, [pastTournaments, currentTournament, dayTable, players, sortBy]);

  // Local fallback synthesis for Day Honors (Champion & Wooden Spoon)
  const localDayHonorsFallback = useMemo<DayHonors>(() => {
    let allCompletedDays = completedDays && completedDays.length > 0 ? [...completedDays] : [];
    if (allCompletedDays.length === 0) {
      allCompletedDays = recoverCompletedDaysFromSyncQueue();
    }

    const champCounts: { [pid: string]: number } = {};
    const spoonCounts: { [pid: string]: number } = {};
    const historyItems: DayHonors["history"] = [];

    // Active session day totals if session has played tournaments
    const activeTotals = Object.entries(dayTable.totals).sort(([, a], [, b]) => b - a);
    if (activeTotals.length >= 2 && !allCompletedDays.some((d) => d.date === dayTable.date)) {
      const topId = activeTotals[0][0];
      const botId = activeTotals[activeTotals.length - 1][0];
      champCounts[topId] = (champCounts[topId] || 0) + 1;
      spoonCounts[botId] = (spoonCounts[botId] || 0) + 1;
    }

    allCompletedDays.forEach((cd, idx) => {
      const topP = players.find((p) => p.id === cd.topPlayerId);
      const botP = players.find((p) => p.id === cd.spoonPlayerId);
      if (cd.topPlayerId) champCounts[cd.topPlayerId] = (champCounts[cd.topPlayerId] || 0) + 1;
      if (cd.spoonPlayerId) spoonCounts[cd.spoonPlayerId] = (spoonCounts[cd.spoonPlayerId] || 0) + 1;

      if (topP && botP) {
        historyItems.push({
          id: `day-${cd.date}-${idx}`,
          date: cd.date,
          topPlayerId: topP.id,
          topPlayerName: topP.name,
          topPlayerAvatar: topP.avatar,
          topPlayerAvatarEmoji: topP.avatarEmoji,
          topPlayerAvatarColor: topP.avatarColor,
          bottomPlayerId: botP.id,
          bottomPlayerName: botP.name,
          bottomPlayerAvatar: botP.avatar,
          bottomPlayerAvatarEmoji: botP.avatarEmoji,
          bottomPlayerAvatarColor: botP.avatarColor,
        });
      }
    });

    const dayChampions = Object.entries(champCounts)
      .map(([pid, count]) => {
        const p = players.find((pl) => pl.id === pid);
        return {
          playerId: pid,
          name: p?.name || pid,
          avatar: p?.avatar || "fighter",
          emoji: p?.avatarEmoji,
          color: p?.avatarColor,
          count,
        };
      })
      .sort((a, b) => b.count - a.count);

    const dayLastPlaces = Object.entries(spoonCounts)
      .map(([pid, count]) => {
        const p = players.find((pl) => pl.id === pid);
        return {
          playerId: pid,
          name: p?.name || pid,
          avatar: p?.avatar || "clumsy",
          emoji: p?.avatarEmoji,
          color: p?.avatarColor,
          count,
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      dayChampions,
      dayLastPlaces,
      history: historyItems,
    };
  }, [completedDays, dayTable.totals, dayTable.date, players]);

  const displayedHistory =
    historyData && historyData.days.length > 0 ? historyData : localHistoryFallback;

  const displayedLeaderboard =
    leaderboardData && leaderboardData.length > 0 ? leaderboardData : localLeaderboardFallback;

  const displayedDayHonors =
    dayHonors && (dayHonors.dayChampions?.length > 0 || dayHonors.dayLastPlaces?.length > 0)
      ? dayHonors
      : localDayHonorsFallback;

  const toggleTournament = (id: string) => {
    setExpandedTournaments((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 selection:bg-purple-500 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 8v4l3 3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white leading-tight">
                History & Stats
              </h1>
              <p className="text-[11px] text-gray-400">Match logs, standings & day honors</p>
            </div>
          </div>

          <button
            onClick={() => {
              if (activeSubTab === "log") fetchHistory();
              else fetchLeaderboards();
            }}
            disabled={loading}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all text-xs flex items-center gap-1.5"
            title="Refresh"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-400" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 00-9-9 9.75 9.75 0 00-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 009 9 9.75 9.75 0 006.74-2.74L21 16" />
              <path d="M21 21v-5h-5" />
            </svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Sub-tab segmented control */}
        <div className="max-w-lg mx-auto mt-3">
          <div className="grid grid-cols-2 p-1 bg-slate-950/60 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveSubTab("log")}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeSubTab === "log"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              📜 Match Log
            </button>
            <button
              onClick={() => setActiveSubTab("leaderboards")}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeSubTab === "leaderboards"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              🏆 Leaderboards & Honors
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Date Range Selector Pills */}
        <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {(
            [
              { key: "all", label: "All Time" },
              { key: "month", label: "30 Days" },
              { key: "week", label: "7 Days" },
              { key: "day", label: "Today" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => setRangeFilter(item.key)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                rangeFilter === item.key
                  ? "bg-purple-500/20 border-purple-500/60 text-purple-300 shadow-sm shadow-purple-500/10"
                  : "bg-slate-900 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* SUB-TAB 1: MATCH LOG */}
        {activeSubTab === "log" && (
          <div className="space-y-4">
            {/* Filter controls bar */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                  Player Filter
                </label>
                <select
                  value={playerFilter}
                  onChange={(e) => setPlayerFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-white/15 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Players</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                  Score Pattern
                </label>
                <select
                  value={patternFilter}
                  onChange={(e) => setPatternFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-white/15 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Scores</option>
                  <option value="blowout">Blowouts (Diff ≥ 4)</option>
                  <option value="5-0">5 - 0 Shutouts</option>
                  <option value="5-1">5 - 1 Matches</option>
                  <option value="6-0">6 - 0 Final Blowout</option>
                </select>
              </div>
            </div>

            {/* Mini-Leaderboard Banner */}
            {displayedHistory.miniLeaderboard.length > 0 && (
              <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/20 rounded-2xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <span>⚡</span> Filter Summary
                  </span>
                  <div className="text-[11px] text-gray-400">
                    <span className="text-white font-bold">{displayedHistory.totalMatches}</span> matches •{" "}
                    <span className="text-white font-bold">{displayedHistory.totalPoints}</span> pts
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {displayedHistory.miniLeaderboard.slice(0, 3).map((item, idx) => (
                    <div
                      key={item.playerId}
                      className="bg-slate-900/80 border border-white/10 rounded-xl p-2 text-center"
                    >
                      <div className="text-[10px] font-bold text-purple-400 mb-0.5">
                        {idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : "🥉 #3"}
                      </div>
                      <div className="text-xs font-bold text-white truncate">{item.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        <span className="text-emerald-400 font-bold">{item.points} pts</span> • {item.wins}W
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline days */}
            {displayedHistory.days.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/30 border border-white/5 rounded-2xl">
                <div className="text-3xl mb-2">🏸</div>
                <div className="text-sm font-semibold text-gray-300">No match records found</div>
                <p className="text-xs text-gray-500 mt-1">Play matches or adjust your date filter</p>
              </div>
            ) : (
              <div className="space-y-4">
                {displayedHistory.days.map((dayGroup) => (
                  <div key={dayGroup.date} className="space-y-2.5">
                    {/* Day date header */}
                    <div className="flex items-center gap-2 px-1">
                      <div className="h-px flex-1 bg-white/10" />
                      <span className="text-xs font-bold text-purple-300 bg-slate-900 border border-white/10 px-3 py-1 rounded-full shadow-sm">
                        📅 {dayGroup.date}
                      </span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>

                    {/* Tournaments for that day */}
                    {dayGroup.tournaments.map((tourney, tIdx) => {
                      const isExpanded = expandedTournaments[tourney.tournamentId] ?? true;
                      const hasFinal = tourney.matches.some((m) => m.isFinal);

                      return (
                        <div
                          key={tourney.tournamentId}
                          className="bg-slate-900/70 border border-white/10 rounded-2xl overflow-hidden shadow-lg transition-all"
                        >
                          {/* Tournament header accordion button */}
                          <div
                            onClick={() => toggleTournament(tourney.tournamentId)}
                            className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-850 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-300">
                                #{tIdx + 1}
                              </div>
                              <div className="text-left">
                                <div className="text-xs font-bold text-white flex items-center gap-2">
                                  <span>Tournament #{tIdx + 1}</span>
                                  {hasFinal && (
                                    <span className="text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-300 px-1.5 py-0.5 rounded font-semibold">
                                      🏆 Final Played
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-400">
                                  {tourney.matches.length} played matches
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {tourney.shareSlug && (
                                <Link
                                  href={`/live/${tourney.shareSlug}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[11px] px-2 py-1 rounded-md bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 font-semibold flex items-center gap-1"
                                >
                                  <span>👁️ Live</span>
                                </Link>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTournamentToDelete(tourney.tournamentId);
                                }}
                                title="Delete Tournament"
                                className="text-[11px] p-1.5 rounded-md bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                              >
                                <span>🗑️</span>
                              </button>
                              <svg
                                className={`w-4 h-4 text-gray-400 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </div>
                          </div>

                          {/* Matches list */}
                          {isExpanded && (
                            <div className="divide-y divide-white/5 border-t border-white/5 p-2 space-y-1.5">
                              {tourney.matches.map((m) => {
                                const aWon = m.scoreA > m.scoreB;
                                const bWon = m.scoreB > m.scoreA;
                                const diff = Math.abs(m.scoreA - m.scoreB);
                                const isBlowout = diff >= 4;

                                return (
                                  <div
                                    key={m.id}
                                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                                      m.isFinal
                                        ? "bg-gradient-to-r from-amber-950/20 via-slate-900 to-purple-950/20 border-amber-500/30"
                                        : "bg-slate-950/50 border-white/5"
                                    }`}
                                  >
                                    {/* Player A */}
                                    <div className="flex-1 flex items-center gap-2 min-w-0">
                                      <AvatarSVG
                                        type={m.playerAAvatar}
                                        size={32}
                                        emoji={m.playerAAvatarEmoji}
                                        color={m.playerAAvatarColor}
                                      />
                                      <div className="min-w-0">
                                        <div
                                          className={`text-xs truncate ${
                                            aWon ? "font-bold text-white" : "text-gray-400 font-medium"
                                          }`}
                                        >
                                          {m.playerAName}
                                        </div>
                                        <div className="text-[10px] text-gray-500">
                                          +{m.pointsA} pts {aWon && isBlowout && "🔥"}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Score pill */}
                                    <div className="flex flex-col items-center">
                                      {m.isFinal && (
                                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-400 mb-0.5">
                                          Final
                                        </span>
                                      )}
                                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-white/10 rounded-full font-mono text-xs font-bold">
                                        <span className={aWon ? "text-emerald-400 font-black" : "text-gray-400"}>
                                          {m.scoreA}
                                        </span>
                                        <span className="text-gray-600">-</span>
                                        <span className={bWon ? "text-emerald-400 font-black" : "text-gray-400"}>
                                          {m.scoreB}
                                        </span>
                                      </div>
                                      {isBlowout && (
                                        <span className="text-[9px] text-purple-400 font-semibold mt-0.5">
                                          +Bonus
                                        </span>
                                      )}
                                    </div>

                                    {/* Player B */}
                                    <div className="flex-1 flex items-center justify-end gap-2 min-w-0 text-right">
                                      <div className="min-w-0">
                                        <div
                                          className={`text-xs truncate ${
                                            bWon ? "font-bold text-white" : "text-gray-400 font-medium"
                                          }`}
                                        >
                                          {m.playerBName}
                                        </div>
                                        <div className="text-[10px] text-gray-500">
                                          +{m.pointsB} pts {bWon && isBlowout && "🔥"}
                                        </div>
                                      </div>
                                      <AvatarSVG
                                        type={m.playerBAvatar}
                                        size={32}
                                        emoji={m.playerBAvatarEmoji}
                                        color={m.playerBAvatarColor}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 2: LEADERBOARDS & DAY HONORS */}
        {activeSubTab === "leaderboards" && (
          <div className="space-y-5">
            {/* Metric Switcher */}
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-2 flex items-center gap-1">
              <span className="text-[11px] font-bold text-gray-400 px-2 uppercase">Rank by:</span>
              <div className="flex-1 grid grid-cols-3 gap-1">
                {(
                  [
                    { key: "points", label: "Points" },
                    { key: "wins", label: "Wins" },
                    { key: "matches", label: "Matches" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setSortBy(m.key)}
                    className={`py-1 text-xs font-bold rounded-lg transition-all ${
                      sortBy === m.key
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-gray-400 hover:text-white bg-slate-950/40"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Standings Table Card */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-3.5 border-b border-white/10 bg-slate-900 flex items-center justify-between">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>📊</span> Overall Standings ({rangeFilter.toUpperCase()})
                </div>
                <div className="text-[10px] text-gray-400">
                  {displayedLeaderboard.length > 0 ? displayedLeaderboard.length : players.length} active players
                </div>
              </div>

              {displayedLeaderboard.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  No ranked matches recorded for this range.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {displayedLeaderboard.map((entry, index) => {
                    const isTop1 = index === 0;
                    const isTop2 = index === 1;
                    const isTop3 = index === 2;

                    return (
                      <div
                        key={entry.playerId}
                        className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                          isTop1
                            ? "bg-amber-500/10"
                            : isTop2
                            ? "bg-slate-800/40"
                            : isTop3
                            ? "bg-orange-500/5"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        {/* Rank & Avatar & Name */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 text-center font-bold text-xs">
                            {isTop1 ? "🥇" : isTop2 ? "🥈" : isTop3 ? "🥉" : `#${index + 1}`}
                          </div>
                          <AvatarSVG
                            type={entry.avatar}
                            size={36}
                            emoji={entry.avatarEmoji}
                            color={entry.avatarColor}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{entry.name}</div>
                            <div className="text-[10px] text-gray-400 flex items-center gap-1.5">
                              <span>
                                {entry.wins}W - {entry.matchesPlayed - entry.wins}L
                              </span>
                              <span>•</span>
                              <span>{entry.winRate}% win</span>
                            </div>
                          </div>
                        </div>

                        {/* Metric Highlights */}
                        <div className="text-right">
                          <div className="text-sm font-black text-purple-300">
                            {sortBy === "points"
                              ? `${entry.totalPoints} pts`
                              : sortBy === "wins"
                              ? `${entry.wins} wins`
                              : `${entry.matchesPlayed} matches`}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            Diff:{" "}
                            <span
                              className={
                                entry.pointDiff > 0
                                   ? "text-emerald-400 font-semibold"
                                  : entry.pointDiff < 0
                                  ? "text-red-400 font-semibold"
                                  : "text-gray-400"
                              }
                            >
                              {entry.pointDiff > 0 ? `+${entry.pointDiff}` : entry.pointDiff}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Day Champions & Day Last-Place Hall of Fame */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Day Champions Card */}
              <div className="bg-slate-900/80 border border-amber-500/20 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-sm">
                    👑
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Day Champions</h3>
                    <p className="text-[10px] text-amber-400/80">Most daily 1st place finishes</p>
                  </div>
                </div>

                {displayedDayHonors?.dayChampions && displayedDayHonors.dayChampions.length > 0 ? (
                  <div className="space-y-2">
                    {displayedDayHonors.dayChampions.slice(0, 3).map((c) => (
                      <div
                        key={c.playerId}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <AvatarSVG type={c.avatar} size={28} emoji={c.emoji} color={c.color} />
                          <span className="text-xs font-bold text-gray-200">{c.name}</span>
                        </div>
                        <div className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full text-[10px] font-black text-amber-300">
                          {c.count} {c.count === 1 ? "Day" : "Days"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-500 text-center py-4">
                    Close a day table to crown day champions!
                  </div>
                )}
              </div>

              {/* Day Last Place Card */}
              <div className="bg-slate-900/80 border border-red-500/20 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-sm">
                    🥄
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Wooden Spoon</h3>
                    <p className="text-[10px] text-red-400/80">Most daily last-place finishes</p>
                  </div>
                </div>

                {displayedDayHonors?.dayLastPlaces && displayedDayHonors.dayLastPlaces.length > 0 ? (
                  <div className="space-y-2">
                    {displayedDayHonors.dayLastPlaces.slice(0, 3).map((c) => (
                      <div
                        key={c.playerId}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <AvatarSVG type={c.avatar} size={28} emoji={c.emoji} color={c.color} />
                          <span className="text-xs font-bold text-gray-200">{c.name}</span>
                        </div>
                        <div className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 rounded-full text-[10px] font-black text-red-300">
                          {c.count} {c.count === 1 ? "Day" : "Days"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-500 text-center py-4">
                    No last place finishes recorded yet.
                  </div>
                )}
              </div>
            </div>

            {/* Day by Day History */}
            {dayHonors?.history && dayHonors.history.length > 0 && (
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 space-y-2">
                <h4 className="text-xs font-bold text-gray-300">📅 Day Results Archive</h4>
                <div className="divide-y divide-white/5">
                  {dayHonors.history.map((h) => (
                    <div key={h.id} className="py-2 flex items-center justify-between text-xs">
                      <span className="font-mono text-gray-400">{h.date}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-amber-300 font-semibold flex items-center gap-1">
                          👑 {h.topPlayerName}
                        </span>
                        <span className="text-red-400 font-semibold flex items-center gap-1">
                          🥄 {h.bottomPlayerName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {tournamentToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-slate-900 border border-red-500/30 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-xl text-red-400">
                  🗑️
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Delete Tournament?</h2>
                  <p className="text-[11px] text-gray-400">Remove accidental or test match</p>
                </div>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                This will permanently delete this tournament and its matches, and automatically recalculate player points and day standings.
              </p>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setTournamentToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTournament(tournamentToDelete)}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-xs font-bold text-white shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? <span>Deleting...</span> : <span>Delete Permanently</span>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scorekeeper PIN Modal */}
      <PinModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          setShowPinModal(false);
          if (tournamentToDelete) {
            handleDeleteTournament(tournamentToDelete);
          }
        }}
      />
    </div>
  );
}
