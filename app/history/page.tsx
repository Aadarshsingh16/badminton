"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, Legend, Cell } from "recharts";
import {
  useStore,
  recoverTournamentsFromSyncQueue,
  recoverCompletedDaysFromSyncQueue,
  getDeletedTournamentIds,
} from "@/lib/store";
import { AvatarSVG } from "@/components/avatars/AvatarSVG";
import { AvatarType } from "@/lib/types";
import { PinModal } from "@/components/PinModal";
import { apiSync } from "@/lib/apiSync";
import { isViewerMode, getViewerSlug } from "@/lib/viewerMode";
import { getBackendUrl } from "@/lib/backend";

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
  dayPointsTotal: number;
  leagueMatchesPlayed: number;
  leagueWins: number;
  leaguePoints: number;
  leaguePointDiff: number;
  leagueWinRate: number;
  shutoutWins: number;
  shutoutLosses: number;
  highestWinMargin: number;
  finalsPlayed: number;
  finalsWon: number;
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
  const [dayToDelete, setDayToDelete] = useState<string | null>(null);
  
  const [leaderboardCategory, setLeaderboardCategory] = useState<"day" | "league" | "finals" | "analytics">("day");
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState<"tournament" | "day">("tournament");
  const [targetIdForPin, setTargetIdForPin] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const [isMounted, setIsMounted] = useState(false);

  const [isViewer, setIsViewer] = useState(false);
  const [viewerSlug, setViewerSlugState] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);

    setIsViewer(isViewerMode() && !currentTournament);
    setViewerSlugState(getViewerSlug());
  }, [currentTournament]);

  const backendUrl = getBackendUrl();

  const handleDeleteTournament = async (tId: string) => {
    if (!apiSync.hasPin()) {
      setPinAction("tournament");
      setTargetIdForPin(tId);
      setShowPinModal(true);
      return;
    }

    setIsDeleting(true);

    // 1. Immediately delete locally in Zustand store, permanent archive, and purge from sync queue
    useStore.getState().deleteTournament(tId);

    // 2. Immediately purge from local historyData state for instantaneous UI removal
    setHistoryData((prev) => {
      if (!prev) return null;
      const updatedDays = prev.days
        .map((day) => ({
          ...day,
          tournaments: day.tournaments.filter((t) => t.tournamentId !== tId),
        }))
        .filter((day) => day.tournaments.length > 0);

      const remainingMatches = updatedDays.flatMap((d) => d.tournaments.flatMap((t) => t.matches));

      return {
        ...prev,
        days: updatedDays,
        totalMatches: remainingMatches.length,
        totalPoints: remainingMatches.reduce((acc, m) => acc + m.pointsA + m.pointsB, 0),
      };
    });

    setTournamentToDelete(null);

    // 3. Delete from backend database
    try {
      const res = await fetch(`${backendUrl}/tournaments/${tId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-scorekeeper-pin": apiSync.getPin(),
        },
      });

      if (res.status === 401) {
        setShowPinModal(true);
      } else {
        await Promise.all([fetchHistory(), fetchLeaderboards()]);
      }
    } catch (e) {
      console.warn("Failed to delete tournament on backend, preserved local deletion:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteDay = async (date: string) => {
    if (!apiSync.hasPin()) {
      setPinAction("day");
      setTargetIdForPin(date);
      setShowPinModal(true);
      return;
    }

    setIsDeleting(true);

    // 1. Immediately delete locally in Zustand store, permanent archive, and purge from sync queue
    useStore.getState().resetDayTable(date);

    // 2. Immediately purge from local historyData state for instantaneous UI removal
    setHistoryData((prev) => {
      if (!prev) return null;
      const updatedDays = prev.days.filter((d) => d.date !== date);
      const remainingMatches = updatedDays.flatMap((d) => d.tournaments.flatMap((t) => t.matches));

      return {
        ...prev,
        days: updatedDays,
        totalMatches: remainingMatches.length,
        totalPoints: remainingMatches.reduce((acc, m) => acc + m.pointsA + m.pointsB, 0),
      };
    });

    // 3. Immediately purge from local dayHonors state
    setDayHonors((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        history: prev.history.filter((h) => h.date !== date),
      };
    });

    setDayToDelete(null);

    // 4. Delete from backend database
    try {
      const headers = {
        "Content-Type": "application/json",
        "x-scorekeeper-pin": apiSync.getPin(),
      };
      await Promise.all([
        fetch(`${backendUrl}/day-tables/${date}`, { method: "DELETE", headers }),
        fetch(`${backendUrl}/day-results/${date}`, { method: "DELETE", headers }),
      ]);
      await Promise.all([fetchHistory(), fetchLeaderboards()]);
    } catch (e) {
      console.warn("Failed to delete day on backend, preserved local deletion:", e);
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
    fetchHistory();
    fetchLeaderboards();
  }, [rangeFilter, playerFilter, patternFilter, sortBy]);

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

  const localLeaderboardFallback = useMemo<LeaderboardEntry[]>(() => {
    let allTourneys = [...pastTournaments];
    if (allTourneys.length === 0) {
      const rec = recoverTournamentsFromSyncQueue();
      if (rec.length > 0) allTourneys = rec;
    }
    if (currentTournament) allTourneys.push(currentTournament);

    const entries: LeaderboardEntry[] = players.map((p) => {
      let dayPointsTotal = 0;
      let leagueMatchesPlayed = 0;
      let leagueWins = 0;
      let leaguePoints = 0;
      let leaguePointDiff = 0;
      let shutoutWins = 0;
      let shutoutLosses = 0;
      let highestWinMargin = 0;
      let finalsPlayed = 0;
      let finalsWon = 0;

      allTourneys.forEach((t) => {
        // Day points logic
        if (t.dayPointsAwarded && t.dayPointsAwarded[p.id] !== undefined) {
          dayPointsTotal += t.dayPointsAwarded[p.id];
        }

        // League matches
        t.matches.filter(m => m.played).forEach(m => {
          if (m.playerA === p.id || m.playerB === p.id) {
            leagueMatchesPlayed++;
            const isA = m.playerA === p.id;
            const myScore = isA ? (m.scoreA ?? 0) : (m.scoreB ?? 0);
            const oppScore = isA ? (m.scoreB ?? 0) : (m.scoreA ?? 0);
            const myPoints = isA ? (m.pointsAwarded?.[m.playerA] ?? 0) : (m.pointsAwarded?.[m.playerB] ?? 0);
            const won = myScore > oppScore;
            
            if (won) leagueWins++;
            leaguePoints += myPoints;
            leaguePointDiff += (myScore - oppScore);
            
            if (won && oppScore === 0) shutoutWins++;
            if (!won && myScore === 0) shutoutLosses++;
            if (won) highestWinMargin = Math.max(highestWinMargin, myScore - oppScore);
          }
        });

        // Finals
        if (t.final?.played && (t.final.playerA === p.id || t.final.playerB === p.id)) {
          finalsPlayed++;
          const m = t.final;
          const isA = m.playerA === p.id;
          const myScore = isA ? (m.scoreA ?? 0) : (m.scoreB ?? 0);
          const oppScore = isA ? (m.scoreB ?? 0) : (m.scoreA ?? 0);
          if (myScore > oppScore) finalsWon++;
        }
      });

      if (dayPointsTotal === 0 && dayTable.totals[p.id]) {
        dayPointsTotal = dayTable.totals[p.id];
      }

      return {
        playerId: p.id,
        name: p.name,
        avatar: p.avatar,
        avatarEmoji: p.avatarEmoji,
        avatarColor: p.avatarColor,
        dayPointsTotal,
        leagueMatchesPlayed,
        leagueWins,
        leaguePoints,
        leaguePointDiff,
        leagueWinRate: leagueMatchesPlayed > 0 ? Math.round((leagueWins / leagueMatchesPlayed) * 1000) / 10 : 0,
        shutoutWins,
        shutoutLosses,
        highestWinMargin,
        finalsPlayed,
        finalsWon,
      };
    }).filter((p) => p.leagueMatchesPlayed > 0 || p.dayPointsTotal > 0 || p.finalsPlayed > 0);

    return entries;
  }, [pastTournaments, currentTournament, dayTable, players]);

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

  const displayedHistory = useMemo(() => {
    const deletedIds = getDeletedTournamentIds();
    const source = historyData && historyData.days.length > 0 ? historyData : localHistoryFallback;
    if (!source || !source.days) return source;

    const filteredDays = source.days
      .map((day) => ({
        ...day,
        tournaments: day.tournaments.filter((t) => !deletedIds.has(t.tournamentId)),
      }))
      .filter((day) => day.tournaments.length > 0);

    const filteredMatches = filteredDays.flatMap((d) => d.tournaments.flatMap((t) => t.matches));

    return {
      ...source,
      days: filteredDays,
      totalMatches: filteredMatches.length,
      totalPoints: filteredMatches.reduce((acc, m) => acc + m.pointsA + m.pointsB, 0),
    };
  }, [historyData, localHistoryFallback]);

  const baseLeaderboard =
    leaderboardData && leaderboardData.length > 0 ? leaderboardData : localLeaderboardFallback;

  const displayedLeaderboard = useMemo(() => {
    if (!baseLeaderboard) return [];
    const lb = [...baseLeaderboard];
    
    if (leaderboardCategory === "day") {
      lb.sort((a, b) => b.dayPointsTotal - a.dayPointsTotal || b.leaguePoints - a.leaguePoints);
    } else if (leaderboardCategory === "finals") {
      lb.sort((a, b) => b.finalsWon - a.finalsWon || b.finalsPlayed - a.finalsPlayed || b.dayPointsTotal - a.dayPointsTotal);
    } else if (leaderboardCategory === "league") {
      if (sortBy === "wins") {
        lb.sort((a, b) => b.leagueWins - a.leagueWins || b.leaguePoints - a.leaguePoints);
      } else if (sortBy === "matches") {
        lb.sort((a, b) => b.leagueMatchesPlayed - a.leagueMatchesPlayed || b.leaguePoints - a.leaguePoints);
      } else {
        lb.sort((a, b) => b.leaguePoints - a.leaguePoints || b.leaguePointDiff - a.leaguePointDiff);
      }
    }
    
    return lb;
  }, [baseLeaderboard, leaderboardCategory, sortBy]);

  const advancedInsights = useMemo(() => {
    if (!displayedHistory || !displayedHistory.days) return null;

    const formMap: Record<string, string[]> = {};
    const h2h: Record<string, Record<string, { wins: number; losses: number }>> = {};
    
    const allChronologicalMatches: (MatchHistoryItem & { date: string })[] = [];
    displayedHistory.days.forEach(d => {
      d.tournaments.forEach(t => {
        t.matches.forEach(m => {
          allChronologicalMatches.push({ ...m, date: d.date });
        });
      });
    });
    
    allChronologicalMatches.forEach(m => {
      if (!formMap[m.playerA]) formMap[m.playerA] = [];
      if (!formMap[m.playerB]) formMap[m.playerB] = [];
      
      const aWon = m.scoreA > m.scoreB;
      const bWon = m.scoreB > m.scoreA;
      
      if (formMap[m.playerA].length < 5) formMap[m.playerA].push(aWon ? "W" : "L");
      if (formMap[m.playerB].length < 5) formMap[m.playerB].push(bWon ? "W" : "L");
      
      if (!h2h[m.playerA]) h2h[m.playerA] = {};
      if (!h2h[m.playerA][m.playerB]) h2h[m.playerA][m.playerB] = { wins: 0, losses: 0 };
      if (!h2h[m.playerB]) h2h[m.playerB] = {};
      if (!h2h[m.playerB][m.playerA]) h2h[m.playerB][m.playerA] = { wins: 0, losses: 0 };
      
      if (aWon) {
        h2h[m.playerA][m.playerB].wins++;
        h2h[m.playerB][m.playerA].losses++;
      } else if (bWon) {
        h2h[m.playerB][m.playerA].wins++;
        h2h[m.playerA][m.playerB].losses++;
      }
    });

    const winRateChartData = displayedLeaderboard
      .filter(l => l.leagueMatchesPlayed >= 1 || l.finalsPlayed >= 1)
      .map(l => ({
        name: l.name,
        "League WR %": l.leagueWinRate,
        "Finals WR %": l.finalsPlayed > 0 ? Math.round((l.finalsWon / l.finalsPlayed) * 100) : 0,
      }));

    const dominanceData = players.map(p => {
      let diff = 0;
      let count = 0;
      allChronologicalMatches.forEach(m => {
        if (m.playerA === p.id) { diff += (m.scoreA - m.scoreB); count++; }
        else if (m.playerB === p.id) { diff += (m.scoreB - m.scoreA); count++; }
      });
      return {
        name: p.name,
        "Avg Diff": count > 0 ? Number((diff / count).toFixed(1)) : 0,
        count
      };
    }).filter(d => d.count >= 2).sort((a, b) => b["Avg Diff"] - a["Avg Diff"]);
    
    // Calculate Stat Leaders
    const statLeaders = displayedLeaderboard.length > 0 ? {
      shutoutKing: displayedLeaderboard.reduce((prev, current) => (prev.shutoutWins > current.shutoutWins) ? prev : current, displayedLeaderboard[0]),
      highestMargin: displayedLeaderboard.reduce((prev, current) => (prev.highestWinMargin > current.highestWinMargin) ? prev : current, displayedLeaderboard[0]),
      ironMan: displayedLeaderboard.reduce((prev, current) => ((prev.leagueMatchesPlayed + prev.finalsPlayed) > (current.leagueMatchesPlayed + current.finalsPlayed)) ? prev : current, displayedLeaderboard[0]),
      finalsSpecialist: displayedLeaderboard.reduce((prev, current) => (prev.finalsWon > current.finalsWon) ? prev : current, displayedLeaderboard[0]),
    } : { shutoutKing: null, highestMargin: null, ironMan: null, finalsSpecialist: null };

    return {
      formMap,
      statLeaders,
      winRateChartData,
      dominanceData
    };
  }, [displayedHistory, displayedLeaderboard, players]);


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

  const rangeOptions = [
    { value: "all", label: "All Time" },
    { value: "month", label: "30 Days" },
    { value: "week", label: "7 Days" },
    { value: "day", label: "Today" },
  ];

  const currentRangeLabel =
    rangeFilter === "day"
      ? "Today"
      : rangeFilter === "week"
      ? "7 Days"
      : rangeFilter === "month"
      ? "30 Days"
      : "All Time";

  const playerOptions = [
    { value: "all", label: "All Players" },
    ...players.map((p) => ({ value: p.id, label: p.name })),
  ];

  const currentPlayerLabel =
    playerFilter === "all"
      ? "All Players"
      : players.find((p) => p.id === playerFilter)?.name ?? "Player";

  const patternOptions = [
    { value: "all", label: "All Scores" },
    { value: "blowout", label: "Blowouts (Diff ≥ 4)" },
    { value: "5-0", label: "5 - 0 Shutouts" },
    { value: "5-1", label: "5 - 1 Matches" },
    { value: "6-0", label: "6 - 0 Final Blowout" },
  ];

  const currentPatternLabel =
    patternFilter === "all"
      ? "All Scores"
      : patternFilter === "blowout"
      ? "Blowouts"
      : patternFilter === "5-0"
      ? "5 - 0"
      : patternFilter === "5-1"
      ? "5 - 1"
      : patternFilter === "6-0"
      ? "6 - 0"
      : patternFilter;

  const hasActiveFilter =
    rangeFilter !== "all" || playerFilter !== "all" || patternFilter !== "all";

  const activeFilterCount =
    (rangeFilter !== "all" ? 1 : 0) +
    (playerFilter !== "all" ? 1 : 0) +
    (patternFilter !== "all" ? 1 : 0);

  if (!isMounted) return <div className="min-h-full bg-[#f8fafc]"></div>;

  return (
    <div className="min-h-full flex flex-col px-4 pt-4 pb-20">
      {/* Spectator Mode Banner */}
      {isViewer && (
        <div className="bg-purple-50 border border-purple-200/80 rounded-2xl px-3.5 py-2 mb-3 flex items-center justify-between text-xs text-purple-900 shadow-xs">
          <span className="font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Spectator Mode · Match History & Logs
          </span>
          {viewerSlug && (
            <Link
              href={`/live/${viewerSlug}`}
              className="text-white bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors"
            >
              <span>🏸 Live Court</span>
            </Link>
          )}
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center text-slate-900 text-sm">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
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
            <h1 className="text-sm font-black text-slate-900 leading-tight">
              History & Stats
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Match logs & day honors</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Smooth Filter Menu Trigger */}
          {activeSubTab === "log" && (
            <button
              onClick={() => setShowFilterMenu(true)}
              className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer ${
                hasActiveFilter
                  ? "bg-slate-950 text-white shadow-xs"
                  : "bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              <span>Filters</span>
              {hasActiveFilter && (
                <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-black flex items-center justify-center -mr-0.5">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => {
              if (activeSubTab === "log") fetchHistory();
              else fetchLeaderboards();
            }}
            disabled={loading}
            className="w-8 h-8 rounded-full bg-white border border-slate-200/80 shadow-xs hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center text-slate-600 cursor-pointer"
            title="Refresh"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin text-slate-950" : ""}`}
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
          </button>
        </div>
      </div>

      {/* Sub-tab segmented pill control */}
      <div className="p-1 bg-slate-200/70 rounded-full flex gap-1 mb-3">
        <button
          onClick={() => setActiveSubTab("log")}
          className={`py-1.5 px-3 text-xs font-extrabold rounded-full flex-1 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === "log"
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-950"
          }`}
        >
          <span>📜</span>
          <span>Match Log</span>
        </button>
        <button
          onClick={() => setActiveSubTab("leaderboards")}
          className={`py-1.5 px-3 text-xs font-extrabold rounded-full flex-1 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === "leaderboards"
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-950"
          }`}
        >
          <span>🏆</span>
          <span>Leaderboards & Honors</span>
        </button>
      </div>

      {/* SUB-TAB 1: MATCH LOG */}
      {activeSubTab === "log" && (
        <div className="space-y-3">
          {/* Active Filter Chips (only when filters applied) */}
          {hasActiveFilter && (
            <div className="flex items-center gap-1.5 flex-wrap px-0.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Filtered:</span>
              {rangeFilter !== "all" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-white text-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                  📅 {currentRangeLabel}
                  <button
                    type="button"
                    onClick={() => setRangeFilter("all")}
                    className="hover:text-rose-600 cursor-pointer ml-0.5 font-black text-[10px]"
                  >
                    ✕
                  </button>
                </span>
              )}
              {playerFilter !== "all" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-white text-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                  👤 {currentPlayerLabel}
                  <button
                    type="button"
                    onClick={() => setPlayerFilter("all")}
                    className="hover:text-rose-600 cursor-pointer ml-0.5 font-black text-[10px]"
                  >
                    ✕
                  </button>
                </span>
              )}
              {patternFilter !== "all" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-white text-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                  🎯 {currentPatternLabel}
                  <button
                    type="button"
                    onClick={() => setPatternFilter("all")}
                    className="hover:text-rose-600 cursor-pointer ml-0.5 font-black text-[10px]"
                  >
                    ✕
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setRangeFilter("all");
                  setPlayerFilter("all");
                  setPatternFilter("all");
                }}
                className="text-[11px] font-black text-blue-600 hover:underline cursor-pointer ml-1"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Mini-Leaderboard Hero Banner (Bento Summary) */}
          {displayedHistory.miniLeaderboard.length > 0 && (
            <div className="bg-gradient-to-br from-[#9BB8FF] to-[#7EA3FC] text-slate-950 rounded-[28px] p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-950 flex items-center gap-1.5">
                  <span>⚡</span> Match Summary
                </span>
                <div className="text-[11px] font-bold text-slate-900/80 bg-white/50 px-2.5 py-0.5 rounded-full">
                  <span>{displayedHistory.totalMatches}</span> matches •{" "}
                  <span>{displayedHistory.totalPoints}</span> pts
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {displayedHistory.miniLeaderboard.slice(0, 3).map((item, idx) => (
                  <div
                    key={item.playerId}
                    className="bg-white/95 rounded-2xl p-2.5 text-center shadow-xs"
                  >
                    <div className="text-[10px] font-black text-slate-900 mb-0.5">
                      {idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : "🥉 #3"}
                    </div>
                    <div className="text-xs font-extrabold text-slate-900 truncate">{item.name}</div>
                    <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      <span className="text-emerald-600 font-bold">{item.points} pts</span> • {item.wins}W
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline days */}
          {displayedHistory.days.length === 0 ? (
            <div className="text-center py-12 px-6 bg-white border border-slate-200/80 rounded-[30px] shadow-xs flex flex-col items-center justify-center gap-2">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-3xl mb-1 shadow-xs select-none">
                🏸
              </div>
              <div className="text-base font-extrabold text-slate-900">No match records found</div>
              <p className="text-xs text-slate-400 font-medium max-w-xs">
                Play matches or adjust your date filter
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedHistory.days.map((dayGroup) => (
                <div key={dayGroup.date} className="space-y-2.5">
                  {/* Day date header */}
                  <div className="flex items-center gap-2 px-1">
                    <div className="h-px flex-1 bg-slate-200" />
                    <div className="flex items-center gap-1.5 bg-slate-200/70 border border-slate-200/80 pl-3.5 pr-2 py-1 rounded-full shadow-2xs">
                      <span className="text-xs font-extrabold text-slate-700">
                        📅 {dayGroup.date}
                      </span>
                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => setDayToDelete(dayGroup.date)}
                          title={`Delete all records for ${dayGroup.date}`}
                          className="w-5 h-5 rounded-full hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors flex items-center justify-center cursor-pointer text-[10px]"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  {/* Tournaments for that day */}
                  {dayGroup.tournaments.map((tourney, tIdx) => {
                    const isExpanded = expandedTournaments[tourney.tournamentId] ?? true;
                    const hasFinal = tourney.matches.some((m) => m.isFinal);

  if (!isMounted) return <div className="min-h-full bg-[#f8fafc]"></div>;

                    return (
                      <div
                        key={tourney.tournamentId}
                        className="bg-white border border-slate-200/80 rounded-[26px] overflow-hidden shadow-xs transition-all"
                      >
                        {/* Tournament header accordion button */}
                        <div
                          onClick={() => toggleTournament(tourney.tournamentId)}
                          className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-800">
                              #{tIdx + 1}
                            </div>
                            <div className="text-left">
                              <div className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
                                <span>Tournament #{tIdx + 1}</span>
                                {hasFinal && (
                                  <span className="text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                                    🏆 Final
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-medium">
                                {tourney.matches.length} played matches
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {tourney.shareSlug && (
                              <Link
                                href={`/live/${tourney.shareSlug}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold flex items-center gap-1 transition-colors"
                              >
                                <span>👁️ Live</span>
                              </Link>
                            )}
                            {!isViewer && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTournamentToDelete(tourney.tournamentId);
                                }}
                                title="Delete Tournament"
                                className="text-xs p-1.5 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                              >
                                <span>🗑️</span>
                              </button>
                            )}
                            <svg
                              className={`w-4 h-4 text-slate-400 transition-transform ${
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
                          <div className="divide-y divide-slate-100 border-t border-slate-100 p-2 space-y-1.5 bg-slate-50/40">
                            {tourney.matches.map((m) => {
                              const aWon = m.scoreA > m.scoreB;
                              const bWon = m.scoreB > m.scoreA;
                              const diff = Math.abs(m.scoreA - m.scoreB);
                              const isBlowout = diff >= 4;

  if (!isMounted) return <div className="min-h-full bg-[#f8fafc]"></div>;

                              return (
                                <div
                                  key={m.id}
                                  className={`p-2.5 rounded-2xl border flex items-center justify-between gap-3 ${
                                    m.isFinal
                                      ? "bg-gradient-to-r from-amber-500/10 via-white to-purple-500/10 border-amber-300"
                                      : "bg-white border-slate-200/70 shadow-2xs"
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
                                          aWon ? "font-extrabold text-slate-900" : "text-slate-500 font-medium"
                                        }`}
                                      >
                                        {m.playerAName}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-medium">
                                        +{m.pointsA} pts {aWon && isBlowout && "🔥"}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Score pill */}
                                  <div className="flex flex-col items-center">
                                    {m.isFinal && (
                                      <span className="text-[9px] uppercase tracking-wider font-black text-amber-600 mb-0.5">
                                        Final
                                      </span>
                                    )}
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 text-white rounded-full font-mono text-xs font-extrabold shadow-xs">
                                      <span className={aWon ? "text-emerald-400" : "text-white/70"}>
                                        {m.scoreA}
                                      </span>
                                      <span className="text-white/40">-</span>
                                      <span className={bWon ? "text-emerald-400" : "text-white/70"}>
                                        {m.scoreB}
                                      </span>
                                    </div>
                                    {isBlowout && (
                                      <span className="text-[9px] text-blue-600 font-bold mt-0.5">
                                        +Bonus
                                      </span>
                                    )}
                                  </div>

                                  {/* Player B */}
                                  <div className="flex-1 flex items-center justify-end gap-2 min-w-0 text-right">
                                    <div className="min-w-0">
                                      <div
                                        className={`text-xs truncate ${
                                          bWon ? "font-extrabold text-slate-900" : "text-slate-500 font-medium"
                                        }`}
                                      >
                                        {m.playerBName}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-medium">
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
        <div className="space-y-3">
          {/* Combined Controls for Leaderboards */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Time Filter Pill */}
            <div
              className={`relative inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-all shadow-2xs cursor-pointer select-none shrink-0 ${
                rangeFilter !== "all"
                  ? "bg-slate-950 text-white font-black shadow-xs ring-1 ring-slate-950"
                  : "bg-white border border-slate-200/80 text-slate-700 font-bold hover:bg-slate-50"
              }`}
            >
              <span>📅</span>
              <span>{currentRangeLabel}</span>
              <span className={`text-[9px] ${rangeFilter !== "all" ? "text-white/70" : "text-slate-400"}`}>▾</span>
              <select
                value={rangeFilter}
                onChange={(e) => setRangeFilter(e.target.value as any)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-base"
                aria-label="Filter by time range"
              >
                {rangeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Switcher Pill Row */}
            <div className="flex bg-slate-200/70 p-1 rounded-full overflow-x-auto hide-scrollbar w-full sm:w-auto">
              {(
                [
                  { key: "day", label: "Day Points", icon: "🏆" },
                  { key: "league", label: "League", icon: "🏸" },
                  { key: "finals", label: "Finals", icon: "🎯" },
                  { key: "analytics", label: "Analytics", icon: "📊" },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setLeaderboardCategory(cat.key)}
                  className={`py-1.5 px-3 flex items-center gap-1.5 text-xs font-extrabold rounded-full transition-all whitespace-nowrap cursor-pointer ${
                    leaderboardCategory === cat.key
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {leaderboardCategory === "league" && (
            <div className="flex justify-end mb-1">
              <div className="p-1 bg-slate-200/70 rounded-full flex gap-1 items-center">
                <span className="text-[10px] font-extrabold text-slate-500 pl-2 pr-0.5 uppercase">Rank:</span>
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
                    className={`py-1 px-2.5 text-xs font-extrabold rounded-full transition-all cursor-pointer ${
                      sortBy === m.key
                        ? "bg-slate-950 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-950"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {leaderboardCategory !== "analytics" && (
            <div className="bg-white border border-slate-200/80 rounded-[28px] overflow-hidden shadow-xs">
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  {leaderboardCategory === "day" && <span>🏆 Overall Day Leaderboard</span>}
                  {leaderboardCategory === "league" && <span>🏸 League (Round-Robin) Standings</span>}
                  {leaderboardCategory === "finals" && <span>🎯 Championship (Finals) Record</span>}
                </div>
                <div className="text-[10px] font-semibold text-slate-400">
                  {displayedLeaderboard.length > 0 ? displayedLeaderboard.length : players.length} active
                </div>
              </div>

              {displayedLeaderboard.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No ranked matches recorded for this range.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {displayedLeaderboard.map((entry, index) => {
                    const isTop1 = index === 0;
                    const isTop2 = index === 1;
                    const isTop3 = index === 2;

  if (!isMounted) return <div className="min-h-full bg-[#f8fafc]"></div>;

                    return (
                      <div
                        key={entry.playerId}
                        className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                          isTop1
                            ? "bg-amber-50/50"
                            : isTop2
                            ? "bg-slate-50/40"
                            : isTop3
                            ? "bg-orange-50/30"
                            : "hover:bg-slate-50"
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
                          <div className="min-w-0 flex flex-col justify-center">
                            <div className="text-xs font-extrabold text-slate-900 truncate leading-tight">
                              {entry.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5 mt-0.5">
                              {leaderboardCategory === "day" && (
                                <span>{entry.finalsWon} finals won • {entry.leagueWins} league wins</span>
                              )}
                              {leaderboardCategory === "league" && (
                                <>
                                  <span>{entry.leagueWins}W - {entry.leagueMatchesPlayed - entry.leagueWins}L</span>
                                  <span>•</span>
                                  <span>{entry.leagueWinRate}% win</span>
                                </>
                              )}
                              {leaderboardCategory === "finals" && (
                                <span>{entry.finalsWon} Won / {entry.finalsPlayed} Played</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Metric Highlights */}
                        <div className="text-right flex flex-col justify-center">
                          <div className="text-sm font-black text-slate-950 leading-tight">
                            {leaderboardCategory === "day" && `${entry.dayPointsTotal} pts`}
                            {leaderboardCategory === "league" && (
                              sortBy === "points" ? `${entry.leaguePoints} pts` :
                              sortBy === "wins" ? `${entry.leagueWins} wins` :
                              `${entry.leagueMatchesPlayed} matches`
                            )}
                            {leaderboardCategory === "finals" && `${entry.finalsWon} wins`}
                          </div>
                          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            {leaderboardCategory === "day" && `Total Day Points`}
                            {leaderboardCategory === "league" && (
                              <>
                                Diff:{" "}
                                <span className={entry.leaguePointDiff > 0 ? "text-emerald-600 font-bold" : entry.leaguePointDiff < 0 ? "text-rose-500 font-bold" : "text-slate-400"}>
                                  {entry.leaguePointDiff > 0 ? `+${entry.leaguePointDiff}` : entry.leaguePointDiff}
                                </span>
                              </>
                            )}
                            {leaderboardCategory === "finals" && `${entry.finalsPlayed} appearances`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Analytics Category */}
          {leaderboardCategory === "analytics" && advancedInsights && displayedLeaderboard.length > 0 && (
            <div className="flex flex-col gap-4">
              {/* Row 1: Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Win Rates Chart */}
                <div className="bg-white border border-slate-200/80 rounded-[28px] p-5 shadow-xs flex flex-col">
                  <h3 className="text-xs font-extrabold text-slate-900 mb-1">Win Rates</h3>
                  <p className="text-[10px] text-slate-400 font-medium mb-4">League vs Finals Performance</p>
                  <div className="overflow-x-auto overflow-y-hidden no-scrollbar w-full h-48">
                    <div style={{ minWidth: `${Math.max(100, advancedInsights.winRateChartData.length * 20)}%`, height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={advancedInsights.winRateChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                          <YAxis hide domain={[0, 100]} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 700 }} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 600 }} />
                          <Bar dataKey="League WR %" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={16} />
                          <Bar dataKey="Finals WR %" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Dominance Index Chart */}
                <div className="bg-white border border-slate-200/80 rounded-[28px] p-5 shadow-xs flex flex-col">
                  <h3 className="text-xs font-extrabold text-slate-900 mb-1">Dominance Index</h3>
                  <p className="text-[10px] text-slate-400 font-medium mb-4">Average point differential per match</p>
                  <div className="overflow-x-auto overflow-y-hidden no-scrollbar w-full h-48">
                    <div style={{ minWidth: `${Math.max(100, advancedInsights.dominanceData.length * 20)}%`, height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={advancedInsights.dominanceData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                          <YAxis hide />
                          <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 700 }} />
                          <Bar dataKey="Avg Diff" radius={[4, 4, 0, 0]} barSize={24}>
                            {
                              advancedInsights.dominanceData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry["Avg Diff"] > 0 ? '#10b981' : '#f43f5e'} />
                              ))
                            }
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Advanced Insights Bento Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Form Guide */}
                <div className="bg-[#FFFBEB] border border-amber-200/80 rounded-[26px] p-4 shadow-xs flex flex-col max-h-64">
                  <div className="flex items-center gap-2 mb-3 shrink-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-sm shadow-2xs">🔥</div>
                    <div>
                      <h3 className="text-xs font-extrabold text-amber-900">Current Form Guide</h3>
                      <p className="text-[10px] text-amber-700 font-semibold">Last 5 matches (Newest first)</p>
                    </div>
                  </div>
                  <div className="space-y-2 overflow-y-auto no-scrollbar flex-1 pr-1 pb-1">
                    {players.map(p => advancedInsights.formMap[p.id] && advancedInsights.formMap[p.id].length > 0 ? (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-white border border-amber-200/50 shadow-2xs">
                        <div className="flex items-center gap-2">
                          <AvatarSVG type={p.avatar} size={28} emoji={p.avatarEmoji} color={p.avatarColor} />
                          <span className="text-xs font-extrabold text-slate-900">{p.name}</span>
                        </div>
                        <div className="flex gap-1">
                          {advancedInsights.formMap[p.id].map((res, i) => (
                            <span key={i} className={`w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-black ${res === "W" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{res}</span>
                          ))}
                        </div>
                      </div>
                    ) : null).filter(Boolean)}
                  </div>
                </div>

                {/* Stat Leaders Grid */}
                <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-[26px] p-4 shadow-xs flex flex-col max-h-64">
                  <div className="flex items-center gap-2 mb-3 shrink-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-200/80 flex items-center justify-center text-sm shadow-2xs">🏅</div>
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-900">Tournament Honors</h3>
                      <p className="text-[10px] text-slate-500 font-semibold">Top performers across categories</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 h-full overflow-y-auto no-scrollbar pb-1">
                    {/* Shutout King */}
                    {advancedInsights.statLeaders.shutoutKing?.shutoutWins > 0 && (
                      <div className="bg-white rounded-2xl p-2.5 border border-slate-100 shadow-2xs flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Shutout King</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-slate-800">{advancedInsights.statLeaders.shutoutKing.name}</span>
                             <span className="text-[10px] font-bold text-blue-500">{advancedInsights.statLeaders.shutoutKing.shutoutWins} shutouts</span>
                           </div>
                           <span className="text-lg opacity-80">🛡️</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Biggest Margin */}
                    {advancedInsights.statLeaders.highestMargin?.highestWinMargin > 0 && (
                      <div className="bg-white rounded-2xl p-2.5 border border-slate-100 shadow-2xs flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Biggest Win</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-slate-800">{advancedInsights.statLeaders.highestMargin.name}</span>
                             <span className="text-[10px] font-bold text-emerald-500">+{advancedInsights.statLeaders.highestMargin.highestWinMargin} margin</span>
                           </div>
                           <span className="text-lg opacity-80">🚀</span>
                        </div>
                      </div>
                    )}

                    {/* Finals Specialist */}
                    {advancedInsights.statLeaders.finalsSpecialist?.finalsWon > 0 && (
                      <div className="bg-white rounded-2xl p-2.5 border border-slate-100 shadow-2xs flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Finals Clutch</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-slate-800">{advancedInsights.statLeaders.finalsSpecialist.name}</span>
                             <span className="text-[10px] font-bold text-amber-500">{advancedInsights.statLeaders.finalsSpecialist.finalsWon} titles</span>
                           </div>
                           <span className="text-lg opacity-80">🏆</span>
                        </div>
                      </div>
                    )}

                    {/* Iron Man */}
                    {advancedInsights.statLeaders.ironMan && (
                      <div className="bg-white rounded-2xl p-2.5 border border-slate-100 shadow-2xs flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Iron Man</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-slate-800">{advancedInsights.statLeaders.ironMan.name}</span>
                             <span className="text-[10px] font-bold text-indigo-500">{advancedInsights.statLeaders.ironMan.leagueMatchesPlayed + advancedInsights.statLeaders.ironMan.finalsPlayed} played</span>
                           </div>
                           <span className="text-lg opacity-80">🔋</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Day Champions & Day Last-Place Hall of Fame Bento Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Day Champions Card */}
            <div className="bg-[#FFFBEB] border border-amber-200/80 rounded-[26px] p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-sm shadow-2xs">
                  👑
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900">Day Champions</h3>
                  <p className="text-[10px] text-amber-700 font-semibold">Most daily 1st place finishes</p>
                </div>
              </div>

              {displayedDayHonors?.dayChampions && displayedDayHonors.dayChampions.length > 0 ? (
                <div className="space-y-2">
                  {displayedDayHonors.dayChampions.slice(0, 3).map((c) => (
                    <div
                      key={c.playerId}
                      className="flex items-center justify-between p-2 rounded-xl bg-white border border-amber-200/50 shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <AvatarSVG type={c.avatar} size={28} emoji={c.emoji} color={c.color} />
                        <span className="text-xs font-extrabold text-slate-900">{c.name}</span>
                      </div>
                      <div className="px-2.5 py-0.5 bg-amber-100 rounded-full text-[10px] font-extrabold text-amber-800">
                        {c.count} {c.count === 1 ? "Day" : "Days"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 text-center py-4">
                  Close a day table to crown day champions!
                </div>
              )}
            </div>

            {/* Day Last Place Card */}
            <div className="bg-[#FFF1F2] border border-rose-200/80 rounded-[26px] p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center text-sm shadow-2xs">
                  🥄
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900">Wooden Spoon</h3>
                  <p className="text-[10px] text-rose-700 font-semibold">Most daily last-place finishes</p>
                </div>
              </div>

              {displayedDayHonors?.dayLastPlaces && displayedDayHonors.dayLastPlaces.length > 0 ? (
                <div className="space-y-2">
                  {displayedDayHonors.dayLastPlaces.slice(0, 3).map((c) => (
                    <div
                      key={c.playerId}
                      className="flex items-center justify-between p-2 rounded-xl bg-white border border-rose-200/50 shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <AvatarSVG type={c.avatar} size={28} emoji={c.emoji} color={c.color} />
                        <span className="text-xs font-extrabold text-slate-900">{c.name}</span>
                      </div>
                      <div className="px-2.5 py-0.5 bg-rose-100 rounded-full text-[10px] font-extrabold text-rose-800">
                        {c.count} {c.count === 1 ? "Day" : "Days"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 text-center py-4">
                  No last place finishes recorded yet.
                </div>
              )}
            </div>
          </div>

          {/* Day by Day History */}
          {dayHonors?.history && dayHonors.history.length > 0 && (
            <div className="bg-white border border-slate-200/80 rounded-[26px] p-4 space-y-2 shadow-xs">
              <h4 className="text-xs font-extrabold text-slate-900">📅 Day Results Archive</h4>
              <div className="divide-y divide-slate-100">
                {dayHonors.history.map((h) => (
                  <div key={h.id} className="py-2.5 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-400 text-xs font-bold">{h.date}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-700 font-bold flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full">
                        👑 {h.topPlayerName}
                      </span>
                      <span className="text-rose-700 font-bold flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-full">
                        🥄 {h.bottomPlayerName}
                      </span>
                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => setDayToDelete(h.date)}
                          title={`Delete Day Result for ${h.date}`}
                          className="w-6 h-6 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors flex items-center justify-center cursor-pointer text-xs ml-1"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {tournamentToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-white border border-slate-200/80 rounded-[32px] p-6 shadow-2xl space-y-4 text-slate-900"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center text-xl text-red-600 shadow-2xs">
                  🗑️
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Delete Tournament?</h2>
                  <p className="text-[11px] text-slate-400 font-medium">Remove accidental or test match</p>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                This will permanently delete this tournament and its matches, and automatically recalculate player points and day standings.
              </p>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setTournamentToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTournament(tournamentToDelete)}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-xs font-extrabold text-white shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? <span>Deleting...</span> : <span>Delete</span>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Day Confirmation Modal */}
      <AnimatePresence>
        {dayToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-white border border-slate-200/80 rounded-[32px] p-6 shadow-2xl space-y-4 text-slate-900"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 flex items-center justify-center text-xl text-rose-600 shadow-2xs">
                  🗑️
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Delete Day Table?</h2>
                  <p className="text-[11px] text-slate-400 font-medium">{dayToDelete}</p>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                This will permanently delete the day table, all tournaments, matches, and day champions for {dayToDelete}.
              </p>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDayToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteDay(dayToDelete)}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-xs font-extrabold text-white shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? <span>Deleting...</span> : <span>Delete Day</span>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Filter Bottom Sheet Menu */}
      <AnimatePresence>
        {showFilterMenu && (
          <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilterMenu(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              className="relative z-10 w-full max-w-md bg-white border-t border-slate-200/80 rounded-t-[36px] shadow-2xl pb-8 pt-4 px-5 space-y-4 max-h-[82vh] overflow-y-auto"
            >
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" />

              {/* Sheet Header */}
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900">Filter History</h3>
                  <p className="text-xs text-slate-400 font-medium">Customize matches & stats view</p>
                </div>
                <div className="flex items-center gap-2">
                  {hasActiveFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setRangeFilter("all");
                        setPlayerFilter("all");
                        setPatternFilter("all");
                      }}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                    >
                      Reset All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowFilterMenu(false)}
                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* 1. Time Range */}
              <div>
                <label className="block text-[11px] uppercase font-black tracking-wider text-slate-400 mb-2">
                  📅 Time Range
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {rangeOptions.map((opt) => {
                    const selected = rangeFilter === opt.value;
  if (!isMounted) return <div className="min-h-full bg-[#f8fafc]"></div>;

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRangeFilter(opt.value as any)}
                        className={`py-2 px-1 text-center text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                          selected
                            ? "bg-slate-950 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Player Filter */}
              <div>
                <label className="block text-[11px] uppercase font-black tracking-wider text-slate-400 mb-2">
                  👤 Squad Players
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setPlayerFilter("all")}
                    className={`py-1.5 px-3 text-xs font-extrabold rounded-full transition-all cursor-pointer ${
                      playerFilter === "all"
                        ? "bg-slate-950 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    All Players
                  </button>
                  {players.map((p) => {
                    const selected = playerFilter === p.id;
  if (!isMounted) return <div className="min-h-full bg-[#f8fafc]"></div>;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlayerFilter(p.id)}
                        className={`py-1 px-2.5 text-xs font-extrabold rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                          selected
                            ? "bg-slate-950 text-white shadow-xs ring-1 ring-slate-950"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        <AvatarSVG type={p.avatar} size={20} emoji={p.avatarEmoji} color={p.avatarColor} />
                        <span>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Match Pattern */}
              <div>
                <label className="block text-[11px] uppercase font-black tracking-wider text-slate-400 mb-2">
                  🎯 Match Outcome / Score
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {patternOptions.map((opt) => {
                    const selected = patternFilter === opt.value;
  if (!isMounted) return <div className="min-h-full bg-[#f8fafc]"></div>;

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPatternFilter(opt.value)}
                        className={`py-1.5 px-3 text-xs font-extrabold rounded-full transition-all cursor-pointer ${
                          selected
                            ? "bg-slate-950 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Apply Button */}
              <button
                type="button"
                onClick={() => setShowFilterMenu(false)}
                className="w-full py-3.5 bg-slate-950 hover:bg-slate-800 text-white font-black text-sm rounded-2xl shadow-xl shadow-slate-950/20 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Apply & View Matches</span>
                <span className="text-white/60 font-medium">({displayedHistory.totalMatches})</span>
                <span>✓</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scorekeeper PIN Modal */}
      <PinModal
        open={showPinModal}
        onClose={() => {
          setShowPinModal(false);
          setTargetIdForPin(null);
        }}
        onSuccess={() => {
          setShowPinModal(false);
          if (pinAction === "day" && targetIdForPin) {
            handleDeleteDay(targetIdForPin);
          } else if (tournamentToDelete) {
            handleDeleteTournament(tournamentToDelete);
          } else if (targetIdForPin) {
            handleDeleteTournament(targetIdForPin);
          }
          setTargetIdForPin(null);
        }}
      />
    </div>
  );
}
