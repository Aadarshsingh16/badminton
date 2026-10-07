"use client";
// app/live/[slug]/page.tsx — Real-time live spectator stream for Day Sessions and Tournaments

import React, { useEffect, useState, use, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { io as socketIo, Socket } from "socket.io-client";
import { AvatarSVG } from "@/components/avatars/AvatarSVG";
import { TournamentTable } from "@/components/TournamentTable";
import { MatchCard } from "@/components/MatchCard";
import { Player, Match, Tournament, TournamentRow } from "@/lib/types";
import { useStore } from "@/lib/store";
import { computeTournamentTable } from "@/lib/ranking";
import { setViewerSlug, clearViewerMode } from "@/lib/viewerMode";
import { getBackendUrl } from "@/lib/backend";
import Link from "next/link";

interface DayStandingItem {
  playerId: string;
  name: string;
  avatar: any;
  avatarEmoji?: string;
  avatarColor?: string;
  points: number;
}

interface LiveTournamentData {
  id: string;
  shareSlug: string;
  status: "active" | "completed";
  createdAt: string | number;
  completedAt?: string | number;
  config: any;
  matches: Match[];
  final: Match | null;
  standings: TournamentRow[];
}

interface DaySessionData {
  date: string;
  closed: boolean;
  totals: Record<string, number>;
  activeTournament: LiveTournamentData | null;
  tournaments: LiveTournamentData[];
  players: Player[];
  dayStandings: DayStandingItem[];
}

const RANK_MEDALS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"];

export default function LiveViewerPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  const isDateSlug = /^\d{4}-\d{2}-\d{2}$/.test(slug);

  const [dayData, setDayData] = useState<DaySessionData | null>(null);
  const [singleTourneyData, setSingleTourneyData] = useState<{
    tournament: any;
    matches: Match[];
    players: Player[];
    standings: TournamentRow[];
    dayDate?: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [isWaiting, setIsWaiting] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [tab, setTab] = useState<"court" | "day-table" | "tournaments">("court");
  const [courtSubTab, setCourtSubTab] = useState<"fixtures" | "table">("fixtures");
  const [expandedTournamentId, setExpandedTournamentId] = useState<string | null>(null);

  const backendUrl = getBackendUrl();

  // Helper to resolve player info
  const getPlayer = (id: string, playerList: Player[]): Player =>
    playerList.find((p) => p.id === id) ?? {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      avatar: "custom" as any,
    };

  // 1. Fetch Day Session data
  const fetchDaySession = async (targetDate: string) => {
    // Check local store first (for instant host or offline preview)
    const state = useStore.getState();
    const isCurrentDate = state.dayTable.date === targetDate;

    if (isCurrentDate && (state.currentTournament || state.pastTournaments.length > 0)) {
      const allTourneys = [...state.pastTournaments];
      if (state.currentTournament) {
        allTourneys.push(state.currentTournament);
      }

      const tourneysMapped: LiveTournamentData[] = allTourneys.map((t) => {
        const standings = computeTournamentTable(t);
        return {
          id: t.id,
          shareSlug: t.shareSlug ?? t.id,
          status: t.closed ? "completed" : "active",
          createdAt: t.createdAt ?? new Date().toISOString(),
          config: t.config,
          matches: t.matches,
          final: t.final ?? null,
          standings,
        };
      });

      const activeT = state.currentTournament
        ? tourneysMapped.find((t) => t.id === state.currentTournament?.id) || null
        : tourneysMapped[tourneysMapped.length - 1] || null;

      const standingsList: DayStandingItem[] = Object.entries(state.dayTable.totals)
        .map(([playerId, points]) => {
          const p = state.players.find((x) => x.id === playerId);
          return {
            playerId,
            name: p?.name || playerId,
            avatar: p?.avatar || "custom",
            avatarEmoji: p?.avatarEmoji,
            avatarColor: p?.avatarColor,
            points,
          };
        })
        .sort((a, b) => b.points - a.points);

      setDayData({
        date: targetDate,
        closed: false,
        totals: state.dayTable.totals,
        activeTournament: activeT,
        tournaments: tourneysMapped,
        players: state.players,
        dayStandings: standingsList,
      });
      setIsWaiting(false);
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    }

    // Always fetch latest authoritative data from backend
    try {
      const res = await fetch(`${backendUrl}/day-tables/${targetDate}`);
      if (res.ok) {
        const json: any = await res.json();

        // 1. Resolve players
        let resolvedPlayers: Player[] = Array.isArray(json.players) ? json.players : [];

        // 2. Resolve active tournament
        let resolvedActiveT: LiveTournamentData | null = null;

        if (json.activeTournament && Array.isArray(json.activeTournament.matches) && json.activeTournament.matches.length > 0) {
          resolvedActiveT = json.activeTournament;
        } else if (Array.isArray(json.tournaments) && json.tournaments.length > 0) {
          // Find tournament marked 'active', or the latest tournament
          const activeMeta = json.tournaments.find((t: any) => t.status === "active") || json.tournaments[json.tournaments.length - 1];
          if (activeMeta) {
            if (Array.isArray(activeMeta.matches) && activeMeta.matches.length > 0) {
              resolvedActiveT = activeMeta;
            } else {
              // Fetch full details for this tournament from backend!
              try {
                const tRes = await fetch(`${backendUrl}/tournaments/${activeMeta.id}`);
                if (tRes.ok) {
                  const tJson = await tRes.json();
                  const rrMatches = (tJson.matches || []).filter((m: any) => !m.isFinal && m.round !== -1);
                  const fMatch = (tJson.matches || []).find((m: any) => m.isFinal || m.round === -1) || null;
                  resolvedActiveT = {
                    id: tJson.tournament.id,
                    shareSlug: tJson.tournament.shareSlug || tJson.tournament.id,
                    status: tJson.tournament.status || "active",
                    createdAt: tJson.tournament.created_at || new Date().toISOString(),
                    config: tJson.tournament.config,
                    matches: rrMatches,
                    final: fMatch,
                    standings: tJson.standings || [],
                  };
                  if (Array.isArray(tJson.players) && tJson.players.length > 0) {
                    resolvedPlayers = tJson.players;
                  }
                }
              } catch (err) {
                console.warn("Failed to fetch full active tournament:", err);
              }
            }
          }
        }

        // 3. Resolve day standings
        const resolvedTotals = json.totals || {};
        let resolvedStandings: DayStandingItem[] = [];

        if (Array.isArray(json.dayStandings) && json.dayStandings.length > 0) {
          resolvedStandings = json.dayStandings;
        } else if (Object.keys(resolvedTotals).length > 0) {
          resolvedStandings = Object.entries(resolvedTotals)
            .map(([playerId, points]) => {
              const p = resolvedPlayers.find((x) => x.id === playerId) || getPlayer(playerId, resolvedPlayers);
              return {
                playerId,
                name: p.name || playerId,
                avatar: p.avatar || "custom",
                avatarEmoji: p.avatarEmoji,
                avatarColor: p.avatarColor,
                points: points as number,
              };
            })
            .sort((a, b) => b.points - a.points);
        }

        setDayData({
          date: targetDate,
          closed: !!json.closed,
          totals: resolvedTotals,
          activeTournament: resolvedActiveT,
          tournaments: json.tournaments || (resolvedActiveT ? [resolvedActiveT] : []),
          players: resolvedPlayers,
          dayStandings: resolvedStandings,
        });

        setIsWaiting(false);
        setLoading(false);
        setLastUpdated(new Date().toLocaleTimeString());
      } else if (res.status === 404 && !dayData) {
        setIsWaiting(true);
        setLoading(false);
      }
    } catch {
      if (!dayData) {
        setIsWaiting(true);
      }
      setLoading(false);
    }
  };

  // 2. Fetch Single Tournament fallback (if slug is not a date)
  const fetchSingleTournament = async (tourneySlug: string) => {
    try {
      const res = await fetch(`${backendUrl}/tournaments/${tourneySlug}`);
      if (res.ok) {
        const json = await res.json();
        setSingleTourneyData({
          tournament: json.tournament,
          matches: json.matches,
          players: json.players,
          standings: json.standings,
          dayDate: json.tournament?.dayDate,
        });

        // If tournament is part of a day session, automatically load full day data as well!
        const sessionDate =
          json.tournament?.dayDate ||
          (json.tournament?.created_at ? json.tournament.created_at.split("T")[0] : null);

        if (sessionDate) {
          fetchDaySession(sessionDate);
        }
        setIsWaiting(false);
        setLoading(false);
        setLastUpdated(new Date().toLocaleTimeString());
      } else {
        // Fallback to local store
        const state = useStore.getState();
        const found =
          (state.currentTournament?.shareSlug === tourneySlug || state.currentTournament?.id === tourneySlug)
            ? state.currentTournament
            : state.pastTournaments.find((t) => t.shareSlug === tourneySlug || t.id === tourneySlug);

        if (found) {
          const standings = computeTournamentTable(found);
          setSingleTourneyData({
            tournament: found,
            matches: [...found.matches, ...(found.final ? [found.final] : [])],
            players: state.players,
            standings,
            dayDate: state.dayTable.date,
          });
          setIsWaiting(false);
          setLoading(false);
          setLastUpdated(new Date().toLocaleTimeString());
        } else {
          setIsWaiting(true);
          setLoading(false);
        }
      }
    } catch {
      setIsWaiting(true);
      setLoading(false);
    }
  };

  // Main Effect: Data fetching & Socket.io setup
  useEffect(() => {
    setViewerSlug(slug);

    if (isDateSlug) {
      fetchDaySession(slug);
    } else {
      fetchSingleTournament(slug);
    }

    // Connect Socket.io
    let socket: Socket | null = null;
    try {
      socket = socketIo(backendUrl, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      socket.on("connect", () => {
        setSocketConnected(true);
        if (isDateSlug) {
          socket?.emit("join:day", slug);
        } else {
          socket?.emit("join:tournament", slug);
        }
      });

      socket.on("disconnect", () => {
        setSocketConnected(false);
      });

      // Handle Day updates
      socket.on("day:update", () => {
        if (isDateSlug) {
          fetchDaySession(slug);
        } else if (singleTourneyData?.dayDate) {
          fetchDaySession(singleTourneyData.dayDate);
        }
      });

      // Handle tournament updates
      socket.on("tournament:update", () => {
        if (!isDateSlug) {
          fetchSingleTournament(slug);
        } else {
          fetchDaySession(slug);
        }
      });
    } catch (err) {
      console.warn("Socket.io initialization error:", err);
    }

    // 4s polling fallback
    const interval = setInterval(() => {
      if (isDateSlug) {
        fetchDaySession(slug);
      } else {
        fetchSingleTournament(slug);
      }
    }, 4000);

    return () => {
      clearInterval(interval);
      if (socket) {
        if (isDateSlug) socket.emit("leave:day", slug);
        else socket.emit("leave:tournament", slug);
        socket.disconnect();
      }
    };
  }, [slug, isDateSlug]);

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <h2 className="text-white font-bold text-lg">Connecting to Court Stream...</h2>
        <p className="text-white/40 text-xs mt-1">Live courtside sync via Socket.io</p>
      </div>
    );
  }

  // Waiting Screen (no games started yet today)
  if (isWaiting && !dayData && !singleTourneyData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          animate={{ scale: [1, 1.08, 1], rotate: [0, 6, -6, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="w-16 h-16 rounded-3xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-3xl mb-4 shadow-lg shadow-indigo-500/20"
        >
          🏸
        </motion.div>
        <h2 className="text-white font-black text-xl mb-2">Court Stream Connecting</h2>
        <p className="text-white/60 text-xs max-w-xs mb-5 leading-relaxed">
          Waiting for the scorekeeper to broadcast tournament matches for {slug}. This screen will auto-refresh the moment court play begins!
        </p>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-indigo-300 text-xs font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
          Listening for live match updates...
        </div>
        <button
          onClick={() => {
            setLoading(true);
            if (isDateSlug) fetchDaySession(slug);
            else fetchSingleTournament(slug);
          }}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
        >
          <span>↻</span>
          <span>Refresh Live Stream</span>
        </button>
      </div>
    );
  }

  // Determine active view payload
  const activeTournament = dayData?.activeTournament || (singleTourneyData ? {
    id: singleTourneyData.tournament.id,
    shareSlug: singleTourneyData.tournament.shareSlug || singleTourneyData.tournament.id,
    status: singleTourneyData.tournament.status || "active",
    createdAt: singleTourneyData.tournament.created_at || new Date().toISOString(),
    config: singleTourneyData.tournament.config,
    matches: singleTourneyData.matches.filter((m) => !m.isFinal && m.round !== -1),
    final: singleTourneyData.matches.find((m) => m.isFinal || m.round === -1) || null,
    standings: singleTourneyData.standings,
  } : null);

  const allPlayers = dayData?.players || singleTourneyData?.players || [];
  const dayStandings = dayData?.dayStandings || [];
  const allTournaments = dayData?.tournaments || (activeTournament ? [activeTournament] : []);

  const currentMatches = activeTournament?.matches || [];
  const currentFinal = activeTournament?.final || null;
  const playedMatches = currentMatches.filter((m) => m.played);
  const isTournamentCompleted = activeTournament?.status === "completed" || (currentFinal?.played ?? false);

  const activeIndex = allTournaments.findIndex((t) => t.id === activeTournament?.id);
  const tournamentDisplayNumber = activeIndex >= 0 ? activeIndex + 1 : allTournaments.length;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col max-w-md mx-auto border-x border-white/5">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-white/10 px-4 pt-3.5 pb-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏸</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-black text-lg leading-tight">Badminton Live</h1>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Spectator
                </span>
              </div>
              <p className="text-white/40 text-[11px] font-medium">
                {isDateSlug ? `Session: ${slug}` : "Live Tournament"}
              </p>
            </div>
          </div>

          {/* Right Header Status & Host Mode button */}
          <div className="flex items-center gap-2">
            <Link
              href="/"
              onClick={() => clearViewerMode()}
              className="text-[11px] text-white/70 hover:text-white bg-white/5 border border-white/10 px-2.5 py-1 rounded-full transition-all font-semibold flex items-center gap-1 active:scale-95"
            >
              <span>⚙️</span>
              <span>Host</span>
            </Link>

            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-xs">
              <span className={`w-2 h-2 rounded-full ${socketConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span className="text-white/80 font-bold text-[11px]">
                {socketConnected ? "Live" : "Polling"}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-2xl">
          <button
            onClick={() => setTab("court")}
            className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all ${
              tab === "court"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            🏸 Live Court
          </button>
          <button
            onClick={() => setTab("day-table")}
            className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all relative ${
              tab === "day-table"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            📊 Day Table
            {dayStandings.length > 0 && (
              <span className="ml-1 text-[10px] opacity-75 font-normal">
                ({dayStandings.length})
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("tournaments")}
            className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all ${
              tab === "tournaments"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            📋 Today ({allTournaments.length})
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* ——— TAB 1: LIVE COURT ——— */}
        {tab === "court" && (
          <motion.div
            key="court-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {activeTournament ? (
              <>
                {/* Active Tournament Status Bar */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                      Tournament #{tournamentDisplayNumber}
                    </span>
                    <h3 className="text-white font-extrabold text-sm">
                      {isTournamentCompleted ? "Tournament Concluded 🏆" : "Round-Robin in Progress"}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-white/50 font-medium block">
                      {playedMatches.length}/{currentMatches.length} played
                    </span>
                    {lastUpdated && (
                      <span className="text-[9px] text-white/30">Synced {lastUpdated}</span>
                    )}
                  </div>
                </div>

                {/* Grand Final Banner (if final is scheduled or completed) */}
                {currentFinal && (
                  <div className="bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-transparent border border-amber-500/40 rounded-3xl p-4 shadow-lg shadow-amber-500/5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-amber-400 font-black text-xs uppercase tracking-widest flex items-center gap-1.5">
                        <span>🏆</span>
                        <span>{isTournamentCompleted ? "Grand Final Result" : "Grand Final"}</span>
                      </span>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                        currentFinal.played ? "bg-amber-400/20 text-amber-300" : "bg-white/10 text-white/70"
                      }`}>
                        {currentFinal.played ? "Final Scored ✓" : "Upcoming"}
                      </span>
                    </div>

                    <div className="flex items-center justify-around py-1">
                      {/* Finalist A */}
                      <div className="flex flex-col items-center gap-1 text-center">
                        <AvatarSVG
                          type={getPlayer(currentFinal.playerA, allPlayers).avatar}
                          size={48}
                          emoji={getPlayer(currentFinal.playerA, allPlayers).avatarEmoji}
                          color={getPlayer(currentFinal.playerA, allPlayers).avatarColor}
                        />
                        <span className="text-white font-bold text-xs truncate max-w-[85px]">
                          {getPlayer(currentFinal.playerA, allPlayers).name}
                        </span>
                        {currentFinal.played && (
                          <span className={`text-xl font-black ${
                            (currentFinal.scoreA ?? 0) > (currentFinal.scoreB ?? 0) ? "text-amber-400" : "text-white/60"
                          }`}>
                            {currentFinal.scoreA}
                          </span>
                        )}
                      </div>

                      <div className="text-white/20 font-black text-lg">VS</div>

                      {/* Finalist B */}
                      <div className="flex flex-col items-center gap-1 text-center">
                        <AvatarSVG
                          type={getPlayer(currentFinal.playerB, allPlayers).avatar}
                          size={48}
                          emoji={getPlayer(currentFinal.playerB, allPlayers).avatarEmoji}
                          color={getPlayer(currentFinal.playerB, allPlayers).avatarColor}
                        />
                        <span className="text-white font-bold text-xs truncate max-w-[85px]">
                          {getPlayer(currentFinal.playerB, allPlayers).name}
                        </span>
                        {currentFinal.played && (
                          <span className={`text-xl font-black ${
                            (currentFinal.scoreB ?? 0) > (currentFinal.scoreA ?? 0) ? "text-amber-400" : "text-white/60"
                          }`}>
                            {currentFinal.scoreB}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-tab Switcher: Fixtures vs Current Standings */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
                    <button
                      onClick={() => setCourtSubTab("fixtures")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        courtSubTab === "fixtures"
                          ? "bg-white/15 text-white"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      🏸 Fixtures ({currentMatches.length})
                    </button>
                    <button
                      onClick={() => setCourtSubTab("table")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        courtSubTab === "table"
                          ? "bg-white/15 text-white"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      📊 Table
                    </button>
                  </div>

                  {isTournamentCompleted && (
                    <span className="text-[11px] font-bold text-amber-400/90 flex items-center gap-1">
                      <span>✓</span>
                      <span>Overall Points Awarded</span>
                    </span>
                  )}
                </div>

                {/* Fixtures List */}
                {courtSubTab === "fixtures" ? (
                  <div className="space-y-3">
                    {currentMatches.map((match, idx) => {
                      const pA = getPlayer(match.playerA, allPlayers);
                      const pB = getPlayer(match.playerB, allPlayers);
                      const isUpNext = !match.played && (idx === 0 || currentMatches[idx - 1].played);

                      return (
                        <MatchCard
                          key={match.id}
                          match={match}
                          playerA={pA}
                          playerB={pB}
                          isUpNext={isUpNext}
                          index={idx}
                          onTap={() => {}} // spectator read-only
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-white/10 rounded-3xl p-2 overflow-hidden">
                    <TournamentTable
                      rows={activeTournament.standings}
                      players={allPlayers}
                      showFinalLabel={isTournamentCompleted}
                    />
                  </div>
                )}
              </>
            ) : (
              /* Intermission Screen (between tournaments) */
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-3xl mx-auto">
                  ⏸️
                </div>
                <div>
                  <h3 className="text-white font-extrabold text-lg">Between Tournaments</h3>
                  <p className="text-white/60 text-xs mt-1 max-w-xs mx-auto">
                    Tournament #{allTournaments.length} has completed! Waiting for the scorekeeper to set up Tournament #{allTournaments.length + 1}.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  Live stream will auto-switch when next tournament starts
                </div>

                {/* Preview running Day Table */}
                {dayStandings.length > 0 && (
                  <div className="pt-2 text-left">
                    <p className="text-white/40 text-[11px] font-extrabold uppercase tracking-wider mb-2">
                      Current Day Standings
                    </p>
                    <div className="space-y-1.5">
                      {dayStandings.slice(0, 4).map((s, idx) => (
                        <div
                          key={s.playerId}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{RANK_MEDALS[idx] ?? `${idx + 1}`}</span>
                            <span className="text-xs font-bold text-white">{s.name}</span>
                          </div>
                          <span className="text-xs font-black text-indigo-300">{s.points} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ——— TAB 2: CUMULATIVE DAY TABLE ——— */}
        {tab === "day-table" && (
          <motion.div
            key="day-table-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Header Card */}
            <div className="bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border border-indigo-500/20 rounded-3xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-indigo-400 font-extrabold text-xs uppercase tracking-wider">
                  Session Leaderboard
                </span>
                <span className="text-xs text-white/50">
                  {allTournaments.length} Tournament{allTournaments.length !== 1 ? "s" : ""}
                </span>
              </div>
              <h2 className="text-white font-black text-xl">Cumulative Day Standings</h2>
              <p className="text-white/60 text-xs mt-1">
                Points awarded across all tournaments played today. Top player wins the Day Trophy!
              </p>
            </div>

            {/* Standings List */}
            {dayStandings.length > 0 ? (
              <div className="space-y-2.5">
                {dayStandings.map((standing, idx) => {
                  const medal = RANK_MEDALS[idx] ?? `${idx + 1}`;
                  const isLeader = idx === 0;

                  return (
                    <motion.div
                      key={standing.playerId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                        isLeader
                          ? "bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/40 shadow-sm"
                          : "bg-white/5 border-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg w-7 text-center">{medal}</span>
                        <AvatarSVG
                          type={standing.avatar}
                          size={38}
                          emoji={standing.avatarEmoji}
                          color={standing.avatarColor}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-extrabold text-sm">{standing.name}</span>
                            {isLeader && (
                              <span className="text-[10px] bg-amber-400/20 text-amber-300 font-black px-1.5 py-0.2 rounded-full">
                                Leader 👑
                              </span>
                            )}
                          </div>
                          <span className="text-white/40 text-[10px] font-medium">
                            Rank #{idx + 1}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-xl font-black block tabular-nums ${
                          isLeader ? "text-amber-400" : "text-white"
                        }`}>
                          {standing.points}
                        </span>
                        <span className="text-[10px] text-white/40 font-bold uppercase">day pts</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-white/50 text-xs">
                🏸 No tournament points finalized yet today. Once Tournament #1 finishes, overall day points will accumulate here!
              </div>
            )}
          </motion.div>
        )}

        {/* ——— TAB 3: TODAY'S TOURNAMENTS ——— */}
        {tab === "tournaments" && (
          <motion.div
            key="tournaments-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-white font-extrabold text-sm">Tournaments Played Today</h3>
              <span className="text-xs text-white/40">{allTournaments.length} Total</span>
            </div>

            {allTournaments.length > 0 ? (
              allTournaments.map((t, idx) => {
                const isExpanded = expandedTournamentId === t.id;
                const winnerRow = t.standings?.[0];
                const winnerPlayer = winnerRow ? getPlayer(winnerRow.playerId, allPlayers) : null;
                const isLive = t.id === activeTournament?.id && t.status === "active";

                return (
                  <div
                    key={t.id}
                    className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all"
                  >
                    <button
                      onClick={() => setExpandedTournamentId(isExpanded ? null : t.id)}
                      className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-white/[0.07] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-sm font-black text-white">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-extrabold text-sm">
                              Tournament #{idx + 1}
                            </span>
                            {isLive ? (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.2 rounded-full font-bold animate-pulse">
                                Live Now
                              </span>
                            ) : (
                              <span className="text-[10px] bg-white/10 text-white/50 px-2 py-0.2 rounded-full font-bold">
                                Completed
                              </span>
                            )}
                          </div>
                          {winnerPlayer && (
                            <p className="text-amber-400/90 text-xs font-semibold mt-0.5 flex items-center gap-1">
                              <span>🏆</span>
                              <span>Winner: {winnerPlayer.name} ({winnerRow.dayPoints ?? winnerRow.points} pts)</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="text-white/40 text-xs font-bold">
                        {isExpanded ? "▲ Hide" : "▼ View"}
                      </span>
                    </button>

                    {/* Expanded details: Tournament standings table */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-white/5 bg-slate-900/60">
                        {t.final && t.final.played && (
                          <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
                            <span className="text-amber-400 font-bold">Grand Final:</span>
                            <span className="text-white font-bold">
                              {getPlayer(t.final.playerA, allPlayers).name} {t.final.scoreA} – {t.final.scoreB} {getPlayer(t.final.playerB, allPlayers).name}
                            </span>
                          </div>
                        )}
                        <TournamentTable
                          rows={t.standings}
                          players={allPlayers}
                          showFinalLabel={t.status === "completed"}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-white/50 text-xs">
                No tournaments recorded yet today.
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 text-center text-white/30 text-[11px] flex items-center justify-between">
        <span>🏸 Badminton Live Court</span>
        <span>Auto-syncing courtside stream</span>
      </div>
    </div>
  );
}
