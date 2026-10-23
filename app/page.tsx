"use client";
// app/page.tsx — Play tab: context-aware screen (player-select → setup → fixtures/table → final → summary)

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, FIXED_PLAYERS, getLocalDateString } from "@/lib/store";
import { computeTournamentTable } from "@/lib/ranking";
import { AvatarSVG } from "@/components/avatars/AvatarSVG";
import { AvatarPicker } from "@/components/AvatarPicker";
import { MatchCard } from "@/components/MatchCard";
import { ScoreInput } from "@/components/ScoreInput";
import { TournamentTable } from "@/components/TournamentTable";
import { TournamentSetup } from "@/components/TournamentSetup";
import { ShareModal } from "@/components/ShareModal";
import { PinModal } from "@/components/PinModal";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { Player, Match, AvatarType, TournamentConfig } from "@/lib/types";
import { generateRoundRobin } from "@/lib/fixtures";
import { apiSync } from "@/lib/apiSync";
import { isViewerMode, getViewerSlug, clearViewerMode } from "@/lib/viewerMode";
import { getBackendUrl } from "@/lib/backend";
import { DoubleEliminationBracket } from "@/components/DoubleEliminationBracket";

type FixtureTab = "fixtures" | "table";

export default function PlayPage() {
  const {
    players,
    selectedPlayerIds,
    currentTournament,
    phase,
    needsCoinFlip,
    dayTable,
    pendingConfig,
    togglePlayerSelection,
    addPlayer,
    goToSetup,
    setPendingConfig,
    startTournament,
    confirmMatchScore,
    editMatchScore,
    undoLastMatch,
    toggleCourtSide,
    startFinal,
    confirmFinalScore,
    closeTournament,
    startNextTournament,
    shuffleFixtures,
    cancelTournament,
    setPhase,
    appRole,
    clearAppSession,
  } = useStore();

  const [fixtureTab, setFixtureTab] = useState<FixtureTab>("fixtures");
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [isEditingMatch, setIsEditingMatch] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [coinFlipVisible, setCoinFlipVisible] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showShuffleConfirm, setShowShuffleConfirm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinIsInvalid, setPinIsInvalid] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isFinalSheetOpen, setIsFinalSheetOpen] = useState(true);
  const [finalPendingScores, setFinalPendingScores] = useState({ scoreA: 0, scoreB: 0 });

  // Listen for unauthorized 401s from backend sync
  React.useEffect(() => {
    setIsAuthenticated(apiSync.hasPin());
    if (!apiSync.hasPin()) setShowPinModal(true);

    return apiSync.onUnauthorized(() => {
      setPinIsInvalid(true);
      setShowPinModal(true);
      setIsAuthenticated(false);
    });
  }, []);

  const router = useRouter();

  // Redirect viewer role to Day Table page since Play is for admin scorekeeping
  React.useEffect(() => {
    if (appRole === "viewer") {
      router.replace("/day");
    }
  }, [appRole, router]);

  const ensurePin = (action: () => void) => {
    if (currentTournament?.isPractice) {
      action();
      return;
    }
    if (apiSync.hasPin()) {
      action();
    } else {
      setPendingAction(() => action);
      setPinIsInvalid(false);
      setShowPinModal(true);
    }
  };

  // Harmless frontend keep-alive backup ping while Play tab is mounted
  React.useEffect(() => {
    const backendUrl = getBackendUrl();
    const ping = () => {
      fetch(`${backendUrl}/health`).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Proactively sync active tournament to cloud so spectator stream is guaranteed to exist
  React.useEffect(() => {
    if (currentTournament && !currentTournament.isPractice) {
      apiSync.syncTournamentDirectly(currentTournament, players);
    }
  }, [currentTournament?.id, currentTournament?.isPractice]);

  const getPlayer = (id: string): Player =>
    players.find((p) => p.id === id) ?? { id, name: id, avatar: "custom" as AvatarType };

  // Compute match count for setup screen
  const setupMatchCount = (() => {
    const ids = selectedPlayerIds;
    const { matches } = generateRoundRobin(ids);
    return matches.length;
  })();

  const activeMatch = currentTournament
    ? (currentTournament.matches.find((m) => m.id === activeMatchId) ??
       (currentTournament.final?.id === activeMatchId ? currentTournament.final : null))
    : null;
  const activePlayerA = activeMatch ? getPlayer(activeMatch.playerA) : null;
  const activePlayerB = activeMatch ? getPlayer(activeMatch.playerB) : null;

  const handleScoreConfirm = (sA: number, sB: number) => {
    if (!currentTournament || !activeMatch) return;
    ensurePin(() => {
      const margin = Math.abs(sA - sB);
      const isFinal = activeMatch.round === -1;
      const bonusMargin = isFinal ? currentTournament.config.finalBonusMargin : currentTournament.config.bonusMargin;
      if (margin >= bonusMargin) setShowConfetti(true);

      if (isFinal) {
        confirmFinalScore(sA, sB);
      } else if (isEditingMatch) {
        editMatchScore(activeMatch.id, sA, sB);
      } else {
        confirmMatchScore(activeMatch.id, sA, sB);
      }
      setActiveMatchId(null);
      setIsEditingMatch(false);
    });
  };

  const renderPhaseContent = () => {
    if (!isAuthenticated) {
      return (
        <div className="min-h-full flex flex-col px-4 pt-4 pb-6 bg-[#14161B] text-[#F3F4EE]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#1E2128] border border-white/10 flex items-center justify-center text-xl select-none">
                🏸
              </div>
              <div>
                <h1 className="text-[#F3F4EE] font-black text-base uppercase tracking-tight leading-tight">Badminton Club</h1>
                <p className="text-[#8E95A5] text-[10px] font-bold uppercase tracking-wider">Admin Dashboard</p>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 mt-16">
            <div className="w-20 h-20 bg-[#1E2128] rounded-[28px] border border-white/10 flex items-center justify-center text-4xl mb-6 shadow-sm">
              🔒
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#F3F4EE] mb-2">Admin Access Required</h2>
            <p className="text-xs text-[#8E95A5] max-w-[260px] mb-8 font-medium leading-relaxed">
              Enter the Scorekeeper PIN to manage tournaments and fixtures. You can still view live matches and standings as spectator.
            </p>
            <button
              onClick={() => setShowPinModal(true)}
              className="bg-[#FF5E48] hover:bg-[#fa6249] text-white px-8 py-3.5 rounded-full font-black text-xs uppercase tracking-wider shadow-[0_10px_25px_rgba(255,94,72,0.35)] active:scale-95 transition-all"
            >
              Enter PIN to Unlock ↗
            </button>
          </div>
        </div>
      );
    }

    // ——— Player Select Screen ———
    if (phase === "player-select") {
      const canStart = selectedPlayerIds.length >= 3;
      const hasPreviousTournament = dayTable.tournaments.length > 0;
      const progressPercent = Math.min(100, Math.round((selectedPlayerIds.length / 3) * 100));

      const selectedPlayersList = selectedPlayerIds
        .map((id) => players.find((p) => p.id === id))
        .filter(Boolean) as Player[];

      return (
        <div className="min-h-full flex flex-col px-4 pt-4 pb-6 bg-[#14161B] text-[#F3F4EE]">
          <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />

          {/* Top Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#1E2128] border border-white/10 flex items-center justify-center text-xl select-none">
                🏸
              </div>
              <div>
                <h1 className="text-[#F3F4EE] font-black text-base uppercase tracking-tight leading-tight">
                  Badminton Club
                </h1>
                <p className="text-[#8E95A5] text-[10px] font-bold uppercase tracking-wider">Round-Robin Manager</p>
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
                  className="px-3 py-2 rounded-full bg-[#1E2128] hover:bg-[#FF5E48]/20 text-[#8E95A5] hover:text-[#FF5E48] border border-white/10 hover:border-[#FF5E48]/30 transition-all active:scale-95 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                >
                  <span>👑</span>
                  <span>Logout</span>
                </button>
              )}
              <button
                onClick={() => setShowShareModal(true)}
                title="Share today's live stream"
                className="w-10 h-10 rounded-full bg-[#1E2128] border border-white/10 hover:border-white/20 active:scale-95 transition-all flex items-center justify-center text-[#F3F4EE] text-sm cursor-pointer"
              >
                <span>📡</span>
              </button>
              <button
                onClick={() => {
                  setPinIsInvalid(false);
                  setShowPinModal(true);
                }}
                title="Scorekeeper PIN"
                className="w-10 h-10 rounded-full bg-[#1E2128] border border-white/10 hover:border-white/20 active:scale-95 transition-all flex items-center justify-center text-[#F3F4EE] relative cursor-pointer"
              >
                <span className="text-sm">🔑</span>
                {apiSync.hasPin() && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#9EC9A8] ring-2 ring-[#14161B]" />
                )}
              </button>
            </div>
          </div>

          {/* Featured Hero Slab */}
          <div className="mb-4 bg-[#1E2128] border border-white/10 text-[#F3F4EE] rounded-[30px] p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-start justify-between mb-3 relative z-10">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg">
                🏆
              </div>

              {/* Circular Progress Ring Tracker */}
              <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-white/10"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-[#FF5E48] transition-all duration-300"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeDasharray={`${progressPercent}, 100`}
                    strokeLinecap="round"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute font-black text-[11px] text-[#F3F4EE] tabular-nums">
                  {selectedPlayerIds.length}/3
                </span>
              </div>
            </div>

            <div className="relative z-10 mb-4">
              <h2 className="text-xl font-black uppercase tracking-tight text-[#F3F4EE]">
                Tournament Lineup
              </h2>
              <p className="text-[#8E95A5] text-xs font-semibold mt-0.5">
                {hasPreviousTournament
                  ? `🌟 ${dayTable.tournaments.length} tournament${dayTable.tournaments.length !== 1 ? "s" : ""} played today`
                  : "Pick at least 3 players to generate round-robin court fixtures"}
              </p>
            </div>

            {/* Bottom row of Hero Card */}
            <div className="flex items-center justify-between gap-2 relative z-10">
              <button
                onClick={canStart ? goToSetup : undefined}
                disabled={!canStart}
                className={`py-2 px-4 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  canStart
                    ? "bg-[#FF5E48] hover:bg-[#fa6249] text-white shadow-sm active:scale-95"
                    : "bg-white/10 text-[#8E95A5] cursor-not-allowed"
                }`}
              >
                <span>{canStart ? "Start Setup" : `Need ${Math.max(0, 3 - selectedPlayerIds.length)} more`}</span>
                <span>↗</span>
              </button>

              {/* Selected Players Avatar Stack */}
              {selectedPlayersList.length > 0 && (
                <div className="flex items-center -space-x-2 overflow-hidden py-1">
                  {selectedPlayersList.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="w-7 h-7 rounded-full bg-[#14161B] ring-2 ring-[#1E2128] overflow-hidden flex items-center justify-center shadow-xs"
                    >
                      <AvatarSVG type={p.avatar} size={26} emoji={p.avatarEmoji} color={p.avatarColor} />
                    </div>
                  ))}
                  {selectedPlayersList.length > 4 && (
                    <div className="w-7 h-7 rounded-full bg-[#FF5E48] text-white text-[9px] font-black ring-2 ring-[#1E2128] flex items-center justify-center">
                      +{selectedPlayersList.length - 4}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section Header & Count Chips */}
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-[#8E95A5] font-black text-[10px] uppercase tracking-wider">
              Select Squad <span className="text-[#F3F4EE]">({selectedPlayerIds.length} selected)</span>
            </p>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#8E95A5] bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
              Min 3 required
            </span>
          </div>

          {/* Player Grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {players.map((player) => {
              const selected = selectedPlayerIds.includes(player.id);
              const selectedIndex = selectedPlayerIds.indexOf(player.id);

              return (
                <motion.button
                  key={player.id}
                  layoutId={`player-card-${player.id}`}
                  onClick={() => togglePlayerSelection(player.id)}
                  whileTap={{ scale: 0.95 }}
                  animate={{
                    scale: selected ? 1.02 : 1,
                  }}
                  transition={{ type: "spring", damping: 20, stiffness: 320 }}
                  className={`relative flex flex-col items-center justify-between p-4 rounded-[26px] border transition-all cursor-pointer text-left ${
                    selected
                      ? "border-[#F5BA38] ring-2 ring-[#F5BA38]/40 bg-[#252932] shadow-md"
                      : "bg-[#1E2128] border-white/10 hover:border-white/20 shadow-sm"
                  }`}
                >
                  {/* Top-Right Badge: Numbered gold pill when selected, empty ring when unselected */}
                  <div className="w-full flex justify-end">
                    {selected ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 rounded-full bg-[#F5BA38] flex items-center justify-center shadow-xs"
                      >
                        <span className="text-[#14161B] text-xs font-black">
                          {selectedIndex + 1}
                        </span>
                      </motion.div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-white/20 bg-white/5" />
                    )}
                  </div>

                  {/* Avatar centered */}
                  <div className="my-1.5 flex items-center justify-center">
                    <AvatarSVG
                      type={player.avatar}
                      size={60}
                      emoji={player.avatarEmoji}
                      color={player.avatarColor}
                    />
                  </div>

                  {/* Player Name */}
                  <div className="w-full text-center">
                    <p className="text-sm font-black text-[#F3F4EE] uppercase tracking-tight truncate">
                      {player.name}
                    </p>
                    <span className="text-[10px] font-bold text-[#8E95A5] uppercase tracking-wider">
                      {player.avatar === "custom" ? "Custom Player" : player.avatar}
                    </span>
                  </div>
                </motion.button>
              );
            })}

            {/* Add Player Bento Card */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAvatarPicker(true)}
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-[26px] border-2 border-dashed border-white/15 bg-[#181B22]/50 hover:bg-[#1E2128] text-[#8E95A5] hover:text-[#F3F4EE] transition-all cursor-pointer shadow-sm min-h-[148px]"
            >
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-[#F3F4EE] text-xl font-black">
                +
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-[#8E95A5]">Add Player</span>
            </motion.button>
          </div>

          {/* Start Tournament CTA */}
          <div className="sticky bottom-0 inset-x-0 pt-3 pb-4 bg-gradient-to-t from-[#14161B] via-[#14161B]/95 to-transparent z-10 mt-2">
            <motion.button
              onClick={goToSetup}
              disabled={!canStart}
              whileTap={canStart ? { scale: 0.98 } : undefined}
              className={`w-full py-4 rounded-full font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                canStart
                  ? "bg-[#FF5E48] hover:bg-[#fa6249] text-white shadow-[0_10px_25px_rgba(255,94,72,0.35)] cursor-pointer"
                  : "bg-[#1E2128] text-[#8E95A5] border border-white/5 cursor-not-allowed"
              }`}
            >
              {canStart ? (
                <>
                  <span>Setup Tournament ({selectedPlayerIds.length} Players)</span>
                  <span>↗</span>
                </>
              ) : (
                <span>Select at least 3 players ({selectedPlayerIds.length}/3)</span>
              )}
            </motion.button>
          </div>

          {/* Avatar picker modal */}
          <AvatarPicker
            open={showAvatarPicker}
            onClose={() => setShowAvatarPicker(false)}
            onConfirm={(emoji, color, name) => {
              addPlayer({
                id: `custom-${Date.now()}`,
                name,
                avatar: "custom",
                avatarEmoji: emoji,
                avatarColor: color,
              });
              setShowAvatarPicker(false);
            }}
          />
        </div>
      );
    }

  // ——— Setup Screen ———
  if (phase === "setup") {
    return (
      <TournamentSetup
        playerCount={selectedPlayerIds.length}
        matchCount={setupMatchCount}
        onConfirm={(cfg) => {
          setPendingConfig(cfg);
          if (cfg.isPractice) {
            startTournament();
          } else {
            ensurePin(() => {
              startTournament();
            });
          }
        }}
        onBack={() => useStore.getState().setPhase("player-select")}
      />
    );
  }

  // ——— Fixtures + Table Screen ———
  if (phase === "fixtures" && currentTournament) {
    const table = computeTournamentTable(currentTournament);
    const playedMatches = currentTournament.matches.filter((m) => m.played);
    const unplayedMatches = currentTournament.matches.filter((m) => !m.played);
    const upNextMatch = unplayedMatches[0] ?? null;

    return (
      <div className="min-h-full flex flex-col bg-[#14161B] text-[#F3F4EE]">
        <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />

        {/* Cancel / Shuffle confirm dialogs */}
        <AnimatePresence>
          {showCancelConfirm && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/75 z-50 backdrop-blur-sm" onClick={() => setShowCancelConfirm(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed inset-x-6 top-1/2 -translate-y-1/2 z-50 bg-[#1E2128] border border-white/15 rounded-[32px] p-6 text-center max-w-sm mx-auto shadow-2xl space-y-2 text-[#F3F4EE]">
                <div className="w-14 h-14 rounded-full bg-[#FF5E48]/15 border border-[#FF5E48]/30 text-3xl flex items-center justify-center mx-auto mb-2 shadow-xs">
                  🚫
                </div>
                <h3 className="text-[#F3F4EE] font-black text-xl uppercase tracking-tight">Cancel Tournament?</h3>
                <p className="text-[#8E95A5] text-xs leading-relaxed font-medium pb-2">
                  {playedMatches.length > 0
                    ? `${playedMatches.length} match${playedMatches.length !== 1 ? "es" : ""} will be lost. This cannot be undone.`
                    : "This will discard current fixtures and return to squad selection."}
                </p>
                <div className="flex gap-2.5 pt-2">
                  <button onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 py-3 rounded-full bg-[#181B22] border border-white/10 hover:border-white/20 text-[#F3F4EE] font-black text-xs uppercase tracking-wider transition-colors">Keep Playing</button>
                  <button onClick={() => { cancelTournament(); setShowCancelConfirm(false); }}
                    className="flex-1 py-3 rounded-full bg-[#FF5E48] hover:bg-[#fa6249] text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all">Cancel</button>
                </div>
              </motion.div>
            </>
          )}
          {showShuffleConfirm && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/75 z-50 backdrop-blur-sm" onClick={() => setShowShuffleConfirm(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed inset-x-6 top-1/2 -translate-y-1/2 z-50 bg-[#1E2128] border border-white/15 rounded-[32px] p-6 text-center max-w-sm mx-auto shadow-2xl space-y-2 text-[#F3F4EE]">
                <div className="w-14 h-14 rounded-full bg-[#6C79E0]/15 border border-[#6C79E0]/30 text-3xl flex items-center justify-center mx-auto mb-2 shadow-xs">
                  🔀
                </div>
                <h3 className="text-[#F3F4EE] font-black text-xl uppercase tracking-tight">Shuffle Fixtures?</h3>
                <p className="text-[#8E95A5] text-xs leading-relaxed font-medium pb-2">
                  {playedMatches.length > 0
                    ? `${playedMatches.length} match${playedMatches.length !== 1 ? "es" : ""} already played will be lost.`
                    : "Regenerate the match schedule in a new random order — same players, different order."}
                </p>
                <div className="flex gap-2.5 pt-2">
                  <button onClick={() => setShowShuffleConfirm(false)}
                    className="flex-1 py-3 rounded-full bg-[#181B22] border border-white/10 hover:border-white/20 text-[#F3F4EE] font-black text-xs uppercase tracking-wider transition-colors">Keep Current</button>
                  <button onClick={() => { shuffleFixtures(); setShowShuffleConfirm(false); }}
                    className="flex-1 py-3 rounded-full bg-[#FF5E48] hover:bg-[#fa6249] text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all">🔀 Shuffle</button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#14161B]/95 backdrop-blur-md border-b border-white/10 px-4 pt-3 pb-0 text-[#F3F4EE]">
          {/* Top Utility Row */}
          <div className="flex items-center justify-between mb-2.5">
            <div>
              {currentTournament.isPractice ? (
                <span className="text-[10px] bg-[#F5BA38] text-[#14161B] font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                  <span>🧪</span>
                  <span>Practice Mode</span>
                </span>
              ) : (
                <SyncStatusBadge />
              )}
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
              <button
                onClick={() => {
                  setPinIsInvalid(false);
                  setShowPinModal(true);
                }}
                title="Scorekeeper PIN"
                className="w-8 h-8 rounded-full bg-[#1E2128] border border-white/10 hover:border-white/20 text-[#F3F4EE] transition-all active:scale-95 flex items-center justify-center text-xs relative"
              >
                <span>🔑</span>
                {apiSync.hasPin() && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#9EC9A8] ring-2 ring-[#14161B]" />
                )}
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                title="Share live stream"
                className="w-8 h-8 rounded-full bg-[#1E2128] border border-white/10 hover:border-white/20 text-[#F3F4EE] transition-all active:scale-95 flex items-center justify-center text-xs"
              >
                <span>📡</span>
              </button>
              <button
                onClick={() => setShowShuffleConfirm(true)}
                title="Shuffle fixtures order"
                className="w-8 h-8 rounded-full bg-[#1E2128] border border-white/10 hover:border-white/20 text-[#F3F4EE] transition-all active:scale-95 flex items-center justify-center text-xs"
              >
                <span>🔀</span>
              </button>
            </div>
          </div>

          {/* Title & Match Progress Hero Row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-[#F3F4EE] font-black text-2xl uppercase tracking-tight leading-none">
                Tournament Arena
              </h1>
              <p className="text-[#8E95A5] text-[10px] font-bold uppercase tracking-wider mt-1">
                First to {currentTournament.config.winScore} pts · {currentTournament.playerIds.length} players
              </p>
            </div>

            {/* Circular progress badge */}
            <div className="flex items-center gap-2 bg-[#1E2128] border border-white/10 rounded-full py-1.5 px-3">
              <div className="w-7 h-7 rounded-full bg-[#FF5E48]/15 border border-[#FF5E48]/30 flex items-center justify-center">
                <span className="text-[10px] font-black text-[#FF5E48] tabular-nums">
                  {playedMatches.length}/{currentTournament.matches.length}
                </span>
              </div>
              <div className="text-left">
                <p className="text-[9px] uppercase font-black tracking-wider text-[#8E95A5] leading-none">Matches</p>
                <p className="text-[11px] font-black text-[#F3F4EE] leading-tight mt-0.5">
                  {playedMatches.length === currentTournament.matches.length
                    ? "100%"
                    : `${Math.round((playedMatches.length / currentTournament.matches.length) * 100)}%`}
                </p>
              </div>
            </div>
          </div>

          {/* Segmented control */}
          <div className="flex gap-1.5 bg-[#181B22] rounded-full p-1 border border-white/10 shadow-xs mb-2.5">
            {(["fixtures", "table"] as FixtureTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFixtureTab(tab)}
                className={`flex-1 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  fixtureTab === tab
                    ? "bg-[#F3F4EE] text-[#14161B] shadow-sm"
                    : "text-[#8E95A5] hover:text-[#F3F4EE]"
                }`}
              >
                <span>{tab === "fixtures" ? "📋" : "📊"}</span>
                <span>{tab === "fixtures" ? "Fixtures" : "Standings"}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  fixtureTab === tab ? "bg-[#14161B] text-[#F3F4EE]" : "bg-white/10 text-[#8E95A5]"
                }`}>
                  {tab === "fixtures" ? currentTournament.matches.length : table.length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pt-3">
          {playedMatches.length === currentTournament.matches.length && (
            <div className="mx-4 mb-3.5 p-4 bg-[#FF5E48] text-white rounded-[26px] flex items-center justify-between gap-3 shadow-lg">
              <div>
                <p className="font-black text-xs uppercase tracking-wider">
                  {currentTournament.final?.played ? "🏆 Tournament Finished" : "🏆 All Matches Complete"}
                </p>
                <p className="text-white/80 text-[11px] font-semibold mt-0.5">
                  {currentTournament.final?.played ? "Reviewing past fixtures" : "Ready for the Grand Final"}
                </p>
              </div>
              <button
                onClick={() => setPhase(currentTournament.final?.played ? "tournament-summary" : "final")}
                className="px-4 py-2 rounded-full bg-[#14161B] text-white font-black text-xs uppercase tracking-wider flex-shrink-0 active:scale-95 transition-all shadow-sm"
              >
                {currentTournament.final?.played ? "Summary ↗" : "To Final ↗"}
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {fixtureTab === "fixtures" ? (
              <motion.div
                key="fixtures"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="px-4"
              >
                {currentTournament.matches.map((match, idx) => {
                  const pA = getPlayer(match.playerA);
                  const pB = getPlayer(match.playerB);
                  const isUpNext = match.id === upNextMatch?.id;
                  return (
                    <MatchCard
                      key={match.id}
                      match={match}
                      playerA={pA}
                      playerB={pB}
                      isUpNext={isUpNext}
                      index={idx}
                      onTap={(m) => {
                        setActiveMatchId(m.id);
                        setIsEditingMatch(m.played);
                      }}
                    />
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                key="table"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <TournamentTable
                  rows={table}
                  players={players}
                  tournament={currentTournament}
                  onSelectMatch={(m) => {
                    setActiveMatchId(m.id);
                    setIsEditingMatch(m.played);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Subtle Cancel Tournament link at bottom */}
          <div className="pt-8 pb-14 flex justify-center">
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="text-[#8E95A5] hover:text-[#FF5E48] text-xs py-2 px-4 rounded-full border border-white/10 hover:border-[#FF5E48]/30 hover:bg-[#FF5E48]/10 font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
            >
              <span>✕</span>
              <span>Cancel Tournament</span>
            </button>
          </div>
        </div>

        {/* Score input sheet */}
        {activeMatch && activePlayerA && activePlayerB && (
          <ScoreInput
            match={activeMatch}
            playerA={activePlayerA}
            playerB={activePlayerB}
            isFinal={activeMatch.round === -1}
            isEditing={isEditingMatch}
            open={!!activeMatchId}
            onClose={() => { setActiveMatchId(null); setIsEditingMatch(false); }}
            onConfirm={handleScoreConfirm}
            onToggleCourtSide={isEditingMatch ? undefined : () => toggleCourtSide(activeMatch.id)}
            config={currentTournament.config}
          />
        )}
      </div>
    );
  }

  // ——— Final Screen ———
  if (phase === "final" && currentTournament) {
    const { finalistIds, final } = currentTournament;
    const table = computeTournamentTable(currentTournament);

    if (!finalistIds) return null;

    const [idA, idB] = finalistIds;
    const finalistA = getPlayer(idA);
    const finalistB = getPlayer(idB);

    // Coin flip screen
    if (needsCoinFlip && !coinFlipVisible) {
      return (
        <div className="min-h-full flex flex-col items-center justify-center px-6 text-center gap-6 bg-[#14161B] text-[#F3F4EE]">
          <div className="text-6xl">🪙</div>
          <h2 className="text-[#F3F4EE] font-black text-2xl uppercase tracking-tight">It&apos;s a Tie!</h2>
          <p className="text-[#8E95A5] text-xs font-semibold leading-relaxed">Tiebreak couldn&apos;t be resolved — tap to flip a coin and decide who serves first</p>
          <div className="flex flex-col items-center gap-3 w-full">
            {[finalistA, finalistB].map((p) => (
              <button
                key={p.id}
                onClick={() => { startFinal(p.id); setCoinFlipVisible(false); }}
                className="w-full py-4 rounded-full bg-[#1E2128] border border-white/10 hover:border-white/20 text-[#F3F4EE] font-black text-xs uppercase tracking-wider shadow-sm active:scale-98 transition-all"
              >
                {p.name} wins the flip ↗
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Final not yet started
    if (!final) {
      const cfg = currentTournament.config;
      return (
        <div className="min-h-full flex flex-col pb-10 bg-[#14161B] text-[#F3F4EE]">
          <div className="px-5 pt-6 pb-3">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setPhase("fixtures")}
                className="text-xs bg-[#1E2128] hover:bg-[#252932] text-[#F3F4EE] border border-white/10 px-3.5 py-1.5 rounded-full font-black uppercase tracking-wider transition-colors flex items-center gap-1.5"
              >
                <span>←</span>
                <span>Review Matches</span>
              </button>
              <span className="text-[10px] text-[#14161B] font-black uppercase tracking-wider bg-[#F5BA38] px-3 py-1 rounded-full shadow-xs">
                Pre-Final Standings
              </span>
            </div>
            <h2 className="text-[#F3F4EE] font-black text-2xl mb-0.5 uppercase tracking-tight">🏆 Grand Final</h2>
            <p className="text-[#8E95A5] text-xs font-semibold">Round-robin complete! First to {cfg.finalWinScore} wins the tournament.</p>
          </div>

          {/* Finalists head-to-head */}
          <div className="px-5 mb-5">
            <div className="bg-[#1E2128] border border-[#F5BA38]/40 rounded-[28px] p-6 shadow-sm">
              <p className="text-[#F5BA38] text-[10px] font-black uppercase tracking-wider text-center mb-4">Finalists</p>
              <div className="flex items-center justify-around">
                <div className="flex flex-col items-center gap-2">
                  <AvatarSVG type={finalistA.avatar} size={72} emoji={finalistA.avatarEmoji} color={finalistA.avatarColor} />
                  <p className="text-[#F3F4EE] font-black text-sm uppercase tracking-tight">{finalistA.name}</p>
                  <p className="text-[#F5BA38] text-xs font-black">
                    {table.find(r => r.playerId === idA)?.points ?? 0} pts
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-white/20 text-2xl font-black">VS</span>
                  <span className="text-[#8E95A5] text-[10px] font-black uppercase tracking-wider">First to {cfg.finalWinScore}</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <AvatarSVG type={finalistB.avatar} size={72} emoji={finalistB.avatarEmoji} color={finalistB.avatarColor} />
                  <p className="text-[#F3F4EE] font-black text-sm uppercase tracking-tight">{finalistB.name}</p>
                  <p className="text-[#F5BA38] text-xs font-black">
                    {table.find(r => r.playerId === idB)?.points ?? 0} pts
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pre-final table */}
          <p className="px-5 text-[#8E95A5] text-[10px] uppercase tracking-wider font-black mb-2">Standings before final</p>
          <TournamentTable
            rows={table}
            players={players}
            finalistIds={finalistIds}
            tournament={currentTournament}
            onSelectMatch={(m) => {
              setActiveMatchId(m.id);
              setIsEditingMatch(m.played);
            }}
          />

          {/* Start final button */}
          <div className="px-5 py-4 mt-auto">
            <button
              onClick={() => ensurePin(() => startFinal())}
              className="w-full py-4 rounded-full bg-[#FF5E48] hover:bg-[#fa6249] font-black uppercase tracking-widest text-white text-xs shadow-[0_10px_25px_rgba(255,94,72,0.35)] active:scale-98 transition-all"
            >
              🏆 Start Final Match ↗
            </button>
          </div>

          {/* Score input sheet for editing match from pre-final table */}
          {activeMatch && activePlayerA && activePlayerB && (
            <ScoreInput
              match={activeMatch}
              playerA={activePlayerA}
              playerB={activePlayerB}
              isFinal={activeMatch.round === -1}
              isEditing={isEditingMatch}
              open={!!activeMatchId}
              onClose={() => { setActiveMatchId(null); setIsEditingMatch(false); }}
              onConfirm={handleScoreConfirm}
              onToggleCourtSide={undefined}
              config={currentTournament.config}
            />
          )}
        </div>
      );
    }

    // Final match in progress
    const finalPlayerA = getPlayer(final.playerA);
    const finalPlayerB = getPlayer(final.playerB);

    return (
      <div className="min-h-full flex flex-col relative pb-20 bg-[#14161B] text-[#F3F4EE]">
        <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />

        <div className="px-5 pt-6 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[#F3F4EE] font-black text-2xl mb-0.5 uppercase tracking-tight">🏆 Grand Final</h2>
            <p className="text-[#8E95A5] text-xs font-semibold">First to {currentTournament.config.finalWinScore} points wins the tournament</p>
          </div>
          {!isFinalSheetOpen && (
            <button
              onClick={() => setIsFinalSheetOpen(true)}
              className="text-xs bg-[#FF5E48] hover:bg-[#fa6249] text-white px-3.5 py-1.5 rounded-full font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span>🏸 Enter Score</span>
            </button>
          )}
        </div>

        {/* Head-to-head display */}
        <div className="px-5 mb-4">
          <div className="bg-[#1E2128] border border-white/10 rounded-[28px] p-5 shadow-sm">
            <div className="flex items-center justify-around">
              <motion.div layoutId={`player-card-${finalPlayerA.id}`} className="flex flex-col items-center gap-1.5">
                <AvatarSVG type={finalPlayerA.avatar} size={70} emoji={finalPlayerA.avatarEmoji} color={finalPlayerA.avatarColor} />
                <p className="text-[#F3F4EE] font-black text-sm uppercase tracking-tight">{finalPlayerA.name}</p>
                <p className="text-[#F5BA38] text-xs font-black font-mono">
                  {finalPendingScores.scoreA > 0 ? `${finalPendingScores.scoreA} pts` : "Finalist"}
                </p>
              </motion.div>
              <div className="flex flex-col items-center">
                <span className="text-white/20 text-xl font-black">VS</span>
                <span className="text-[10px] text-[#8E95A5] font-bold uppercase tracking-wider mt-1">First to {currentTournament.config.finalWinScore}</span>
              </div>
              <motion.div layoutId={`player-card-${finalPlayerB.id}`} className="flex flex-col items-center gap-1.5">
                <AvatarSVG type={finalPlayerB.avatar} size={70} emoji={finalPlayerB.avatarEmoji} color={finalPlayerB.avatarColor} />
                <p className="text-[#F3F4EE] font-black text-sm uppercase tracking-tight">{finalPlayerB.name}</p>
                <p className="text-[#F5BA38] text-xs font-black font-mono">
                  {finalPendingScores.scoreB > 0 ? `${finalPendingScores.scoreB} pts` : "Finalist"}
                </p>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Standings Table viewable while sheet is minimized */}
        <div className="px-5 mb-2 flex items-center justify-between">
          <p className="text-[#8E95A5] text-[10px] uppercase tracking-wider font-black">Tournament Standings</p>
          <span className="text-[10px] text-[#8E95A5] font-bold uppercase tracking-wider">Tap match to edit</span>
        </div>
        <div className="flex-1 overflow-y-auto px-1">
          <TournamentTable
            rows={table}
            players={players}
            finalistIds={currentTournament.finalistIds}
            tournament={currentTournament}
            onSelectMatch={(m) => {
              setActiveMatchId(m.id);
              setIsEditingMatch(m.played);
            }}
          />
        </div>

        {/* Sticky floating bottom bar when sheet is hidden */}
        {!isFinalSheetOpen && (
          <div className="fixed bottom-20 inset-x-4 max-w-lg mx-auto z-30">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={() => setIsFinalSheetOpen(true)}
              className="p-4 bg-[#1E2128] rounded-full shadow-2xl border border-white/15 flex items-center justify-between gap-3 cursor-pointer text-[#F3F4EE]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl flex-shrink-0">🏆</span>
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-[#F5BA38] uppercase tracking-wider">Grand Final in Progress</p>
                  <p className="text-xs text-[#F3F4EE] font-bold truncate">
                    {finalPlayerA.name} <span className="font-mono text-[#F5BA38] font-black">{finalPendingScores.scoreA}</span> – <span className="font-mono text-[#F5BA38] font-black">{finalPendingScores.scoreB}</span> {finalPlayerB.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFinalSheetOpen(true);
                }}
                className="px-4 py-2 rounded-full bg-[#FF5E48] hover:bg-[#fa6249] text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all flex-shrink-0"
              >
                Resume 🏸
              </button>
            </motion.div>
          </div>
        )}

        {/* Score entry sheet */}
        <ScoreInput
          match={final}
          playerA={finalPlayerA}
          playerB={finalPlayerB}
          isFinal={true}
          open={isFinalSheetOpen}
          onClose={() => setIsFinalSheetOpen(false)}
          onMinimize={() => setIsFinalSheetOpen(false)}
          currentScores={finalPendingScores}
          onScoresChange={(sA, sB) => setFinalPendingScores({ scoreA: sA, scoreB: sB })}
          onConfirm={(sA, sB) => {
            const margin = Math.abs(sA - sB);
            if (margin >= currentTournament.config.finalBonusMargin) setShowConfetti(true);
            confirmFinalScore(sA, sB);
          }}
          onToggleCourtSide={undefined}
          config={currentTournament.config}
        />
      </div>
    );
  }

  // ——— Tournament Summary ———
  if (phase === "tournament-summary" && currentTournament) {
    const table = computeTournamentTable(currentTournament);
    const winner = table[0];
    const winnerPlayer = winner ? getPlayer(winner.playerId) : null;
    const final = currentTournament.final;

    return (
      <div className="min-h-full flex flex-col pb-10 bg-[#14161B] text-[#F3F4EE]">
        <ConfettiBurst active={true} onComplete={() => {}} />

        {/* Winner celebration */}
        <div className="px-5 pt-8 pb-6 text-center">
          {currentTournament.isPractice ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5BA38] text-[#14161B] text-xs font-black uppercase tracking-wider mb-3 shadow-xs">
              <span>🧪</span>
              <span>Practice Match Complete (Unranked)</span>
            </div>
          ) : (
            <p className="text-[#F5BA38] text-[10px] uppercase tracking-widest font-black mb-2">Tournament Winner</p>
          )}
          {winnerPlayer && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 12 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="relative">
                <AvatarSVG type={winnerPlayer.avatar} size={100} emoji={winnerPlayer.avatarEmoji} color={winnerPlayer.avatarColor} />
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-4xl">🏆</div>
              </div>
              <h2 className="text-[#F3F4EE] font-black text-3xl uppercase tracking-tight">{winnerPlayer.name}!</h2>
              <p className="text-[#F5BA38] font-black text-lg">
                {winner.dayPoints ? `${winner.dayPoints} overall pts` : `${winner.points} pts`}
              </p>
            </motion.div>
          )}

          {/* Final score display — tap to edit */}
          {final?.played && final.scoreA !== undefined && final.scoreB !== undefined && (
            <button
              onClick={() => {
                setActiveMatchId(final.id);
                setIsEditingMatch(true);
              }}
              className="mt-4 bg-[#1E2128] hover:bg-[#252932] border border-white/10 rounded-full px-5 py-2.5 inline-flex items-center gap-3 cursor-pointer transition-all active:scale-[0.99] shadow-xs"
            >
              <span className="text-[#F3F4EE] font-black text-xs uppercase">{getPlayer(final.playerA).name}</span>
              <span className="text-[#FF5E48] font-black text-base tabular-nums">
                {final.scoreA} – {final.scoreB}
              </span>
              <span className="text-[#F3F4EE] font-black text-xs uppercase">{getPlayer(final.playerB).name}</span>
              <span className="text-[10px] font-black bg-white/10 text-[#F3F4EE] px-2 py-0.5 rounded-full flex items-center gap-1 ml-1">
                Edit ↗
              </span>
            </button>
          )}
        </div>

        {/* Final standings */}
        <div className="px-5 flex items-center justify-between mb-2">
          <p className="text-[#8E95A5] text-[10px] uppercase font-black tracking-wider">Final Standings</p>
          <button
            onClick={() => setPhase("fixtures")}
            className="text-xs bg-[#1E2128] hover:bg-[#252932] text-[#F3F4EE] border border-white/10 px-3 py-1 rounded-full transition-colors flex items-center gap-1 font-black uppercase tracking-wider shadow-xs"
          >
            <span>📋</span>
            <span>View Fixtures</span>
          </button>
        </div>
        <TournamentTable
          rows={table}
          players={players}
          showFinalLabel={true}
          tournament={currentTournament}
          onSelectMatch={(m) => {
            setActiveMatchId(m.id);
            setIsEditingMatch(m.played);
          }}
        />

        {/* Actions */}
        <div className="px-5 py-6 flex flex-col gap-3">
          <button
            onClick={() => {
              if (currentTournament.isPractice) {
                closeTournament();
              } else {
                ensurePin(() => closeTournament());
              }
            }}
            className="w-full py-4 rounded-full font-black text-white text-xs uppercase tracking-widest shadow-[0_10px_25px_rgba(255,94,72,0.35)] active:scale-98 transition-all bg-[#FF5E48] hover:bg-[#fa6249]"
          >
            {currentTournament.isPractice
              ? "Finish Practice & Exit 🧪"
              : "Save & Start Next Tournament 🏸"}
          </button>
        </div>

        {/* Score input sheet for editing match from final standings table */}
        {activeMatch && activePlayerA && activePlayerB && (
          <ScoreInput
            match={activeMatch}
            playerA={activePlayerA}
            playerB={activePlayerB}
            isFinal={activeMatch.round === -1}
            isEditing={isEditingMatch}
            open={!!activeMatchId}
            onClose={() => { setActiveMatchId(null); setIsEditingMatch(false); }}
            onConfirm={handleScoreConfirm}
            onToggleCourtSide={undefined}
            config={currentTournament.config}
          />
        )}
      </div>
    );
  }

    return null;
  };

  return (
    <>
      {renderPhaseContent()}
      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        slug={currentTournament?.shareSlug ?? currentTournament?.id}
        date={dayTable.date || getLocalDateString()}
      />
      <PinModal
        open={showPinModal}
        isInvalid={pinIsInvalid}
        onClose={() => {
          setShowPinModal(false);
          setPendingAction(null);
          if (apiSync.hasPin()) setIsAuthenticated(true);
        }}
        onSuccess={() => {
          setIsAuthenticated(true);
          if (pendingAction) {
            const act = pendingAction;
            setPendingAction(null);
            act();
          }
        }}
      />
    </>
  );
}
