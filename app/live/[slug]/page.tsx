"use client";
// app/live/[slug]/page.tsx — Read-only live tournament viewer for spectator friends

import React, { useEffect, useState, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { io as socketIo, Socket } from "socket.io-client";
import { AvatarSVG } from "@/components/avatars/AvatarSVG";
import { TournamentTable } from "@/components/TournamentTable";
import { MatchCard } from "@/components/MatchCard";
import { Player, Match, Tournament, TournamentRow } from "@/lib/types";

interface LiveData {
  tournament: any;
  matches: Match[];
  players: Player[];
  standings: TournamentRow[];
}

export default function LiveViewerPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"fixtures" | "table">("fixtures");
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // Fetch initial tournament data
  const fetchData = async () => {
    try {
      const res = await fetch(`${backendUrl}/tournaments/${slug}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Tournament not found. Check the link or ask the scorekeeper.");
        }
        throw new Error(`Server returned ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.warn("Live fetch error:", err.message);
      // If backend is waking up or local fallback
      if (loading) {
        setError(err.message || "Failed to connect to tournament stream");
      }
    }
  };

  useEffect(() => {
    fetchData();

    // Setup Socket.io client
    let socket: Socket | null = null;
    try {
      socket = socketIo(backendUrl, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      socket.on("connect", () => {
        setSocketConnected(true);
        socket?.emit("join:tournament", slug);
      });

      socket.on("disconnect", () => {
        setSocketConnected(false);
      });

      socket.on("tournament:update", () => {
        // Re-fetch latest snapshot on any realtime event
        fetchData();
      });
    } catch (err) {
      console.warn("Socket.io connection error:", err);
    }

    // 5s polling fallback in case socket disconnects courtside
    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.emit("leave:tournament", slug);
        socket.disconnect();
      }
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4" />
        <h2 className="text-white font-bold text-lg">Connecting to Court Stream...</h2>
        <p className="text-white/40 text-xs mt-1">Live updates via Socket.io</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-3">🏸</div>
        <h2 className="text-white font-black text-xl mb-2">Tournament Stream Unavailable</h2>
        <p className="text-white/50 text-sm max-w-xs mb-6">{error}</p>
        <button
          onClick={() => { setLoading(true); setError(null); fetchData(); }}
          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all"
        >
          Retry Connection ↻
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { tournament, matches, players, standings } = data;
  const playedMatches = matches.filter((m) => m.played && !m.isFinal);
  const roundRobinMatches = matches.filter((m) => !m.isFinal);
  const finalMatch = matches.find((m) => m.isFinal);
  const isCompleted = tournament.status === "completed";

  const getPlayer = (id: string): Player =>
    players.find((p) => p.id === id) ?? { id, name: id, avatar: "custom" as any };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col max-w-md mx-auto border-x border-white/5">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-white/10 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏸</span>
            <div>
              <h1 className="text-white font-black text-lg leading-tight">Badminton Live</h1>
              <p className="text-white/40 text-[11px]">Spectator Mode (Read-only)</p>
            </div>
          </div>

          {/* Connection status badge */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-xs">
            <span className={`w-2 h-2 rounded-full ${socketConnected ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
            <span className="text-white/70 font-medium text-[11px]">
              {socketConnected ? "Live" : "Polling"}
            </span>
          </div>
        </div>

        {/* Progress & info */}
        <div className="flex items-center justify-between text-xs text-white/50 mb-3">
          <span>
            {playedMatches.length}/{roundRobinMatches.length} round-robin played
          </span>
          {lastUpdated && <span>Updated {lastUpdated}</span>}
        </div>

        {/* Segmented Control */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          <button
            onClick={() => setTab("fixtures")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === "fixtures" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            📋 Fixtures ({matches.length})
          </button>
          <button
            onClick={() => setTab("table")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === "table" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            📊 Standings Table
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Grand Final Banner if active or completed */}
        {finalMatch && (
          <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/20 border border-yellow-500/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-yellow-400 font-bold text-xs uppercase tracking-widest flex items-center gap-1">
                <span>🏆</span>
                <span>{isCompleted ? "Final Result" : "Grand Final"}</span>
              </span>
              {isCompleted && (
                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full font-bold">
                  Completed
                </span>
              )}
            </div>

            <div className="flex items-center justify-around py-2">
              <div className="flex flex-col items-center gap-1">
                <AvatarSVG
                  type={getPlayer(finalMatch.playerA).avatar}
                  size={48}
                  emoji={getPlayer(finalMatch.playerA).avatarEmoji}
                  color={getPlayer(finalMatch.playerA).avatarColor}
                />
                <span className="text-white font-bold text-xs truncate max-w-[80px]">
                  {getPlayer(finalMatch.playerA).name}
                </span>
                {finalMatch.played && (
                  <span className="text-lg font-black text-white">{finalMatch.scoreA}</span>
                )}
              </div>

              <div className="text-white/30 font-black text-xl">VS</div>

              <div className="flex flex-col items-center gap-1">
                <AvatarSVG
                  type={getPlayer(finalMatch.playerB).avatar}
                  size={48}
                  emoji={getPlayer(finalMatch.playerB).avatarEmoji}
                  color={getPlayer(finalMatch.playerB).avatarColor}
                />
                <span className="text-white font-bold text-xs truncate max-w-[80px]">
                  {getPlayer(finalMatch.playerB).name}
                </span>
                {finalMatch.played && (
                  <span className="text-lg font-black text-white">{finalMatch.scoreB}</span>
                )}
              </div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {tab === "fixtures" ? (
            <motion.div
              key="fixtures"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {roundRobinMatches.map((match, idx) => {
                const pA = getPlayer(match.playerA);
                const pB = getPlayer(match.playerB);
                return (
                  <MatchCard
                    key={match.id}
                    match={match}
                    playerA={pA}
                    playerB={pB}
                    isUpNext={!match.played && (idx === 0 || roundRobinMatches[idx - 1].played)}
                    index={idx}
                    onTap={() => {}} // spectator read-only
                  />
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TournamentTable
                rows={standings}
                players={players}
                showFinalLabel={isCompleted}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 text-center text-white/30 text-[11px]">
        🏸 Auto-updating courtside viewer · Powered by Socket.io
      </div>
    </div>
  );
}
