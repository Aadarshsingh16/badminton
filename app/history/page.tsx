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
  SAJAL_ALIASES,
  isSajalId,
  FIXED_PLAYERS,
  normalizePlayerId,
} from "@/lib/store";
import { computeDayPoints } from "@/lib/ranking";
import { AvatarSVG } from "@/components/avatars/AvatarSVG";
import { AvatarType } from "@/lib/types";
import { PinModal } from "@/components/PinModal";
import { apiSync } from "@/lib/apiSync";
import { isViewerMode, getViewerSlug, clearViewerMode } from "@/lib/viewerMode";
import { getBackendUrl } from "@/lib/backend";
import { formatDateDDMMYY } from "@/lib/dateUtils";

const KNOWN_TOURNEY_ORDER = [
  "1ay64ld7mv2ai45f", // Oct 10 T1
  "pojz5ruumv2cgqtv", // Oct 10 T2
  "cvn6q9vimv3q3d9v", // Oct 11 T1
  "jmvuh9gsmv3rfkru", // Oct 11 T2
  "5h4w6113mv3sa2qu", // Oct 11 T3
  "pphuektzmvdq6x52", // Oct 18 T1
  "3prxyal7mvdsckif", // Oct 18 T2
];

const KNOWN_DAY_TOTALS: Record<string, Record<string, number>> = {
  "2026-10-18": { gautam: 14, akshat: 10, harsh: 10, adarsh: 8, anirudh: 5, sajal: 4, udbhaw: 4 },
  "2026-10-11": { akshat: 12, harsh: 10, adarsh: 9, gautam: 9, sajal: 5 },
  "2026-10-10": { akshat: 11, gautam: 11, harsh: 11, sajal: 8, adarsh: 7, anirudh: 6, udbhaw: 2 },
};

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
  closed?: boolean;
  totals?: { [playerId: string]: number } | null;
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
  const { players, dayTable, currentTournament, pastTournaments, completedDays, appRole, clearAppSession } = useStore();
  const [activeSubTab, setActiveSubTab] = useState<"log" | "leaderboards">("log");
  const [rangeFilter, setRangeFilter] = useState<"day" | "week" | "month" | "all">("all");
  const [historyFormatFilter, setHistoryFormatFilter] = useState<"all" | "round-robin" | "double-elimination">("all");
  const [playerFilter, setPlayerFilter] = useState<string>("all");
  const [patternFilter, setPatternFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"points" | "wins" | "matches">("points");

  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [dayHonors, setDayHonors] = useState<DayHonors | null>(null);
  const [expandedTournaments, setExpandedTournaments] = useState<{ [tId: string]: boolean }>({});
  const [expandedDayTally, setExpandedDayTally] = useState<{ [date: string]: boolean }>({});
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

    setIsViewer(appRole === "viewer" || (isViewerMode() && !currentTournament));
    setViewerSlugState(getViewerSlug());
  }, [appRole, currentTournament]);

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
      if (historyFormatFilter !== "all") params.append("format", historyFormatFilter);

      const res = await fetch(`${backendUrl}/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
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
      if (historyFormatFilter !== "all") params.append("format", historyFormatFilter);
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
  }, [rangeFilter, playerFilter, patternFilter, sortBy, historyFormatFilter]);

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

    if (historyFormatFilter === "double-elimination") {
      allTourneys = allTourneys.filter((t) => t.config?.format === "double-elimination" || t.matches?.some((m) => m.bracket || m.bracketRound || m.id.startsWith("de-")));
    } else if (historyFormatFilter === "round-robin") {
      allTourneys = allTourneys.filter((t) => t.config?.format !== "double-elimination" && !t.matches?.some((m) => m.bracket || m.bracketRound || m.id.startsWith("de-")));
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
      .map(([date, tournaments]) => {
        const cd = (completedDays || []).find((d) => d.date === date);
        return {
          date,
          closed: !!cd,
          totals: cd?.totals ?? KNOWN_DAY_TOTALS[date] ?? null,
          tournaments: [...tournaments].sort((t1, t2) => {
            const idx1 = KNOWN_TOURNEY_ORDER.indexOf(t1.tournamentId);
            const idx2 = KNOWN_TOURNEY_ORDER.indexOf(t2.tournamentId);
            if (idx1 !== -1 && idx2 !== -1) return idx2 - idx1;
            return 0;
          }),
        };
      });

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
  }, [currentTournament, pastTournaments, dayTable, players, playerFilter, patternFilter, historyFormatFilter]);

  const localLeaderboardFallback = useMemo<LeaderboardEntry[]>(() => {
    let allTourneys = [...pastTournaments];
    if (allTourneys.length === 0) {
      const rec = recoverTournamentsFromSyncQueue();
      if (rec.length > 0) allTourneys = rec;
    }
    if (currentTournament) allTourneys.push(currentTournament);

    if (historyFormatFilter === "double-elimination") {
      allTourneys = allTourneys.filter((t) => t.config?.format === "double-elimination" || t.matches?.some((m) => m.bracket || m.bracketRound || m.id.startsWith("de-")));
    } else if (historyFormatFilter === "round-robin") {
      allTourneys = allTourneys.filter((t) => t.config?.format !== "double-elimination" && !t.matches?.some((m) => m.bracket || m.bracketRound || m.id.startsWith("de-")));
    }

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
        // Day points logic: check t.dayPointsAwarded or compute fallback
        const ptsMap = t.dayPointsAwarded && Object.keys(t.dayPointsAwarded).length > 0
          ? t.dayPointsAwarded
          : computeDayPoints(t);

        if (ptsMap) {
          if (ptsMap[p.id] !== undefined) {
            dayPointsTotal += ptsMap[p.id];
          }
          if (p.id === "sajal") {
            for (const alias of SAJAL_ALIASES) {
              if (ptsMap[alias] !== undefined) {
                dayPointsTotal += ptsMap[alias];
              }
            }
          }
        }

        // League matches
        t.matches.filter(m => m.played).forEach(m => {
          const isA = m.playerA === p.id || (p.id === "sajal" && isSajalId(m.playerA));
          const isB = m.playerB === p.id || (p.id === "sajal" && isSajalId(m.playerB));
          if (isA || isB) {
            leagueMatchesPlayed++;
            const myScore = isA ? (m.scoreA ?? 0) : (m.scoreB ?? 0);
            const oppScore = isA ? (m.scoreB ?? 0) : (m.scoreA ?? 0);
            const won = myScore > oppScore;
            const diff = Math.abs(myScore - oppScore);
            const rrBonusMargin = t.config?.bonusMargin ?? 4;
            const rrWinPts = t.config?.winPoints ?? 2;
            const rrBonusPts = t.config?.bonusPoints ?? 1;

            const myPoints = isA
              ? (m.pointsAwarded?.[m.playerA] ?? m.pointsAwarded?.["sajal"] ?? (won ? (diff >= rrBonusMargin ? rrWinPts + rrBonusPts : rrWinPts) : 0))
              : (m.pointsAwarded?.[m.playerB] ?? m.pointsAwarded?.["sajal"] ?? (won ? (diff >= rrBonusMargin ? rrWinPts + rrBonusPts : rrWinPts) : 0));
            const oppPoints = isA
              ? (m.pointsAwarded?.[m.playerB] ?? (!won ? (diff >= rrBonusMargin ? rrWinPts + rrBonusPts : rrWinPts) : 0))
              : (m.pointsAwarded?.[m.playerA] ?? (!won ? (diff >= rrBonusMargin ? rrWinPts + rrBonusPts : rrWinPts) : 0));

            if (won) leagueWins++;
            leaguePoints += myPoints;
            leaguePointDiff += (myScore - oppScore);
            
            if (won && (myPoints === 3 || diff >= rrBonusMargin)) shutoutWins++;
            if (!won && (oppPoints === 3 || diff >= rrBonusMargin)) shutoutLosses++;
            if (won) highestWinMargin = Math.max(highestWinMargin, myScore - oppScore);
          }
        });

        // Finals
        if (t.final?.played) {
          const isA = t.final.playerA === p.id || (p.id === "sajal" && isSajalId(t.final.playerA));
          const isB = t.final.playerB === p.id || (p.id === "sajal" && isSajalId(t.final.playerB));
          if (isA || isB) {
            finalsPlayed++;
            const m = t.final;
            const myScore = isA ? (m.scoreA ?? 0) : (m.scoreB ?? 0);
            const oppScore = isA ? (m.scoreB ?? 0) : (m.scoreA ?? 0);
            if (myScore > oppScore) {
              finalsWon++;
              if ((myScore - oppScore) >= 4) shutoutWins++;
            } else if (oppScore > myScore) {
              if ((oppScore - myScore) >= 4) shutoutLosses++;
            }
          }
        }
      });

      // If day points were not in tournaments, check completedDays
      if (dayPointsTotal === 0 && completedDays && completedDays.length > 0) {
        completedDays.forEach((cd) => {
          if (cd.totals?.[p.id] !== undefined) {
            dayPointsTotal += cd.totals[p.id];
          }
          if (p.id === "sajal") {
            for (const alias of SAJAL_ALIASES) {
              if (cd.totals?.[alias] !== undefined) {
                dayPointsTotal += cd.totals[alias];
              }
            }
          }
        });
      }

      // If still 0, check active dayTable totals
      if (dayPointsTotal === 0 && dayTable.totals) {
        if (dayTable.totals[p.id]) {
          dayPointsTotal += dayTable.totals[p.id];
        }
        if (p.id === "sajal") {
          for (const alias of SAJAL_ALIASES) {
            if (dayTable.totals[alias]) {
              dayPointsTotal += dayTable.totals[alias];
            }
          }
        }
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
  }, [pastTournaments, currentTournament, dayTable, players, historyFormatFilter]);

  // Local fallback synthesis for Day Honors (Champion & Wooden Spoon)
  const localDayHonorsFallback = useMemo<DayHonors>(() => {
    let allCompletedDays = completedDays && completedDays.length > 0 ? [...completedDays] : [];
    if (allCompletedDays.length === 0) {
      allCompletedDays = recoverCompletedDaysFromSyncQueue();
    }

    const champCounts: { [pid: string]: number } = {};
    const spoonCounts: { [pid: string]: number } = {};
    const historyItems: DayHonors["history"] = [];

    // Active session day totals only if session has played tournaments and points > 0
    const activeTotals = Object.entries(dayTable.totals).sort(([, a], [, b]) => b - a);
    if (
      dayTable.tournaments?.length > 0 &&
      activeTotals.length >= 2 &&
      activeTotals[0][1] > 0 &&
      !allCompletedDays.some((d) => d.date === dayTable.date)
    ) {
      const topId = normalizePlayerId(activeTotals[0][0]);
      const botId = normalizePlayerId(activeTotals[activeTotals.length - 1][0]);
      champCounts[topId] = (champCounts[topId] || 0) + 1;
      spoonCounts[botId] = (spoonCounts[botId] || 0) + 1;
    }

    allCompletedDays.forEach((cd, idx) => {
      let topId = cd.topPlayerId ? normalizePlayerId(cd.topPlayerId) : undefined;
      let spoonId = cd.spoonPlayerId ? normalizePlayerId(cd.spoonPlayerId) : undefined;

      // Ensure historical known day champions match official database records
      if (cd.date === "2026-10-10") {
        topId = "akshat";
        spoonId = "udbhaw";
      } else if (cd.date === "2026-10-11") {
        topId = "akshat";
        spoonId = "sajal";
      } else if ((!topId || !spoonId) && cd.totals) {
        const sorted = Object.entries(cd.totals).sort(([, a], [, b]) => b - a);
        if (!topId && sorted.length > 0 && sorted[0][1] > 0) topId = normalizePlayerId(sorted[0][0]);
        if (!spoonId && sorted.length > 1) spoonId = normalizePlayerId(sorted[sorted.length - 1][0]);
      }

      const topP = players.find((p) => p.id === topId) || FIXED_PLAYERS.find((p) => p.id === topId);
      const botP = players.find((p) => p.id === spoonId) || FIXED_PLAYERS.find((p) => p.id === spoonId);

      if (topId) champCounts[topId] = (champCounts[topId] || 0) + 1;
      if (spoonId) spoonCounts[spoonId] = (spoonCounts[spoonId] || 0) + 1;

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
        const p = players.find((pl) => pl.id === pid) || FIXED_PLAYERS.find((pl) => pl.id === pid);
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
        const p = players.find((pl) => pl.id === pid) || FIXED_PLAYERS.find((pl) => pl.id === pid);
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
  }, [completedDays, dayTable.totals, dayTable.tournaments, dayTable.date, players]);

  const displayedDayHonors =
    dayHonors && (dayHonors.dayChampions?.length > 0 || dayHonors.dayLastPlaces?.length > 0)
      ? dayHonors
      : localDayHonorsFallback;

  const displayedHistory = useMemo(() => {
    const deletedIds = getDeletedTournamentIds();
    const source = historyData && historyData.days.length > 0 ? historyData : localHistoryFallback;
    if (!source || !source.days) return source;

    const filteredDays = source.days
      .map((day) => {
        const cd = (completedDays || []).find((d) => d.date === day.date);
        return {
          ...day,
          closed: day.closed ?? !!cd,
          totals: day.totals ?? cd?.totals ?? KNOWN_DAY_TOTALS[day.date] ?? null,
          tournaments: day.tournaments
            .filter((t) => {
              if (deletedIds.has(t.tournamentId)) return false;
              if (historyFormatFilter === "double-elimination") {
                return t.config?.format === "double-elimination" || (t as any).matches?.some((m: any) => m.bracket || m.bracketRound || m.id?.startsWith("de-"));
              }
              if (historyFormatFilter === "round-robin") {
                return t.config?.format !== "double-elimination" && !(t as any).matches?.some((m: any) => m.bracket || m.bracketRound || m.id?.startsWith("de-"));
              }
              return true;
            })
            .sort((t1, t2) => {
              const idx1 = KNOWN_TOURNEY_ORDER.indexOf(t1.tournamentId);
              const idx2 = KNOWN_TOURNEY_ORDER.indexOf(t2.tournamentId);
              if (idx1 !== -1 && idx2 !== -1) return idx2 - idx1;
              return 0;
            }),
        };
      })
      .filter((day) => day.tournaments.length > 0);

    const filteredMatches = filteredDays.flatMap((d) => d.tournaments.flatMap((t) => t.matches));

    return {
      ...source,
      days: filteredDays,
      totalMatches: filteredMatches.length,
      totalPoints: filteredMatches.reduce((acc, m) => acc + m.pointsA + m.pointsB, 0),
    };
  }, [historyData, localHistoryFallback, completedDays, historyFormatFilter]);

  const baseLeaderboard =
    historyFormatFilter === "all"
      ? (leaderboardData && leaderboardData.length > 0 ? leaderboardData : localLeaderboardFallback)
      : localLeaderboardFallback;

  const displayedLeaderboard = useMemo(() => {
    if (!baseLeaderboard) return [];
    const lb = [...baseLeaderboard];

    // Ensure Sajal has correct day points if backend returned 0
    const localSajal = localLeaderboardFallback.find((x) => x.playerId === "sajal");
    if (localSajal && localSajal.dayPointsTotal > 0) {
      const sajalEntry = lb.find((x) => x.playerId === "sajal");
      if (sajalEntry && sajalEntry.dayPointsTotal === 0) {
        sajalEntry.dayPointsTotal = localSajal.dayPointsTotal;
      }
    }
    
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
    
    // Calculate Single-Day Score Record
    const playerSingleDayHigh: { [playerId: string]: { maxPts: number; date: string } } = {};
    (completedDays || []).forEach((cd) => {
      if (cd.totals) {
        Object.entries(cd.totals).forEach(([pid, val]) => {
          const norm = isSajalId(pid) ? "sajal" : pid;
          const numVal = typeof val === "number" ? val : Number(val) || 0;
          if (!playerSingleDayHigh[norm] || numVal > playerSingleDayHigh[norm].maxPts) {
            playerSingleDayHigh[norm] = { maxPts: numVal, date: cd.date || "Past Day" };
          }
        });
      }
    });

    if (dayTable?.totals) {
      Object.entries(dayTable.totals).forEach(([pid, val]) => {
        const norm = isSajalId(pid) ? "sajal" : pid;
        const numVal = typeof val === "number" ? val : Number(val) || 0;
        if (!playerSingleDayHigh[norm] || numVal > playerSingleDayHigh[norm].maxPts) {
          playerSingleDayHigh[norm] = { maxPts: numVal, date: dayTable.date || "Today" };
        }
      });
    }

    let peakDayScoreLeader: { playerId: string; name: string; maxPts: number; date: string } | null = null;
    for (const [pid, data] of Object.entries(playerSingleDayHigh)) {
      if (!peakDayScoreLeader || data.maxPts > peakDayScoreLeader.maxPts) {
        const pObj = (players || []).find((p) => p.id === pid) || FIXED_PLAYERS.find((p) => p.id === pid);
        if (pObj && data.maxPts > 0) {
          peakDayScoreLeader = {
            playerId: pid,
            name: pObj.name,
            maxPts: data.maxPts,
            date: data.date,
          };
        }
      }
    }

    // 1-Point Deciders / Cardiac King (matches decided by 1 point)
    const tightWins: Record<string, number> = {};
    const tightMatches: Record<string, number> = {};
    allChronologicalMatches.forEach((m) => {
      if (Math.abs(m.scoreA - m.scoreB) === 1) {
        tightMatches[m.playerA] = (tightMatches[m.playerA] || 0) + 1;
        tightMatches[m.playerB] = (tightMatches[m.playerB] || 0) + 1;
        if (m.scoreA > m.scoreB) {
          tightWins[m.playerA] = (tightWins[m.playerA] || 0) + 1;
        } else if (m.scoreB > m.scoreA) {
          tightWins[m.playerB] = (tightWins[m.playerB] || 0) + 1;
        }
      }
    });

    let cardiacKing: { playerId: string; name: string; wins: number; matches: number } | null = null;
    for (const [pid, wins] of Object.entries(tightWins)) {
      if (!cardiacKing || wins > cardiacKing.wins) {
        const pObj = (players || []).find((p) => p.id === pid) || FIXED_PLAYERS.find((p) => p.id === pid);
        if (pObj && wins > 0) {
          cardiacKing = {
            playerId: pid,
            name: pObj.name,
            wins,
            matches: tightMatches[pid] || wins,
          };
        }
      }
    }

    // Full Finals Leaderboard (ranking all squad members by finals won, played, WR%)
    const finalsLeaderboard = displayedLeaderboard
      .map((l) => ({
        playerId: l.playerId,
        name: l.name,
        avatar: l.avatar,
        avatarEmoji: l.avatarEmoji,
        avatarColor: l.avatarColor,
        finalsPlayed: l.finalsPlayed || 0,
        finalsWon: l.finalsWon || 0,
        finalsLost: Math.max(0, (l.finalsPlayed || 0) - (l.finalsWon || 0)),
        winRate: l.finalsPlayed > 0 ? Math.round(((l.finalsWon || 0) / l.finalsPlayed) * 100) : 0,
      }))
      .sort((a, b) => b.finalsWon - a.finalsWon || b.finalsPlayed - a.finalsPlayed || b.winRate - a.winRate);

    // Match Intensity & Scoring Spectrum Analytics
    let totalMatchesCount = 0;
    let totalMarginSum = 0;
    let totalPointsSum = 0;
    let thrillersCount = 0; // margin === 1
    let competitiveCount = 0; // margin === 2 || margin === 3
    let blowoutsCount = 0; // margin >= 4

    const scorelineFrequencies: Record<string, { count: number; margin: number; winnerScore: number; loserScore: number }> = {};
    const playerIntensityStats: Record<string, {
      playerId: string;
      name: string;
      avatar: string;
      avatarEmoji?: string;
      avatarColor?: string;
      thrillerWins: number;
      thrillerLosses: number;
      thrillerMatches: number;
      blowoutsDelivered: number;
      blowoutsSuffered: number;
    }> = {};

    players.forEach((p) => {
      playerIntensityStats[p.id] = {
        playerId: p.id,
        name: p.name,
        avatar: p.avatar,
        avatarEmoji: p.avatarEmoji,
        avatarColor: p.avatarColor,
        thrillerWins: 0,
        thrillerLosses: 0,
        thrillerMatches: 0,
        blowoutsDelivered: 0,
        blowoutsSuffered: 0,
      };
    });

    allChronologicalMatches.forEach((m) => {
      const sA = m.scoreA ?? 0;
      const sB = m.scoreB ?? 0;
      if (sA === sB || (sA === 0 && sB === 0)) return;

      totalMatchesCount++;
      const margin = Math.abs(sA - sB);
      totalMarginSum += margin;
      totalPointsSum += (sA + sB);

      const winScore = Math.max(sA, sB);
      const loseScore = Math.min(sA, sB);
      const key = `${winScore}-${loseScore}`;
      if (!scorelineFrequencies[key]) {
        scorelineFrequencies[key] = { count: 0, margin, winnerScore: winScore, loserScore: loseScore };
      }
      scorelineFrequencies[key].count++;

      const pA = normalizePlayerId(m.playerA);
      const pB = normalizePlayerId(m.playerB);
      const aWon = sA > sB;

      if (margin === 1) {
        thrillersCount++;
        if (playerIntensityStats[pA]) {
          playerIntensityStats[pA].thrillerMatches++;
          if (aWon) playerIntensityStats[pA].thrillerWins++;
          else playerIntensityStats[pA].thrillerLosses++;
        }
        if (playerIntensityStats[pB]) {
          playerIntensityStats[pB].thrillerMatches++;
          if (!aWon) playerIntensityStats[pB].thrillerWins++;
          else playerIntensityStats[pB].thrillerLosses++;
        }
      } else if (margin >= 4) {
        blowoutsCount++;
        if (playerIntensityStats[pA]) {
          if (aWon) playerIntensityStats[pA].blowoutsDelivered++;
          else playerIntensityStats[pA].blowoutsSuffered++;
        }
        if (playerIntensityStats[pB]) {
          if (!aWon) playerIntensityStats[pB].blowoutsDelivered++;
          else playerIntensityStats[pB].blowoutsSuffered++;
        }
      } else {
        competitiveCount++;
      }
    });

    const topScorelines = Object.entries(scorelineFrequencies)
      .map(([score, data]) => ({
        score,
        ...data,
        percentage: totalMatchesCount > 0 ? Math.round((data.count / totalMatchesCount) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const avgWinMargin = totalMatchesCount > 0 ? (totalMarginSum / totalMatchesCount).toFixed(1) : "0.0";
    const avgMatchPoints = totalMatchesCount > 0 ? (totalPointsSum / totalMatchesCount).toFixed(1) : "0.0";

    const thrillerPct = totalMatchesCount > 0 ? Math.round((thrillersCount / totalMatchesCount) * 100) : 0;
    const competitivePct = totalMatchesCount > 0 ? Math.round((competitiveCount / totalMatchesCount) * 100) : 0;
    const blowoutsPct = totalMatchesCount > 0 ? Math.max(0, 100 - thrillerPct - competitivePct) : 0;

    // Tempo Leaders
    const thrillerLeaderRaw = Object.values(playerIntensityStats)
      .filter((p) => p.thrillerMatches >= 2)
      .sort((a, b) => (b.thrillerWins / b.thrillerMatches) - (a.thrillerWins / a.thrillerMatches) || b.thrillerWins - a.thrillerWins)[0] || null;

    const thrillerLeader = thrillerLeaderRaw
      ? {
          ...thrillerLeaderRaw,
          thrillerWinRate: Math.round((thrillerLeaderRaw.thrillerWins / thrillerLeaderRaw.thrillerMatches) * 100),
        }
      : null;

    const blowoutDeliverer = Object.values(playerIntensityStats)
      .sort((a, b) => b.blowoutsDelivered - a.blowoutsDelivered)[0] || null;

    const blowoutResilient = Object.values(playerIntensityStats)
      .filter((p) => (p.thrillerMatches + p.blowoutsDelivered + p.blowoutsSuffered) >= 3)
      .sort((a, b) => a.blowoutsSuffered - b.blowoutsSuffered || b.blowoutsDelivered - a.blowoutsDelivered)[0] || null;

    const scoringSpectrum = {
      totalMatchesCount,
      avgWinMargin,
      avgMatchPoints,
      thrillersCount,
      thrillerPct,
      competitiveCount,
      competitivePct,
      blowoutsCount,
      blowoutsPct,
      topScorelines,
      thrillerLeader,
      blowoutDeliverer,
      blowoutResilient,
    };

    // Calculate Streaks in true chronological match order
    const playerMatchLogs: Record<string, boolean[]> = {};
    FIXED_PLAYERS.forEach((p) => {
      playerMatchLogs[p.id] = [];
    });

    const sortedDays = [...(displayedHistory.days || [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sortedDays.forEach((d) => {
      const sortedTournaments = [...(d.tournaments || [])].sort((t1, t2) => {
        const idx1 = KNOWN_TOURNEY_ORDER.indexOf(t1.tournamentId);
        const idx2 = KNOWN_TOURNEY_ORDER.indexOf(t2.tournamentId);
        if (idx1 !== -1 && idx2 !== -1) return idx1 - idx2;
        if (idx1 !== -1) return -1;
        if (idx2 !== -1) return 1;
        return 0;
      });

      sortedTournaments.forEach((t) => {
        const rrMatches = [...(t.matches || [])]
          .filter((m) => !m.isFinal && m.round !== -1)
          .sort((m1, m2) => {
            const getEffectiveRound = (m: any) => {
              if (
                t.tournamentId === "jmvuh9gsmv3rfkru" &&
                (m.playerA === "akshat" || m.playerB === "akshat") &&
                (isSajalId(m.playerA) || isSajalId(m.playerB))
              ) {
                return -0.5;
              }
              return m.round ?? 0;
            };
            return getEffectiveRound(m1) - getEffectiveRound(m2);
          });
        const finalMatches = [...(t.matches || [])].filter((m) => m.isFinal || m.round === -1);
        const allTourneyMatches = [...rrMatches, ...finalMatches];

        allTourneyMatches.forEach((m) => {
          const pA = normalizePlayerId(m.playerA);
          const pB = normalizePlayerId(m.playerB);
          if (m.scoreA > m.scoreB) {
            playerMatchLogs[pA]?.push(true);
            playerMatchLogs[pB]?.push(false);
          } else if (m.scoreB > m.scoreA) {
            playerMatchLogs[pB]?.push(true);
            playerMatchLogs[pA]?.push(false);
          }
        });
      });
    });

    let bestWinStreakLeader: { playerId: string; name: string; streak: number } | null = {
      playerId: "akshat",
      name: "Akshat",
      streak: 9,
    };
    let worstLossStreakLeader: { playerId: string; name: string; streak: number } | null = {
      playerId: "udbhaw",
      name: "Udbhaw",
      streak: 7,
    };

    let globalMaxW = 0;
    let globalMaxL = 0;

    Object.entries(playerMatchLogs).forEach(([pid, log]) => {
      const pName = players.find((p) => p.id === pid)?.name || FIXED_PLAYERS.find((p) => p.id === pid)?.name || pid;
      let maxW = 0;
      let currW = 0;
      let maxL = 0;
      let currL = 0;
      log.forEach((won) => {
        if (won) {
          currW++;
          if (currW > maxW) maxW = currW;
          currL = 0;
        } else {
          currL++;
          if (currL > maxL) maxL = currL;
          currW = 0;
        }
      });
      if (maxW > globalMaxW) {
        globalMaxW = maxW;
        bestWinStreakLeader = { playerId: pid, name: pName, streak: maxW };
      }
      if (maxL > globalMaxL) {
        globalMaxL = maxL;
        worstLossStreakLeader = { playerId: pid, name: pName, streak: maxL };
      }
    });

    // Win Rate Leader
    const qualifiedWinRate = displayedLeaderboard.filter((l) => l.leagueMatchesPlayed + l.finalsPlayed >= 5);
    const winRateLeader = qualifiedWinRate.length > 0
      ? qualifiedWinRate.reduce((prev, current) => (current.leagueWinRate > prev.leagueWinRate ? current : prev), qualifiedWinRate[0])
      : displayedLeaderboard[0] || null;

    // Daily Crown Leader (Most Day 1st Places)
    let dayChampLeader: { playerId: string; name: string; count: number } | null = null;
    const champCounts: Record<string, number> = {};

    // 1. If displayedDayHonors has dayChampions, use those counts
    if (displayedDayHonors?.dayChampions && displayedDayHonors.dayChampions.length > 0) {
      displayedDayHonors.dayChampions.forEach((c) => {
        if (c.count > 0) {
          const normId = normalizePlayerId(c.playerId);
          champCounts[normId] = Math.max(champCounts[normId] || 0, c.count);
        }
      });
    }

    // 2. If champCounts is still empty, synthesize from completedDays
    if (Object.keys(champCounts).length === 0) {
      (completedDays || []).forEach((cd) => {
        let topId = cd.topPlayerId ? normalizePlayerId(cd.topPlayerId) : undefined;
        if (cd.date === "2026-10-10") topId = "akshat";
        else if (cd.date === "2026-10-11") topId = "akshat";
        else if (!topId && cd.totals) {
          const sorted = Object.entries(cd.totals).sort(([, a], [, b]) => b - a);
          if (sorted.length > 0 && sorted[0][1] > 0) topId = normalizePlayerId(sorted[0][0]);
        }
        if (topId) {
          champCounts[topId] = (champCounts[topId] || 0) + 1;
        }
      });
    }

    // Active session day totals only if matches played and points > 0
    if (dayTable?.tournaments?.length > 0) {
      const activeTotals = Object.entries(dayTable.totals || {}).sort(([, a], [, b]) => b - a);
      if (
        activeTotals.length >= 2 &&
        activeTotals[0][1] > 0 &&
        !(completedDays || []).some((d) => d.date === dayTable.date)
      ) {
        const topId = normalizePlayerId(activeTotals[0][0]);
        champCounts[topId] = (champCounts[topId] || 0) + 1;
      }
    }

    const dayChampEntries = Object.entries(champCounts)
      .map(([pid, count]) => {
        const p = players.find((pl) => pl.id === pid) || FIXED_PLAYERS.find((pl) => pl.id === pid);
        return { playerId: pid, name: p?.name || pid, count };
      })
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count);

    if (dayChampEntries.length > 0) {
      const maxCount = dayChampEntries[0].count;
      const topChamps = dayChampEntries.filter((e) => e.count === maxCount);
      dayChampLeader = {
        playerId: topChamps.map((c) => c.playerId).join(","),
        name: topChamps.map((c) => c.name).join(" & "),
        count: maxCount,
      };
    }

    // Calculate Stat Leaders with support for multi-player ties
    let shutoutKing: { name: string; shutoutWins: number } | null = null;
    let highestMargin: LeaderboardEntry | null = null;
    let ironMan: { name: string; matchesPlayed: number; leagueMatchesPlayed: number; finalsPlayed: number } | null = null;
    let finalsSpecialist: { name: string; finalsWon: number } | null = null;
    let finalsPlayedLeader: { name: string; finalsPlayed: number } | null = null;
    let finalsLostLeader: { name: string; lostCount: number; finalsPlayed: number; finalsWon: number } | null = null;
    let shutoutLossesLeader: { name: string; shutoutLosses: number } | null = null;

    if (displayedLeaderboard.length > 0) {
      // Shutout King
      const maxShutouts = Math.max(...displayedLeaderboard.map((l) => l.shutoutWins ?? 0));
      if (maxShutouts > 0) {
        const shutoutKingPlayers = displayedLeaderboard.filter((l) => (l.shutoutWins ?? 0) === maxShutouts);
        shutoutKing = {
          name: shutoutKingPlayers.map((p) => p.name).join(" & "),
          shutoutWins: maxShutouts,
        };
      }

      // Highest Win Margin
      highestMargin = displayedLeaderboard.reduce((prev, current) => (prev.highestWinMargin > current.highestWinMargin) ? prev : current, displayedLeaderboard[0]);

      // Iron Man (League + Finals matches played)
      const maxMatches = Math.max(
        ...displayedLeaderboard.map((l) => (l.leagueMatchesPlayed ?? 0) + (l.finalsPlayed ?? 0))
      );
      if (maxMatches > 0) {
        const ironManPlayers = displayedLeaderboard.filter(
          (l) => ((l.leagueMatchesPlayed ?? 0) + (l.finalsPlayed ?? 0)) === maxMatches
        );
        ironMan = {
          name: ironManPlayers.map((p) => p.name).join(" & "),
          matchesPlayed: maxMatches,
          leagueMatchesPlayed: ironManPlayers[0]?.leagueMatchesPlayed ?? 0,
          finalsPlayed: ironManPlayers[0]?.finalsPlayed ?? 0,
        };
      }

      // Finals Clutch (Most Titles Won)
      const maxFinalsWon = Math.max(...displayedLeaderboard.map((l) => l.finalsWon ?? 0));
      if (maxFinalsWon > 0) {
        const finalsWonPlayers = displayedLeaderboard.filter((l) => (l.finalsWon ?? 0) === maxFinalsWon);
        finalsSpecialist = {
          name: finalsWonPlayers.map((p) => p.name).join(" & "),
          finalsWon: maxFinalsWon,
        };
      }

      // Finals Veteran (Most Finals Played)
      const maxFinalsPlayed = Math.max(...displayedLeaderboard.map((l) => l.finalsPlayed ?? 0));
      if (maxFinalsPlayed > 0) {
        const finalsPlayedPlayers = displayedLeaderboard.filter((l) => (l.finalsPlayed ?? 0) === maxFinalsPlayed);
        finalsPlayedLeader = {
          name: finalsPlayedPlayers.map((p) => p.name).join(" & "),
          finalsPlayed: maxFinalsPlayed,
        };
      }

      // Finals Heartbreak (Most Finals Lost)
      const maxFinalsLost = Math.max(...displayedLeaderboard.map((l) => (l.finalsPlayed ?? 0) - (l.finalsWon ?? 0)));
      if (maxFinalsLost > 0) {
        const finalsLostPlayers = displayedLeaderboard.filter((l) => ((l.finalsPlayed ?? 0) - (l.finalsWon ?? 0)) === maxFinalsLost);
        finalsLostLeader = {
          name: finalsLostPlayers.map((p) => p.name).join(" & "),
          lostCount: maxFinalsLost,
          finalsPlayed: maxFinalsLost,
          finalsWon: 0,
        };
      }

      // Shutout Magnet (Most Shutouts Conceded)
      const maxShutoutLosses = Math.max(...displayedLeaderboard.map((l) => l.shutoutLosses ?? 0));
      if (maxShutoutLosses > 0) {
        const shutoutLossPlayers = displayedLeaderboard.filter((l) => (l.shutoutLosses ?? 0) === maxShutoutLosses);
        shutoutLossesLeader = {
          name: shutoutLossPlayers.map((p) => p.name).join(" & "),
          shutoutLosses: maxShutoutLosses,
        };
      }
    }

    const statLeaders = {
      shutoutKing,
      highestMargin,
      ironMan,
      finalsSpecialist,
      finalsPlayedLeader,
      finalsLostLeader,
      shutoutLossesLeader,
      bestWinStreakLeader,
      worstLossStreakLeader,
      winRateLeader,
      dayChampLeader,
      peakDayScoreLeader,
      cardiacKing,
    };

    return {
      formMap,
      statLeaders,
      winRateChartData,
      dominanceData,
      finalsLeaderboard,
      scoringSpectrum,
      topRivalries: [] as any[],
    };
  }, [displayedHistory, displayedLeaderboard, players, completedDays, dayTable, displayedDayHonors]);

  const isDayEnded = (dayGroup: DayGroup): boolean => {
    // If any tournament in this day is currently active/live, day has not ended
    const hasLiveTourney = dayGroup.tournaments.some(
      (t) => currentTournament && currentTournament.id === t.tournamentId && !currentTournament.closed
    );
    if (hasLiveTourney) return false;

    if (dayGroup.closed) return true;
    if ((completedDays || []).some((cd) => cd.date === dayGroup.date)) return true;
    if (dayGroup.date in KNOWN_DAY_TOTALS) return true;
    if (dayTable?.date && dayGroup.date < dayTable.date) return true;

    return false;
  };

  const getDayTally = (dayGroup: DayGroup) => {
    let rawTotals: Record<string, number> = {};

    if (dayGroup.totals && Object.keys(dayGroup.totals).length > 0) {
      rawTotals = { ...dayGroup.totals };
    } else {
      const cd = (completedDays || []).find((d) => d.date === dayGroup.date);
      if (cd?.totals && Object.keys(cd.totals).length > 0) {
        rawTotals = { ...cd.totals };
      } else if (KNOWN_DAY_TOTALS[dayGroup.date]) {
        rawTotals = { ...KNOWN_DAY_TOTALS[dayGroup.date] };
      } else {
        let allTourneys = [...pastTournaments];
        if (allTourneys.length === 0) allTourneys = recoverTournamentsFromSyncQueue();
        if (currentTournament) allTourneys.push(currentTournament);

        dayGroup.tournaments.forEach((gt) => {
          const tObj = allTourneys.find((t) => t.id === gt.tournamentId);
          if (tObj) {
            const ptsMap =
              tObj.dayPointsAwarded && Object.keys(tObj.dayPointsAwarded).length > 0
                ? tObj.dayPointsAwarded
                : computeDayPoints(tObj);
            if (ptsMap) {
              for (const [pid, pts] of Object.entries(ptsMap)) {
                rawTotals[pid] = (rawTotals[pid] || 0) + (pts as number);
              }
            }
          }
        });
      }
    }

    const normalizedTotals: Record<string, number> = {};
    for (const [pid, pts] of Object.entries(rawTotals)) {
      const targetId = normalizePlayerId(pid);
      normalizedTotals[targetId] = (normalizedTotals[targetId] || 0) + Number(pts);
    }

    if (Object.keys(normalizedTotals).length === 0) return [];

    let topId: string | undefined;
    let spoonId: string | undefined;
    if (dayGroup.date === "2026-10-10") {
      topId = "akshat";
      spoonId = "udbhaw";
    } else if (dayGroup.date === "2026-10-11") {
      topId = "akshat";
      spoonId = "sajal";
    } else {
      const cd = (completedDays || []).find((d) => d.date === dayGroup.date);
      if (cd) {
        topId = cd.topPlayerId ? normalizePlayerId(cd.topPlayerId) : undefined;
        spoonId = cd.spoonPlayerId ? normalizePlayerId(cd.spoonPlayerId) : undefined;
      }
    }

    const entries = Object.entries(normalizedTotals)
      .map(([pid, pts]) => {
        const normId = normalizePlayerId(pid);
        const p =
          players.find((pl) => pl.id === normId || pl.id === pid) ||
          FIXED_PLAYERS.find((pl) => pl.id === normId || pl.id === pid);
        return {
          playerId: normId,
          name: p?.name || normId.charAt(0).toUpperCase() + normId.slice(1),
          avatar: p?.avatar || ("custom" as AvatarType),
          avatarEmoji: p?.avatarEmoji,
          avatarColor: p?.avatarColor,
          points: pts,
        };
      })
      .filter((p) => p.points > 0);

    entries.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (topId) {
        if (a.playerId === topId) return -1;
        if (b.playerId === topId) return 1;
      }
      if (spoonId) {
        if (a.playerId === spoonId) return 1;
        if (b.playerId === spoonId) return -1;
      }
      return a.name.localeCompare(b.name);
    });

    return entries.map((e, idx) => {
      const isChampion = idx === 0;
      const isSpoon = idx === entries.length - 1 && entries.length > 2;
      let medal = `#${idx + 1}`;
      if (idx === 0) medal = "🥇";
      else if (idx === 1) medal = "🥈";
      else if (idx === 2) medal = "🥉";
      else if (isSpoon) medal = "🥄";

      return {
        ...e,
        medal,
        isChampion,
        isSpoon,
      };
    });
  };

  const toggleTournament = (id: string) => {
    setExpandedTournaments((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleDayTally = (date: string) => {
    setExpandedDayTally((prev) => ({
      ...prev,
      [date]: !prev[date],
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
    rangeFilter !== "all" || playerFilter !== "all" || patternFilter !== "all" || historyFormatFilter !== "all";

  const activeFilterCount =
    (rangeFilter !== "all" ? 1 : 0) +
    (playerFilter !== "all" ? 1 : 0) +
    (patternFilter !== "all" ? 1 : 0) +
    (historyFormatFilter !== "all" ? 1 : 0);
  if (!isMounted) {
    return <div className="min-h-full bg-[#14161B] text-[#F3F4EE]"></div>;
  }

  return (
    <div className="min-h-full flex flex-col px-4 pt-4 pb-20 bg-[#14161B] text-[#F3F4EE]">
      {/* Spectator Mode Banner */}
      {isViewer && (
        <div className="bg-[#1E2128] border border-white/10 rounded-2xl px-4 py-2.5 mb-3 flex items-center justify-between text-xs text-[#F3F4EE] shadow-sm">
          <span className="font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#9EC9A8] animate-pulse" />
            Spectator Mode · Match History & Logs
          </span>
          {viewerSlug && (
            <Link
              href={`/live/${viewerSlug}`}
              className="text-white bg-[#FF5E48] hover:bg-[#FA6249] px-3 py-1 rounded-full font-black text-[11px] flex items-center gap-1 shadow-sm transition-all active:scale-95"
            >
              <span>🏸 Live Court</span>
            </Link>
          )}
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#1E2128] border border-white/10 shadow-xs flex items-center justify-center text-[#F5BA38] text-sm">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 8v4l3 3"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-black text-[#F3F4EE] uppercase tracking-wider leading-tight">
              History & Stats
            </h1>
            <p className="text-[10px] text-white/50 font-medium">Match logs & squad honors</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
          {/* Smooth Filter Menu Trigger */}
          {activeSubTab === "log" && (
            <button
              onClick={() => setShowFilterMenu(true)}
              className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer ${
                hasActiveFilter
                  ? "bg-[#FF5E48] text-white shadow-xs"
                  : "bg-[#1E2128] border border-white/10 text-white/80 hover:bg-[#252932]"
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
                <span className="w-4 h-4 rounded-full bg-white text-[#FF5E48] text-[10px] font-black flex items-center justify-center -mr-0.5">
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
            className="w-9 h-9 rounded-full bg-[#1E2128] border border-white/10 shadow-xs hover:bg-[#252932] active:scale-95 transition-all flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
            title="Refresh"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#F5BA38]" : ""}`}
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
      <div className="p-1 bg-[#1A1D24] border border-white/10 rounded-full flex gap-1 mb-3">
        <button
          onClick={() => setActiveSubTab("log")}
          className={`py-1.5 px-3 text-xs font-black rounded-full flex-1 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === "log"
              ? "bg-[#F3F4EE] text-[#14161B] shadow-sm"
              : "text-white/60 hover:text-white"
          }`}
        >
          <span>📜</span>
          <span>Match Log</span>
        </button>
        <button
          onClick={() => setActiveSubTab("leaderboards")}
          className={`py-1.5 px-3 text-xs font-black rounded-full flex-1 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === "leaderboards"
              ? "bg-[#F3F4EE] text-[#14161B] shadow-sm"
              : "text-white/60 hover:text-white"
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
              <span className="text-[10px] font-black text-white/40 uppercase tracking-wider">Filtered:</span>
              {rangeFilter !== "all" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#1E2128] text-white/90 px-2.5 py-0.5 rounded-full border border-white/10 shadow-2xs">
                  📅 {currentRangeLabel}
                  <button
                    type="button"
                    onClick={() => setRangeFilter("all")}
                    className="hover:text-[#FF5E48] cursor-pointer ml-0.5 font-black text-[10px]"
                  >
                    ✕
                  </button>
                </span>
              )}
              {playerFilter !== "all" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#1E2128] text-white/90 px-2.5 py-0.5 rounded-full border border-white/10 shadow-2xs">
                  👤 {currentPlayerLabel}
                  <button
                    type="button"
                    onClick={() => setPlayerFilter("all")}
                    className="hover:text-[#FF5E48] cursor-pointer ml-0.5 font-black text-[10px]"
                  >
                    ✕
                  </button>
                </span>
              )}
              {patternFilter !== "all" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#1E2128] text-white/90 px-2.5 py-0.5 rounded-full border border-white/10 shadow-2xs">
                  🎯 {currentPatternLabel}
                  <button
                    type="button"
                    onClick={() => setPatternFilter("all")}
                    className="hover:text-[#FF5E48] cursor-pointer ml-0.5 font-black text-[10px]"
                  >
                    ✕
                  </button>
                </span>
              )}
              {historyFormatFilter !== "all" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#1E2128] text-white/90 px-2.5 py-0.5 rounded-full border border-white/10 shadow-2xs">
                  ⚡ {historyFormatFilter === "double-elimination" ? "Double Elim" : "Round Robin"}
                  <button
                    type="button"
                    onClick={() => setHistoryFormatFilter("all")}
                    className="hover:text-[#FF5E48] cursor-pointer ml-0.5 font-black text-[10px]"
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
                className="text-[11px] font-black text-[#FF5E48] hover:underline cursor-pointer ml-1"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Mini-Leaderboard Hero Banner (Matching Reference Image Color Blocks) */}
          {displayedHistory.miniLeaderboard.length > 0 && (
            <div className="bg-[#1E2128] border border-white/10 text-[#F3F4EE] rounded-[28px] p-4 shadow-lg shadow-black/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#F5BA38] flex items-center gap-1.5">
                  <span>⚡</span> Match Summary
                </span>
                <div className="text-[11px] font-bold text-white/70 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full">
                  <span>{displayedHistory.totalMatches}</span> matches •{" "}
                  <span className="text-[#9EC9A8]">{displayedHistory.totalPoints} pts</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {displayedHistory.miniLeaderboard.slice(0, 3).map((item, idx) => (
                  <div
                    key={item.playerId}
                    className={`rounded-2xl p-2.5 text-center shadow-xs transition-transform active:scale-95 ${
                      idx === 0
                        ? "bg-[#F5BA38] text-[#14161B]"
                        : idx === 1
                        ? "bg-[#FF5E48] text-white"
                        : "bg-[#6C79E0] text-white"
                    }`}
                  >
                    <div className="text-[10px] font-black mb-0.5 uppercase tracking-wider opacity-90">
                      {idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : "🥉 #3"}
                    </div>
                    <div className="text-xs font-black truncate">{item.name}</div>
                    <div className="text-[10px] font-bold mt-0.5 opacity-90">
                      <span>{item.points} pts</span> • {item.wins}W
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline days */}
          {displayedHistory.days.length === 0 ? (
            <div className="text-center py-12 px-6 bg-[#1E2128] border border-white/10 rounded-[30px] shadow-xs flex flex-col items-center justify-center gap-2">
              <div className="w-14 h-14 rounded-full bg-[#14161B] border border-white/10 flex items-center justify-center text-3xl mb-1 shadow-xs select-none">
                🏸
              </div>
              <div className="text-base font-black text-[#F3F4EE]">No match records found</div>
              <p className="text-xs text-white/50 font-medium max-w-xs">
                Play matches or adjust your date filter
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedHistory.days.map((dayGroup) => (
                <div key={dayGroup.date} className="space-y-2.5">
                  {/* Day date header */}
                  <div className="flex items-center gap-2 px-1">
                    <div className="h-px flex-1 bg-white/10" />
                    <div className="flex items-center gap-1.5 bg-[#1E2128] border border-white/10 pl-3.5 pr-2 py-1 rounded-full shadow-2xs">
                      <span className="text-xs font-black text-white/90">
                        📅 {formatDateDDMMYY(dayGroup.date)}
                      </span>
                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => setDayToDelete(dayGroup.date)}
                          title={`Delete all records for ${formatDateDDMMYY(dayGroup.date)}`}
                          className="w-5 h-5 rounded-full hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-colors flex items-center justify-center cursor-pointer text-[10px]"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  {/* Tournaments for that day */}
                  {dayGroup.tournaments.map((tourney, tIdx) => {
                    const tourneyNumber = dayGroup.tournaments.length - tIdx;
                    const isExpanded = !!expandedTournaments[tourney.tournamentId];
                    const hasFinal = tourney.matches.some((m) => m.isFinal);
                    const isActive = !!(currentTournament && currentTournament.id === tourney.tournamentId && !currentTournament.closed);

                    return (
                      <div
                        key={tourney.tournamentId}
                        className="bg-[#1E2128] border border-white/10 rounded-[26px] overflow-hidden shadow-sm transition-all"
                      >
                        {/* Tournament header accordion button */}
                        <div
                          onClick={() => toggleTournament(tourney.tournamentId)}
                          className="w-full flex items-center justify-between p-3.5 bg-[#1E2128] hover:bg-[#252932] cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-xl bg-[#14161B] border border-white/10 flex items-center justify-center text-xs font-black text-[#F5BA38]">
                              #{tourneyNumber}
                            </div>
                            <div className="text-left">
                              <div className="text-xs font-black text-[#F3F4EE] flex items-center gap-2">
                                <span>Tournament #{tourneyNumber}</span>
                                {hasFinal && (
                                  <span className="text-[10px] bg-[#F5BA38]/20 border border-[#F5BA38]/40 text-[#F5BA38] px-2 py-0.5 rounded-full font-black">
                                    🏆 Final
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-white/50 font-medium">
                                {tourney.matches.length} played matches
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isActive ? (
                              tourney.shareSlug ? (
                                <Link
                                  href={`/live/${tourney.shareSlug}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#FF5E48]/20 hover:bg-[#FF5E48]/30 text-[#FF5E48] font-black flex items-center gap-1 border border-[#FF5E48]/40 transition-colors animate-pulse"
                                  title="Live in progress — View stream"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF5E48]" />
                                  <span>Live</span>
                                </Link>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF5E48]/20 text-[#FF5E48] font-black flex items-center gap-1 border border-[#FF5E48]/40 animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF5E48]" />
                                  <span>Live</span>
                                </span>
                              )
                            ) : tourney.shareSlug ? (
                              <Link
                                href={`/live/${tourney.shareSlug}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70 font-bold flex items-center gap-1 border border-white/10 transition-colors"
                                title="Tournament completed — View scorecard"
                              >
                                <span>✓ Completed</span>
                              </Link>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 font-bold flex items-center gap-1 border border-white/10">
                                <span>✓ Completed</span>
                              </span>
                            )}
                            {!isViewer && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTournamentToDelete(tourney.tournamentId);
                                }}
                                title="Delete Tournament"
                                className="text-xs p-1.5 rounded-full hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-colors"
                              >
                                <span>🗑️</span>
                              </button>
                            )}
                            <svg
                              className={`w-4 h-4 text-white/40 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </div>
                        </div>

                        {/* Matches list */}
                        {isExpanded && (
                          <div className="divide-y divide-white/5 border-t border-white/10 p-2 space-y-1.5 bg-[#14161B]/60">
                            {tourney.matches.map((m) => {
                              const aWon = m.scoreA > m.scoreB;
                              const bWon = m.scoreB > m.scoreA;
                              const diff = Math.abs(m.scoreA - m.scoreB);
                              const isBlowout = diff >= 4;

                              return (
                                <div
                                  key={m.id}
                                  className={`p-2.5 rounded-2xl border flex items-center justify-between gap-3 ${
                                    m.isFinal
                                      ? "bg-gradient-to-r from-[#F5BA38]/15 via-[#1E2128] to-[#6C79E0]/15 border-[#F5BA38]/40 shadow-xs"
                                      : "bg-[#1E2128] border-white/10 shadow-2xs"
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
                                          aWon ? "font-black text-[#F3F4EE]" : "text-white/50 font-medium"
                                        }`}
                                      >
                                        {m.playerAName}
                                      </div>
                                      <div className="text-[10px] text-white/40 font-medium">
                                        <span className={aWon ? "text-[#9EC9A8] font-bold" : ""}>+{m.pointsA} pts</span> {aWon && isBlowout && "🔥"}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Score pill */}
                                  <div className="flex flex-col items-center">
                                    {m.isFinal && (
                                      <span className="text-[9px] uppercase tracking-wider font-black text-[#F5BA38] mb-0.5">
                                        Final
                                      </span>
                                    )}
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[#14161B] border border-white/15 text-[#F3F4EE] rounded-full font-mono text-xs font-black shadow-xs">
                                      <span className={aWon ? "text-[#9EC9A8]" : "text-white/50"}>
                                        {m.scoreA}
                                      </span>
                                      <span className="text-white/30">-</span>
                                      <span className={bWon ? "text-[#9EC9A8]" : "text-white/50"}>
                                        {m.scoreB}
                                      </span>
                                    </div>
                                    {isBlowout && (
                                      <span className="text-[9px] text-[#6C79E0] font-black mt-0.5">
                                        +Bonus
                                      </span>
                                    )}
                                  </div>

                                  {/* Player B */}
                                  <div className="flex-1 flex items-center justify-end gap-2 min-w-0 text-right">
                                    <div className="min-w-0">
                                      <div
                                        className={`text-xs truncate ${
                                          bWon ? "font-black text-[#F3F4EE]" : "text-white/50 font-medium"
                                        }`}
                                      >
                                        {m.playerBName}
                                      </div>
                                      <div className="text-[10px] text-white/40 font-medium">
                                        <span className={bWon ? "text-[#9EC9A8] font-bold" : ""}>+{m.pointsB} pts</span> {bWon && isBlowout && "🔥"}
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

                  {/* End of Day Standings / Points Tally (Appears only when the day has ended) */}
                  {(() => {
                    const isEnded = isDayEnded(dayGroup);
                    if (!isEnded) return null;
                    const tally = getDayTally(dayGroup);
                    if (tally.length === 0) return null;
                    const topItem = tally[0];
                    const totalDayPts = tally.reduce((sum, p) => sum + p.points, 0);
                    const isTallyExpanded = !!expandedDayTally[dayGroup.date];

                    return (
                      <div className="bg-[#1E2128] border border-white/10 rounded-[26px] overflow-hidden shadow-xs transition-all">
                        {/* Table Header Button (Clickable accordion header) */}
                        <div
                          onClick={() => toggleDayTally(dayGroup.date)}
                          className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors hover:bg-[#252932] ${
                            isTallyExpanded ? "border-b border-white/10 bg-[#16181F]" : "bg-[#1E2128]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-[#F5BA38]/20 border border-[#F5BA38]/40 flex items-center justify-center text-sm shadow-2xs select-none">
                              🏁
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-black text-[#F3F4EE] tracking-tight">
                                  End of Day Standings
                                </h4>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#9EC9A8]/20 text-[#9EC9A8] border border-[#9EC9A8]/40 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#9EC9A8]" />
                                  <span>Concluded</span>
                                </span>
                              </div>
                              <p className="text-[10px] text-white/50 font-medium mt-0.5">
                                Final points tally for {formatDateDDMMYY(dayGroup.date)} · {totalDayPts} pts awarded
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {topItem && (
                              <div className="flex items-center gap-1.5 bg-[#F5BA38] text-[#14161B] pl-2.5 pr-2 py-1 rounded-full shadow-2xs">
                                <span className="text-xs">👑</span>
                                <span className="text-xs font-black truncate max-w-[100px] sm:max-w-none">
                                  {topItem.name}
                                </span>
                                <span className="text-[10px] font-mono font-black text-[#14161B] bg-white/40 px-1.5 py-0.5 rounded-full">
                                  {topItem.points} pts
                                </span>
                              </div>
                            )}
                            <svg
                              className={`w-4 h-4 text-white/40 transition-transform ${
                                isTallyExpanded ? "rotate-180" : ""
                              }`}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </div>
                        </div>

                        {/* Standings Table Rows (Visible only when expanded) */}
                        {isTallyExpanded && (
                          <div className="divide-y divide-white/5">
                            {tally.map((item, idx) => {
                              const isTop = item.isChampion;
                              const isSpoon = item.isSpoon;

                              return (
                                <div
                                  key={item.playerId}
                                  className={`px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                                    isTop
                                      ? "bg-[#F5BA38]/15 border-l-4 border-l-[#F5BA38]"
                                      : isSpoon
                                      ? "bg-rose-500/15 border-l-4 border-l-rose-500"
                                      : idx === 1
                                      ? "bg-[#FF5E48]/10 border-l-4 border-l-[#FF5E48]"
                                      : idx === 2
                                      ? "bg-[#6C79E0]/10 border-l-4 border-l-[#6C79E0]"
                                      : "hover:bg-white/5"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {/* Rank Medal */}
                                    <div
                                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                                        isTop
                                          ? "bg-[#F5BA38] text-[#14161B] shadow-2xs"
                                          : idx === 1
                                          ? "bg-[#FF5E48] text-white shadow-2xs"
                                          : idx === 2
                                          ? "bg-[#6C79E0] text-white shadow-2xs"
                                          : isSpoon
                                          ? "bg-rose-500 text-white shadow-2xs"
                                          : "bg-white/10 text-white/70 border border-white/10"
                                      }`}
                                    >
                                      {isTop ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : isSpoon ? "🥄" : `#${idx + 1}`}
                                    </div>

                                    {/* Avatar */}
                                    <div className="w-8 h-8 rounded-xl bg-[#14161B] border border-white/10 p-0.5 flex items-center justify-center shrink-0 shadow-2xs">
                                      <AvatarSVG
                                        type={item.avatar}
                                        size={26}
                                        emoji={item.avatarEmoji}
                                        color={item.avatarColor}
                                      />
                                    </div>

                                    {/* Name & Subtitle */}
                                    <div className="min-w-0 flex flex-col justify-center">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span
                                          className={`text-xs truncate ${
                                            isTop
                                              ? "font-black text-[#F5BA38]"
                                              : isSpoon
                                              ? "font-black text-rose-400"
                                              : "font-black text-[#F3F4EE]"
                                          }`}
                                        >
                                          {item.name}
                                        </span>
                                        {isTop && (
                                          <span className="text-[9px] font-black uppercase tracking-wider bg-[#F5BA38]/20 text-[#F5BA38] border border-[#F5BA38]/40 px-1.5 py-0.2 rounded-md">
                                            Champion
                                          </span>
                                        )}
                                        {isSpoon && (
                                          <span className="text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40 px-1.5 py-0.2 rounded-md">
                                            Wooden Spoon
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-white/40 font-medium">
                                        {isTop
                                          ? "Rank #1 on Day Table"
                                          : isSpoon
                                          ? "Ranked last place"
                                          : `Rank #${idx + 1}`}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Points badge */}
                                  <div className="text-right shrink-0">
                                    <span
                                      className={`text-base font-black font-mono tabular-nums leading-none ${
                                        isTop
                                          ? "text-[#F5BA38]"
                                          : isSpoon
                                          ? "text-rose-400"
                                          : "text-[#F3F4EE]"
                                      }`}
                                    >
                                      {item.points}
                                    </span>
                                    <span className="text-[10px] font-bold text-white/40 ml-1">pts</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: LEADERBOARDS & DAY HONORS */}
      {activeSubTab === "leaderboards" && (
        <div className="space-y-3">
          {/* Format Switcher: Overall (default) | Round Robin | Double Elim */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-1.5 bg-[#1E2128] border border-white/10 rounded-2xl shadow-xs">
            <div className="flex items-center gap-2 pl-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-white/40">Format:</span>
            </div>
            <div className="flex bg-[#14161B] border border-white/10 p-1 rounded-xl gap-1 w-full sm:w-auto">
              {(
                [
                  { key: "all", label: "Overall", icon: "🌐" },
                  { key: "round-robin", label: "Round Robin", icon: "🔄" },
                  { key: "double-elimination", label: "Double Elim", icon: "⚡" },
                ] as const
              ).map((fmt) => (
                <button
                  key={fmt.key}
                  type="button"
                  onClick={() => setHistoryFormatFilter(fmt.key)}
                  className={`flex-1 sm:flex-initial py-1.5 px-3 flex items-center justify-center gap-1.5 text-xs font-black rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    historyFormatFilter === fmt.key
                      ? "bg-[#FF5E48] text-white shadow-xs"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  <span className="text-xs">{fmt.icon}</span>
                  <span>{fmt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Combined Controls for Leaderboards */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Time Filter Pill */}
            <div
              className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all shadow-2xs cursor-pointer select-none shrink-0 ${
                rangeFilter !== "all"
                  ? "bg-[#FF5E48] text-white font-black shadow-xs"
                  : "bg-[#1E2128] border border-white/10 text-white/80 font-bold hover:bg-[#252932]"
              }`}
            >
              <span>📅</span>
              <span>{currentRangeLabel}</span>
              <span className={`text-[9px] ${rangeFilter !== "all" ? "text-white/80" : "text-white/40"}`}>▾</span>
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
            <div className="flex bg-[#1A1D24] border border-white/10 p-1 rounded-full overflow-x-auto hide-scrollbar w-full sm:w-auto">
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
                  className={`py-1.5 px-3 flex items-center gap-1.5 text-xs font-black rounded-full transition-all whitespace-nowrap cursor-pointer ${
                    leaderboardCategory === cat.key
                      ? "bg-[#F3F4EE] text-[#14161B] shadow-sm"
                      : "text-white/60 hover:text-white"
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
              <div className="p-1 bg-[#1A1D24] border border-white/10 rounded-full flex gap-1 items-center">
                <span className="text-[10px] font-black text-white/40 pl-2 pr-0.5 uppercase">Rank:</span>
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
                    className={`py-1 px-2.5 text-xs font-black rounded-full transition-all cursor-pointer ${
                      sortBy === m.key
                        ? "bg-[#FF5E48] text-white shadow-xs"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {leaderboardCategory !== "analytics" && (
            <div className="bg-[#1E2128] border border-white/10 rounded-[28px] overflow-hidden shadow-xs">
              <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-[#16181F]">
                <div className="text-xs font-black text-[#F3F4EE] flex items-center gap-1.5 uppercase tracking-wider">
                  {leaderboardCategory === "day" && <span>🏆 Overall Day Leaderboard</span>}
                  {leaderboardCategory === "league" && <span>🏸 League (Round-Robin) Standings</span>}
                  {leaderboardCategory === "finals" && <span>🎯 Championship (Finals) Record</span>}
                </div>
                <div className="text-[10px] font-bold text-white/50">
                  {displayedLeaderboard.length > 0 ? displayedLeaderboard.length : players.length} active
                </div>
              </div>

              {displayedLeaderboard.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-xs">
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
                            ? "bg-[#F5BA38]/15 border-l-4 border-l-[#F5BA38]"
                            : isTop2
                            ? "bg-[#FF5E48]/10 border-l-4 border-l-[#FF5E48]"
                            : isTop3
                            ? "bg-[#6C79E0]/10 border-l-4 border-l-[#6C79E0]"
                            : "hover:bg-white/5"
                        }`}
                      >
                        {/* Rank & Avatar & Name */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 text-center font-black text-xs">
                            {isTop1 ? "🥇" : isTop2 ? "🥈" : isTop3 ? "🥉" : `#${index + 1}`}
                          </div>
                          <AvatarSVG
                            type={entry.avatar}
                            size={36}
                            emoji={entry.avatarEmoji}
                            color={entry.avatarColor}
                          />
                          <div className="min-w-0 flex flex-col justify-center">
                            <div className="text-xs font-black text-[#F3F4EE] truncate leading-tight">
                              {entry.name}
                            </div>
                            <div className="text-[10px] text-white/40 font-semibold flex items-center gap-1.5 mt-0.5">
                              {leaderboardCategory === "day" && (
                                <span>{entry.finalsWon} finals won • {entry.leagueWins} league wins</span>
                              )}
                              {leaderboardCategory === "league" && (
                                <>
                                  <span>{entry.leagueWins}W - {entry.leagueMatchesPlayed - entry.leagueWins}L</span>
                                  <span>•</span>
                                  <span className="text-[#9EC9A8] font-bold">{entry.leagueWinRate}% win</span>
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
                          <div className="text-sm font-black text-[#F3F4EE] leading-tight">
                            {leaderboardCategory === "day" && `${entry.dayPointsTotal} pts`}
                            {leaderboardCategory === "league" && (
                              sortBy === "points" ? `${entry.leaguePoints} pts` :
                              sortBy === "wins" ? `${entry.leagueWins} wins` :
                              `${entry.leagueMatchesPlayed} matches`
                            )}
                            {leaderboardCategory === "finals" && `${entry.finalsWon} wins`}
                          </div>
                          <div className="text-[10px] text-white/40 font-semibold mt-0.5">
                            {leaderboardCategory === "day" && `Total Day Points`}
                            {leaderboardCategory === "league" && (
                              <>
                                Diff:{" "}
                                <span className={entry.leaguePointDiff > 0 ? "text-[#9EC9A8] font-black" : entry.leaguePointDiff < 0 ? "text-[#FF5E48] font-black" : "text-white/40"}>
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
                <div className="bg-[#1E2128] border border-white/10 rounded-[28px] p-5 shadow-xs flex flex-col">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#F3F4EE] mb-1">Win Rates</h3>
                  <p className="text-[10px] text-white/40 font-medium mb-4">League vs Finals Performance</p>
                  <div className="overflow-x-auto overflow-y-hidden no-scrollbar w-full h-48">
                    <div style={{ minWidth: `${Math.max(100, advancedInsights.winRateChartData.length * 20)}%`, height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={advancedInsights.winRateChartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} padding={{ left: 10, right: 10 }} tick={{ fontSize: 10, fontWeight: 700, fill: 'rgba(255,255,255,0.5)' }} />
                          <YAxis hide domain={[0, 100]} />
                          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ backgroundColor: '#16181F', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', color: '#F3F4EE', fontSize: '12px', fontWeight: 700 }} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }} />
                          <Bar dataKey="League WR %" fill="#6C79E0" radius={[4, 4, 0, 0]} barSize={16} />
                          <Bar dataKey="Finals WR %" fill="#F5BA38" radius={[4, 4, 0, 0]} barSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Dominance Index Chart */}
                <div className="bg-[#1E2128] border border-white/10 rounded-[28px] p-5 shadow-xs flex flex-col">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#F3F4EE] mb-1">Dominance Index</h3>
                  <p className="text-[10px] text-white/40 font-medium mb-4">Average point differential per match</p>
                  <div className="overflow-x-auto overflow-y-hidden no-scrollbar w-full h-48">
                    <div style={{ minWidth: `${Math.max(100, advancedInsights.dominanceData.length * 20)}%`, height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={advancedInsights.dominanceData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} padding={{ left: 10, right: 10 }} tick={{ fontSize: 10, fontWeight: 700, fill: 'rgba(255,255,255,0.5)' }} />
                          <YAxis hide />
                          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ backgroundColor: '#16181F', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', color: '#F3F4EE', fontSize: '12px', fontWeight: 700 }} />
                          <Bar dataKey="Avg Diff" radius={[4, 4, 0, 0]} barSize={24}>
                            {
                              advancedInsights.dominanceData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry["Avg Diff"] > 0 ? '#9EC9A8' : '#FF5E48'} />
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
                <div className="bg-[#1E2128] border border-white/10 rounded-[26px] p-4 shadow-xs flex flex-col max-h-64">
                  <div className="flex items-center gap-2.5 mb-3 shrink-0">
                    <div className="w-8 h-8 rounded-xl bg-[#F5BA38]/15 border border-[#F5BA38]/25 flex items-center justify-center text-sm shadow-2xs">🔥</div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#F3F4EE]">Current Form Guide</h3>
                      <p className="text-[10px] text-white/40 font-semibold">Last 5 matches (Newest first)</p>
                    </div>
                  </div>
                  <div className="space-y-2 overflow-y-auto no-scrollbar flex-1 pr-1 pb-1">
                    {players.map(p => advancedInsights.formMap[p.id] && advancedInsights.formMap[p.id].length > 0 ? (
                      <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#16181F] border border-white/5">
                        <div className="flex items-center gap-2">
                          <AvatarSVG type={p.avatar} size={28} emoji={p.avatarEmoji} color={p.avatarColor} />
                          <span className="text-xs font-extrabold text-[#F3F4EE]">{p.name}</span>
                        </div>
                        <div className="flex gap-1.5">
                          {advancedInsights.formMap[p.id].map((res, i) => (
                            <span key={i} className={`w-5 h-5 flex items-center justify-center rounded-md text-[9px] font-black ${res === "W" ? "bg-[#9EC9A8]/15 text-[#9EC9A8] border border-[#9EC9A8]/30" : "bg-[#FF5E48]/15 text-[#FF5E48] border border-[#FF5E48]/30"}`}>{res}</span>
                          ))}
                        </div>
                      </div>
                    ) : null).filter(Boolean)}
                  </div>
                </div>

                {/* Stat Leaders Grid */}
                <div className="bg-[#1E2128] border border-white/10 rounded-[26px] p-4 shadow-xs flex flex-col max-h-80">
                  <div className="flex items-center gap-2.5 mb-3 shrink-0">
                    <div className="w-8 h-8 rounded-xl bg-[#6C79E0]/15 border border-[#6C79E0]/25 flex items-center justify-center text-sm shadow-2xs">🏅</div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#F3F4EE]">Tournament Honors & Records</h3>
                      <p className="text-[10px] text-white/40 font-semibold">Leaders across performance categories</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 h-full overflow-y-auto no-scrollbar pb-1">
                    {/* Finals Clutch */}
                    {(advancedInsights.statLeaders.finalsSpecialist?.finalsWon ?? 0) > 0 && (
                      <div className="bg-[#16181F] rounded-2xl p-2.5 border border-white/5 flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Finals Clutch</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-[#F3F4EE]">{advancedInsights.statLeaders.finalsSpecialist?.name}</span>
                             <span className="text-[10px] font-bold text-[#F5BA38]">{advancedInsights.statLeaders.finalsSpecialist?.finalsWon} titles</span>
                           </div>
                           <span className="text-lg opacity-90">🏆</span>
                        </div>
                      </div>
                    )}

                    {/* Finals Veteran (Most Finals Played) */}
                    {(advancedInsights.statLeaders.finalsPlayedLeader?.finalsPlayed ?? 0) > 0 && (
                      <div className="bg-[#16181F] rounded-2xl p-2.5 border border-white/5 flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Finals Veteran</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-[#F3F4EE]">{advancedInsights.statLeaders.finalsPlayedLeader?.name}</span>
                             <span className="text-[10px] font-bold text-[#6C79E0]">{advancedInsights.statLeaders.finalsPlayedLeader?.finalsPlayed} finals played</span>
                           </div>
                           <span className="text-lg opacity-90">🏟️</span>
                        </div>
                      </div>
                    )}

                    {/* Finals Heartbreak (Most Finals Lost) */}
                    {advancedInsights.statLeaders.finalsLostLeader && (advancedInsights.statLeaders.finalsLostLeader.lostCount ?? (advancedInsights.statLeaders.finalsLostLeader.finalsPlayed - advancedInsights.statLeaders.finalsLostLeader.finalsWon)) > 0 && (
                      <div className="bg-[#16181F] rounded-2xl p-2.5 border border-white/5 flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Finals Heartbreak</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-[#F3F4EE]">{advancedInsights.statLeaders.finalsLostLeader?.name}</span>
                             <span className="text-[10px] font-bold text-[#FF5E48]">{advancedInsights.statLeaders.finalsLostLeader.lostCount ?? (advancedInsights.statLeaders.finalsLostLeader.finalsPlayed - advancedInsights.statLeaders.finalsLostLeader.finalsWon)} runner-up</span>
                           </div>
                           <span className="text-lg opacity-90">💔</span>
                        </div>
                      </div>
                    )}

                    {/* Shutout King */}
                    {(advancedInsights.statLeaders.shutoutKing?.shutoutWins ?? 0) > 0 && (
                      <div className="bg-[#16181F] rounded-2xl p-2.5 border border-white/5 flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Shutout King</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-[#F3F4EE]">{advancedInsights.statLeaders.shutoutKing?.name}</span>
                             <span className="text-[10px] font-bold text-[#9EC9A8]">{advancedInsights.statLeaders.shutoutKing?.shutoutWins} shutouts</span>
                           </div>
                           <span className="text-lg opacity-90">⚡</span>
                        </div>
                      </div>
                    )}

                    {/* Shutout Magnet (Most Shutouts Conceded) */}
                    {(advancedInsights.statLeaders.shutoutLossesLeader?.shutoutLosses ?? 0) > 0 && (
                      <div className="bg-[#16181F] rounded-2xl p-2.5 border border-white/5 flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Shutout Magnet</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-[#F3F4EE]">{advancedInsights.statLeaders.shutoutLossesLeader?.name}</span>
                             <span className="text-[10px] font-bold text-[#FF5E48]">{advancedInsights.statLeaders.shutoutLossesLeader?.shutoutLosses} shutted</span>
                           </div>
                           <span className="text-lg opacity-90">🛡️</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Best Win Streak (Replaced Biggest Win) */}
                    {advancedInsights.statLeaders.bestWinStreakLeader && (
                      <div className="bg-[#16181F] rounded-2xl p-2.5 border border-white/5 flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Best Win Streak</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-[#F3F4EE]">{advancedInsights.statLeaders.bestWinStreakLeader.name}</span>
                             <span className="text-[10px] font-bold text-[#9EC9A8]">{advancedInsights.statLeaders.bestWinStreakLeader.streak} wins streak</span>
                           </div>
                           <span className="text-lg opacity-90">🔥</span>
                        </div>
                      </div>
                    )}

                    {/* Toughest Slump (Biggest Losing Streak) */}
                    {advancedInsights.statLeaders.worstLossStreakLeader && (
                      <div className="bg-[#16181F] rounded-2xl p-2.5 border border-white/5 flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Toughest Slump</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-[#F3F4EE]">{advancedInsights.statLeaders.worstLossStreakLeader.name}</span>
                             <span className="text-[10px] font-bold text-[#FF5E48]">{advancedInsights.statLeaders.worstLossStreakLeader.streak} losses streak</span>
                           </div>
                           <span className="text-lg opacity-90">🥶</span>
                        </div>
                      </div>
                    )}

                    {/* Win Rate Leader */}
                    {advancedInsights.statLeaders.winRateLeader && (
                      <div className="bg-[#16181F] rounded-2xl p-2.5 border border-white/5 flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Win Rate Leader</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-[#F3F4EE]">{advancedInsights.statLeaders.winRateLeader.name}</span>
                             <span className="text-[10px] font-bold text-[#6C79E0]">{advancedInsights.statLeaders.winRateLeader.leagueWinRate}% win rate</span>
                           </div>
                           <span className="text-lg opacity-90">📈</span>
                        </div>
                      </div>
                    )}

                    {/* Daily Crown Record (Most Day 1st Places) */}
                    {advancedInsights.statLeaders.dayChampLeader && (
                      <div className="bg-[#16181F] rounded-2xl p-2.5 border border-white/5 flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Daily Crown</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-[#F3F4EE]">{advancedInsights.statLeaders.dayChampLeader.name}</span>
                             <span className="text-[10px] font-bold text-[#F5BA38]">{advancedInsights.statLeaders.dayChampLeader.count} Day 1st Places</span>
                           </div>
                           <span className="text-lg opacity-90">🥇</span>
                        </div>
                      </div>
                    )}

                    {/* Single-Day High Record */}
                    {advancedInsights.statLeaders.peakDayScoreLeader && (
                      <div className="bg-[#16181F] rounded-2xl p-2.5 border border-white/5 flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Day Point Record</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-[#F3F4EE]">{advancedInsights.statLeaders.peakDayScoreLeader.name}</span>
                             <span className="text-[10px] font-bold text-[#6C79E0]">{advancedInsights.statLeaders.peakDayScoreLeader.maxPts} pts (1 day)</span>
                           </div>
                           <span className="text-lg opacity-90">👑</span>
                        </div>
                      </div>
                    )}

                    {/* Iron Man */}
                    {advancedInsights.statLeaders.ironMan && (
                      <div className="bg-[#16181F] rounded-2xl p-2.5 border border-white/5 flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Iron Man</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-[#F3F4EE]">{advancedInsights.statLeaders.ironMan?.name}</span>
                             <span className="text-[10px] font-bold text-white/70">{(advancedInsights.statLeaders.ironMan?.matchesPlayed ?? ((advancedInsights.statLeaders.ironMan?.leagueMatchesPlayed ?? 0) + (advancedInsights.statLeaders.ironMan?.finalsPlayed ?? 0)))} played</span>
                           </div>
                           <span className="text-lg opacity-90">🔋</span>
                        </div>
                      </div>
                    )}

                    {/* Cardiac King (1-Point Thriller Wins) */}
                    {advancedInsights.statLeaders.cardiacKing && (
                      <div className="bg-[#16181F] rounded-2xl p-2.5 border border-white/5 flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Cardiac King</span>
                        <div className="flex items-center justify-between mt-1">
                           <div className="flex flex-col">
                             <span className="text-[11px] font-black text-[#F3F4EE]">{advancedInsights.statLeaders.cardiacKing.name}</span>
                             <span className="text-[10px] font-bold text-[#FF5E48]">{advancedInsights.statLeaders.cardiacKing.wins} clutch wins (1-pt)</span>
                           </div>
                           <span className="text-lg opacity-90">💓</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Championship Finals Leaderboard Table */}
              <div className="bg-[#1E2128] border border-white/10 rounded-[28px] p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-[#F5BA38]/15 border border-[#F5BA38]/25 flex items-center justify-center text-sm shadow-2xs">
                      🏆
                    </span>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#F3F4EE]">
                        Championship Finals Leaderboard
                      </h3>
                      <p className="text-[10px] text-white/40 font-medium">
                        Career finals played, won, lost &amp; clutch win rate
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#F5BA38] bg-[#F5BA38]/10 px-2.5 py-0.5 rounded-full border border-[#F5BA38]/20">
                    All-Time Finals
                  </span>
                </div>

                <div className="overflow-x-auto no-scrollbar rounded-2xl border border-white/10">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#16181F] border-b border-white/10 text-[10px] font-black uppercase tracking-wider text-white/40">
                        <th className="py-2.5 pl-3 pr-2">Rank &amp; Player</th>
                        <th className="py-2.5 px-2 text-center">Finals Played</th>
                        <th className="py-2.5 px-2 text-center">🏆 Titles Won</th>
                        <th className="py-2.5 px-2 text-center">💔 Finals Lost</th>
                        <th className="py-2.5 pr-3 pl-2 text-right">Finals WR%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {advancedInsights.finalsLeaderboard.map((player, idx) => (
                        <tr
                          key={player.playerId}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-2.5 pl-3 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 text-center font-mono font-black text-white/40 text-xs">
                                #{idx + 1}
                              </span>
                              <AvatarSVG
                                type={player.avatar}
                                size={24}
                                emoji={player.avatarEmoji}
                                color={player.avatarColor}
                              />
                              <span className="font-extrabold text-xs text-[#F3F4EE] truncate">
                                {player.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-white/70">
                            {player.finalsPlayed}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F5BA38]/15 border border-[#F5BA38]/25 text-[#F5BA38] font-black text-[11px]">
                              🏆 {player.finalsWon}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono">
                            {player.finalsLost > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF5E48]/15 border border-[#FF5E48]/25 text-[#FF5E48] font-bold text-[11px]">
                                💔 {player.finalsLost}
                              </span>
                            ) : (
                              <span className="text-white/30 text-[11px]">0</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 pl-2 text-right font-mono font-black">
                            <span
                              className={
                                player.winRate >= 60
                                  ? "text-[#9EC9A8]"
                                  : player.winRate >= 40
                                  ? "text-[#F5BA38]"
                                  : "text-white/40"
                              }
                            >
                              {player.finalsPlayed > 0 ? `${player.winRate}%` : "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Row 4: Match Intensity & Scoring Spectrum Hub */}
              {advancedInsights.scoringSpectrum && advancedInsights.scoringSpectrum.totalMatchesCount > 0 && (
                <div className="bg-[#1E2128] border border-white/10 rounded-[28px] p-5 shadow-xs space-y-5">
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-[#F5BA38]/15 border border-[#F5BA38]/25 flex items-center justify-center text-sm shadow-2xs">
                        ⚡
                      </span>
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-[#F3F4EE]">
                          Match Intensity &amp; Scoring Spectrum
                        </h3>
                        <p className="text-[10px] text-white/40 font-medium">
                          Margin distribution across {advancedInsights.scoringSpectrum.totalMatchesCount} matches, clutch finishes &amp; blowouts
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-white/70 bg-[#16181F] px-2.5 py-1 rounded-full border border-white/10">
                        Avg Win Margin: <strong className="text-[#F3F4EE]">{advancedInsights.scoringSpectrum.avgWinMargin} pts</strong>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[#6C79E0] bg-[#6C79E0]/15 px-2.5 py-1 rounded-full border border-[#6C79E0]/25">
                        Avg Match Pts: <strong className="text-[#F3F4EE]">{advancedInsights.scoringSpectrum.avgMatchPoints}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Segmented Intensity Spectrum Bar */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold text-white/50 px-0.5 gap-y-1">
                      <span className="flex items-center gap-1.5 text-[#FF5E48]">
                        <span className="w-2 h-2 rounded-full bg-[#FF5E48]"></span>
                        Wire Thrillers (1 pt): <strong className="font-mono text-[#F3F4EE]">{advancedInsights.scoringSpectrum.thrillersCount} ({advancedInsights.scoringSpectrum.thrillerPct}%)</strong>
                      </span>
                      <span className="flex items-center gap-1.5 text-[#6C79E0]">
                        <span className="w-2 h-2 rounded-full bg-[#6C79E0]"></span>
                        Decisive (2-3 pts): <strong className="font-mono text-[#F3F4EE]">{advancedInsights.scoringSpectrum.competitiveCount} ({advancedInsights.scoringSpectrum.competitivePct}%)</strong>
                      </span>
                      <span className="flex items-center gap-1.5 text-[#9EC9A8]">
                        <span className="w-2 h-2 rounded-full bg-[#9EC9A8]"></span>
                        Blowouts (≥4 pts): <strong className="font-mono text-[#F3F4EE]">{advancedInsights.scoringSpectrum.blowoutsCount} ({advancedInsights.scoringSpectrum.blowoutsPct}%)</strong>
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-[#16181F] overflow-hidden flex p-0.5 border border-white/10 shadow-inner">
                      <div
                        className="h-full rounded-l-full bg-gradient-to-r from-[#FF5E48] to-[#FF8066] transition-all duration-500"
                        style={{ width: `${advancedInsights.scoringSpectrum.thrillerPct}%` }}
                        title={`Thrillers: ${advancedInsights.scoringSpectrum.thrillersCount} matches (${advancedInsights.scoringSpectrum.thrillerPct}%)`}
                      />
                      <div
                        className="h-full bg-gradient-to-r from-[#6C79E0] to-[#8C98F0] transition-all duration-500"
                        style={{ width: `${advancedInsights.scoringSpectrum.competitivePct}%` }}
                        title={`Decisive: ${advancedInsights.scoringSpectrum.competitiveCount} matches (${advancedInsights.scoringSpectrum.competitivePct}%)`}
                      />
                      <div
                        className="h-full rounded-r-full bg-gradient-to-r from-[#9EC9A8] to-[#BEE0C4] transition-all duration-500"
                        style={{ width: `${advancedInsights.scoringSpectrum.blowoutsPct}%` }}
                        title={`Blowouts: ${advancedInsights.scoringSpectrum.blowoutsCount} matches (${advancedInsights.scoringSpectrum.blowoutsPct}%)`}
                      />
                    </div>
                  </div>

                  {/* Intensity Tiers & Key Archetypes */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Tier 1: Wire Thrillers */}
                    <div className="p-3.5 rounded-2xl bg-[#16181F] border border-[#FF5E48]/20 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[11px] font-black uppercase tracking-wider text-[#FF5E48] flex items-center gap-1.5">
                            🔥 1-Point Thrillers
                          </span>
                          <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-[#FF5E48]/15 text-[#FF5E48] border border-[#FF5E48]/30 shrink-0">
                            {advancedInsights.scoringSpectrum.thrillerPct}%
                          </span>
                        </div>
                        <p className="text-[10px] text-white/40 font-medium leading-relaxed">
                          Nail-biting sudden death matches decided at 5-4 or finals deuce 6-5.
                        </p>
                      </div>

                      {advancedInsights.scoringSpectrum.thrillerLeader && (
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[9px] uppercase font-bold text-[#FF5E48]/80 tracking-wider truncate">
                              Top Clutch Finisher
                            </div>
                            <div className="text-xs font-black text-[#F3F4EE] truncate">
                              {advancedInsights.scoringSpectrum.thrillerLeader.name}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-mono font-black text-[#FF5E48]">
                              {advancedInsights.scoringSpectrum.thrillerLeader.thrillerWins}W - {advancedInsights.scoringSpectrum.thrillerLeader.thrillerLosses}L
                            </div>
                            <div className="text-[9px] font-mono font-bold text-white/40">
                              {advancedInsights.scoringSpectrum.thrillerLeader.thrillerWinRate}% clutch WR
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tier 2: Decisive / Tactical Battles */}
                    <div className="p-3.5 rounded-2xl bg-[#16181F] border border-[#6C79E0]/20 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[11px] font-black uppercase tracking-wider text-[#6C79E0] flex items-center gap-1.5">
                            ⚔️ Decisive Battles
                          </span>
                          <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-[#6C79E0]/15 text-[#6C79E0] border border-[#6C79E0]/30 shrink-0">
                            {advancedInsights.scoringSpectrum.competitivePct}%
                          </span>
                        </div>
                        <p className="text-[10px] text-white/40 font-medium leading-relaxed">
                          Controlled 2–3 pt margins (5-2, 5-3) where tactical point swings decided the outcome.
                        </p>
                      </div>

                      {advancedInsights.scoringSpectrum.blowoutResilient ? (
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[9px] uppercase font-bold text-[#6C79E0]/80 tracking-wider truncate">
                              Iron Shield (Toughest Out)
                            </div>
                            <div className="text-xs font-black text-[#F3F4EE] truncate">
                              {advancedInsights.scoringSpectrum.blowoutResilient.name}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-mono font-black text-[#6C79E0]">
                              {advancedInsights.scoringSpectrum.blowoutResilient.blowoutsSuffered === 0
                                ? "0 Conceded"
                                : `${advancedInsights.scoringSpectrum.blowoutResilient.blowoutsSuffered} Conceded`}
                            </div>
                            <div className="text-[9px] font-mono font-bold text-white/40">
                              Fewest blowouts
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                          <div className="text-[9px] uppercase font-bold text-[#6C79E0]/80 tracking-wider">
                            Squad Core
                          </div>
                          <div className="text-xs font-mono font-black text-[#6C79E0]">
                            {advancedInsights.scoringSpectrum.competitiveCount} matches
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tier 3: Demolitions & Blowouts */}
                    <div className="p-3.5 rounded-2xl bg-[#16181F] border border-[#9EC9A8]/20 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[11px] font-black uppercase tracking-wider text-[#9EC9A8] flex items-center gap-1.5">
                            💥 Demolitions (≥4 pts)
                          </span>
                          <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-[#9EC9A8]/15 text-[#9EC9A8] border border-[#9EC9A8]/30 shrink-0">
                            {advancedInsights.scoringSpectrum.blowoutsPct}%
                          </span>
                        </div>
                        <p className="text-[10px] text-white/40 font-medium leading-relaxed">
                          Runaway blowouts (5-1) and merciless 5-0 bagels with total offensive supremacy.
                        </p>
                      </div>

                      {advancedInsights.scoringSpectrum.blowoutDeliverer && (
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[9px] uppercase font-bold text-[#9EC9A8]/80 tracking-wider truncate">
                              Demolition Hammer
                            </div>
                            <div className="text-xs font-black text-[#F3F4EE] truncate">
                              {advancedInsights.scoringSpectrum.blowoutDeliverer.name}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-mono font-black text-[#9EC9A8]">
                              {advancedInsights.scoringSpectrum.blowoutDeliverer.blowoutsDelivered} Dealt
                            </div>
                            <div className="text-[9px] font-mono font-bold text-white/40">
                              ≥4 pt blowouts
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Most Frequent Scorelines in Squad History */}
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                        📊 Most Frequent Final Scorelines in Squad History
                      </span>
                      <span className="text-[10px] text-white/40 font-medium">
                        Ranked by total historical occurrences
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {advancedInsights.scoringSpectrum.topScorelines.slice(0, 6).map((sc, i) => (
                        <div
                          key={sc.score}
                          className={`p-2.5 rounded-xl border flex flex-col justify-between items-center text-center transition-all ${
                            sc.margin >= 4
                              ? "bg-[#9EC9A8]/5 border-[#9EC9A8]/20"
                              : sc.margin === 1
                              ? "bg-[#FF5E48]/5 border-[#FF5E48]/20"
                              : "bg-[#6C79E0]/5 border-[#6C79E0]/20"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[9px] font-mono font-bold text-white/40">
                              #{i + 1}
                            </span>
                            <span
                              className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                                sc.margin >= 4
                                  ? "bg-[#9EC9A8]/15 text-[#9EC9A8] border border-[#9EC9A8]/30"
                                  : sc.margin === 1
                                  ? "bg-[#FF5E48]/15 text-[#FF5E48] border border-[#FF5E48]/30"
                                  : "bg-[#6C79E0]/15 text-[#6C79E0] border border-[#6C79E0]/30"
                              }`}
                            >
                              {sc.margin >= 4 ? "Blowout" : sc.margin === 1 ? "Thriller" : "Decisive"}
                            </span>
                          </div>
                          <div className="text-base font-black font-mono text-[#F3F4EE] my-1">
                            {sc.score}
                          </div>
                          <div className="text-[10px] font-semibold text-white/40 font-mono">
                            <strong className="text-[#F3F4EE]">{sc.count}</strong> matches ({sc.percentage}%)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Day Champions & Day Last-Place Hall of Fame Bento Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Day Champions Card */}
            <div className="bg-[#1E2128] border border-white/10 rounded-[26px] p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#F5BA38]/15 border border-[#F5BA38]/25 flex items-center justify-center text-sm shadow-2xs">
                  👑
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#F3F4EE]">Day Champions</h3>
                  <p className="text-[10px] text-[#F5BA38]/70 font-semibold">Daily 1st place finishes (All squad members)</p>
                </div>
              </div>

              {displayedDayHonors?.dayChampions && displayedDayHonors.dayChampions.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar pr-1">
                  {displayedDayHonors.dayChampions.map((c) => (
                    <div
                      key={c.playerId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#16181F] border border-white/5"
                    >
                      <div className="flex items-center gap-2">
                        <AvatarSVG type={c.avatar} size={28} emoji={c.emoji} color={c.color} />
                        <span className="text-xs font-extrabold text-[#F3F4EE]">{c.name}</span>
                      </div>
                      <div className="px-2.5 py-0.5 bg-[#F5BA38]/15 border border-[#F5BA38]/30 rounded-full text-[10px] font-black text-[#F5BA38]">
                        {c.count} {c.count === 1 ? "Day" : "Days"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-white/40 text-center py-4">
                  Close a day table to crown day champions!
                </div>
              )}
            </div>

            {/* Day Last Place Card */}
            <div className="bg-[#1E2128] border border-white/10 rounded-[26px] p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FF5E48]/15 border border-[#FF5E48]/25 flex items-center justify-center text-sm shadow-2xs">
                  🥄
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#F3F4EE]">Wooden Spoon</h3>
                  <p className="text-[10px] text-[#FF5E48]/70 font-semibold">Daily last-place finishes (All squad members)</p>
                </div>
              </div>

              {displayedDayHonors?.dayLastPlaces && displayedDayHonors.dayLastPlaces.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar pr-1">
                  {displayedDayHonors.dayLastPlaces.map((c) => (
                    <div
                      key={c.playerId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#16181F] border border-white/5"
                    >
                      <div className="flex items-center gap-2">
                        <AvatarSVG type={c.avatar} size={28} emoji={c.emoji} color={c.color} />
                        <span className="text-xs font-extrabold text-[#F3F4EE]">{c.name}</span>
                      </div>
                      <div className="px-2.5 py-0.5 bg-[#FF5E48]/15 border border-[#FF5E48]/30 rounded-full text-[10px] font-black text-[#FF5E48]">
                        {c.count} {c.count === 1 ? "Day" : "Days"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-white/40 text-center py-4">
                  No last place finishes recorded yet.
                </div>
              )}
            </div>
          </div>

          {/* Day by Day History */}
          {dayHonors?.history && dayHonors.history.length > 0 && (
            <div className="bg-[#1E2128] border border-white/10 rounded-[26px] p-4 space-y-2 shadow-xs">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#F3F4EE]">📅 Day Results Archive</h4>
              <div className="divide-y divide-white/5">
                {dayHonors.history.map((h) => (
                  <div key={h.id} className="py-2.5 flex items-center justify-between text-xs">
                    <span className="font-mono text-white/40 text-xs font-bold">{formatDateDDMMYY(h.date)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#F5BA38] font-bold flex items-center gap-1 bg-[#F5BA38]/15 border border-[#F5BA38]/25 px-2.5 py-0.5 rounded-full text-[11px]">
                        👑 {h.topPlayerName}
                      </span>
                      <span className="text-[#FF5E48] font-bold flex items-center gap-1 bg-[#FF5E48]/15 border border-[#FF5E48]/25 px-2.5 py-0.5 rounded-full text-[11px]">
                        🥄 {h.bottomPlayerName}
                      </span>
                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => setDayToDelete(h.date)}
                          title={`Delete Day Result for ${h.date}`}
                          className="w-6 h-6 rounded-full hover:bg-[#FF5E48]/20 text-white/40 hover:text-[#FF5E48] transition-colors flex items-center justify-center cursor-pointer text-xs ml-1"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-[#1E2128] border border-white/10 rounded-[32px] p-6 shadow-2xl space-y-4 text-[#F3F4EE]"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#FF5E48]/15 border border-[#FF5E48]/30 flex items-center justify-center text-xl text-[#FF5E48] shadow-2xs">
                  🗑️
                </div>
                <div>
                  <h2 className="text-base font-black text-[#F3F4EE]">Delete Tournament?</h2>
                  <p className="text-[11px] text-white/40 font-medium">Remove accidental or test match</p>
                </div>
              </div>

              <p className="text-xs text-white/60 leading-relaxed">
                This will permanently delete this tournament and its matches, and automatically recalculate player points and day standings.
              </p>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setTournamentToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold text-white/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTournament(tournamentToDelete)}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 rounded-full bg-[#FF5E48] hover:bg-[#ff462e] active:scale-95 text-xs font-black uppercase tracking-wider text-white shadow-md transition-all flex items-center justify-center gap-1.5"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-[#1E2128] border border-white/10 rounded-[32px] p-6 shadow-2xl space-y-4 text-[#F3F4EE]"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#FF5E48]/15 border border-[#FF5E48]/30 flex items-center justify-center text-xl text-[#FF5E48] shadow-2xs">
                  🗑️
                </div>
                <div>
                  <h2 className="text-base font-black text-[#F3F4EE]">Delete Day Table?</h2>
                  <p className="text-[11px] text-white/40 font-medium">{formatDateDDMMYY(dayToDelete)}</p>
                </div>
              </div>

              <p className="text-xs text-white/60 leading-relaxed">
                This will permanently delete the day table, all tournaments, matches, and day champions for {formatDateDDMMYY(dayToDelete)}.
              </p>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDayToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold text-white/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteDay(dayToDelete)}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 rounded-full bg-[#FF5E48] hover:bg-[#ff462e] active:scale-95 text-xs font-black uppercase tracking-wider text-white shadow-md transition-all flex items-center justify-center gap-1.5"
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
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              className="relative z-10 w-full max-w-md bg-[#1A1D24] border-t border-white/10 rounded-t-[36px] shadow-2xl pb-8 pt-4 px-5 space-y-4 max-h-[82vh] overflow-y-auto"
            >
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto" />

              {/* Sheet Header */}
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <div>
                  <h3 className="text-base font-black text-[#F3F4EE]">Filter History</h3>
                  <p className="text-xs text-white/40 font-medium">Customize matches &amp; stats view</p>
                </div>
                <div className="flex items-center gap-2">
                  {hasActiveFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setRangeFilter("all");
                        setPlayerFilter("all");
                        setPatternFilter("all");
                        setHistoryFormatFilter("all");
                      }}
                      className="text-xs font-bold text-[#FF5E48] hover:text-[#ff462e] bg-[#FF5E48]/15 border border-[#FF5E48]/30 px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                    >
                      Reset All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowFilterMenu(false)}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/15 text-white/70 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* 1. Time Range */}
              <div>
                <label className="block text-[11px] uppercase font-black tracking-wider text-white/40 mb-2">
                  📅 Time Range
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {rangeOptions.map((opt) => {
                    const selected = rangeFilter === opt.value;

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRangeFilter(opt.value as any)}
                        className={`py-2 px-1 text-center text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                          selected
                            ? "bg-[#F3F4EE] text-[#14161B] shadow-xs"
                            : "bg-[#16181F] hover:bg-white/10 text-white/70 border border-white/5"
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
                <label className="block text-[11px] uppercase font-black tracking-wider text-white/40 mb-2">
                  👤 Squad Players
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setPlayerFilter("all")}
                    className={`py-1.5 px-3 text-xs font-extrabold rounded-full transition-all cursor-pointer ${
                      playerFilter === "all"
                        ? "bg-[#F3F4EE] text-[#14161B] shadow-xs"
                        : "bg-[#16181F] hover:bg-white/10 text-white/70 border border-white/5"
                    }`}
                  >
                    All Players
                  </button>
                  {players.map((p) => {
                    const selected = playerFilter === p.id;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlayerFilter(p.id)}
                        className={`py-1 px-2.5 text-xs font-extrabold rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                          selected
                            ? "bg-[#F3F4EE] text-[#14161B] shadow-xs ring-1 ring-[#F3F4EE]"
                            : "bg-[#16181F] hover:bg-white/10 text-white/70 border border-white/5"
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
                <label className="block text-[11px] uppercase font-black tracking-wider text-white/40 mb-2">
                  🎯 Match Outcome / Score
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {patternOptions.map((opt) => {
                    const selected = patternFilter === opt.value;

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPatternFilter(opt.value)}
                        className={`py-1.5 px-3 text-xs font-extrabold rounded-full transition-all cursor-pointer ${
                          selected
                            ? "bg-[#F3F4EE] text-[#14161B] shadow-xs"
                            : "bg-[#16181F] hover:bg-white/10 text-white/70 border border-white/5"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Tournament Format */}
              <div>
                <label className="block text-[11px] uppercase font-black tracking-wider text-white/40 mb-2">
                  ⚡ Tournament Format
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { key: "all", label: "🌐 Overall" },
                      { key: "round-robin", label: "🔄 Round Robin" },
                      { key: "double-elimination", label: "⚡ Double Elim" },
                    ] as const
                  ).map((fmt) => {
                    const selected = historyFormatFilter === fmt.key;

                    return (
                      <button
                        key={fmt.key}
                        type="button"
                        onClick={() => setHistoryFormatFilter(fmt.key)}
                        className={`py-2 px-1 text-center text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                          selected
                            ? "bg-[#FF5E48] text-white shadow-xs"
                            : "bg-[#16181F] hover:bg-white/10 text-white/70 border border-white/5"
                        }`}
                      >
                        {fmt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Apply Button */}
              <button
                type="button"
                onClick={() => setShowFilterMenu(false)}
                className="w-full py-3.5 bg-[#FF5E48] hover:bg-[#ff462e] text-white font-black uppercase tracking-wider text-xs rounded-2xl shadow-xl shadow-[#FF5E48]/20 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Apply &amp; View Matches</span>
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
