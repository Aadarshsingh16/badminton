"use client";
// app/page.tsx — Play tab: context-aware screen (player-select → setup → fixtures/table → final → summary)

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, FIXED_PLAYERS } from "@/lib/store";
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
  const [pinIsInvalid, setPinIsInvalid] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Listen for unauthorized 401s from backend sync
  React.useEffect(() => {
    return apiSync.onUnauthorized(() => {
      setPinIsInvalid(true);
      setShowPinModal(true);
    });
  }, []);

  const ensurePin = (action: () => void) => {
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
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const ping = () => {
      fetch(`${backendUrl}/health`).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
    // ——— Player Select Screen ———
    if (phase === "player-select") {
    const canStart = selectedPlayerIds.length >= 3;
    const hasPreviousTournament = dayTable.tournaments.length > 0;

    return (
      <div className="min-h-full flex flex-col">
        <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />

        {/* Header */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏸</span>
              <div>
                <h1 className="text-white font-black text-2xl leading-tight">Badminton</h1>
                <p className="text-white/40 text-xs">Round-robin tournament manager</p>
              </div>
            </div>
            <button
              onClick={() => {
                setPinIsInvalid(false);
                setShowPinModal(true);
              }}
              title="Scorekeeper PIN"
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all text-xs flex items-center gap-1.5"
            >
              <span>🔑</span>
              <span className="text-[10px] font-semibold text-gray-300">PIN</span>
            </button>
          </div>
          {hasPreviousTournament && (
            <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2">
              <p className="text-blue-300 text-xs">
                🌟 {dayTable.tournaments.length} tournament{dayTable.tournaments.length !== 1 ? "s" : ""} played today
              </p>
            </div>
          )}
        </div>

        {/* Player grid */}
        <div className="flex-1 px-4 pb-4">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-3">Select Players (min 3)</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {players.map((player, idx) => {
              const selected = selectedPlayerIds.includes(player.id);
              return (
                <motion.button
                  key={player.id}
                  layoutId={`player-card-${player.id}`}
                  onClick={() => togglePlayerSelection(player.id)}
                  whileTap={{ scale: 0.95 }}
                  animate={{
                    scale: selected ? 1.03 : 1,
                    boxShadow: selected ? "0 8px 32px rgba(139, 92, 246, 0.3)" : "0 0 0 rgba(0,0,0,0)",
                  }}
                  transition={{ type: "spring", damping: 18, stiffness: 300 }}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-colors ${
                    selected
                      ? "border-purple-500 bg-purple-500/15"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  {selected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center"
                    >
                      <span className="text-white text-xs font-bold">
                        {selectedPlayerIds.indexOf(player.id) + 1}
                      </span>
                    </motion.div>
                  )}
                  <AvatarSVG
                    type={player.avatar}
                    size={64}
                    emoji={player.avatarEmoji}
                    color={player.avatarColor}
                  />
                  <p className={`text-sm font-bold text-center ${selected ? "text-white" : "text-white/70"}`}>
                    {player.name}
                  </p>
                </motion.button>
              );
            })}

            {/* Add player tile */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAvatarPicker(true)}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-white/20 bg-white/3 text-white/40 hover:border-white/40 hover:text-white/60 transition-colors"
            >
              <span className="text-3xl">+</span>
              <span className="text-xs">Add Player</span>
            </motion.button>
          </div>
        </div>

        {/* Start Tournament CTA */}
        <div className="px-4 pb-6">
          <motion.button
            onClick={goToSetup}
            disabled={!canStart}
            whileTap={canStart ? { scale: 0.97 } : undefined}
            animate={{ opacity: canStart ? 1 : 0.4 }}
            className={`w-full py-4 rounded-2xl font-black text-white text-lg transition-all ${
              canStart
                ? "bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg shadow-purple-500/30"
                : "bg-white/10 cursor-not-allowed"
            }`}
          >
            {canStart
              ? `Setup Tournament (${selectedPlayerIds.length} players) →`
              : `Select at least 3 players`}
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
          ensurePin(() => {
            startTournament();
          });
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
      <div className="min-h-full flex flex-col">
        <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />

        {/* Cancel / Shuffle confirm dialogs */}
        <AnimatePresence>
          {showCancelConfirm && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 z-50" onClick={() => setShowCancelConfirm(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed inset-x-6 top-1/2 -translate-y-1/2 z-50 bg-slate-900 border border-red-500/30 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-3">🚫</div>
                <h3 className="text-white font-black text-xl mb-2">Cancel Tournament?</h3>
                <p className="text-white/50 text-sm mb-6">
                  {playedMatches.length > 0
                    ? `${playedMatches.length} match${playedMatches.length !== 1 ? "es" : ""} will be lost. This cannot be undone.`
                    : "This will discard the current fixtures and return to player select."}
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 py-3 rounded-xl bg-white/10 text-white/70 font-semibold">Keep Playing</button>
                  <button onClick={() => { cancelTournament(); setShowCancelConfirm(false); }}
                    className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold">Cancel</button>
                </div>
              </motion.div>
            </>
          )}
          {showShuffleConfirm && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 z-50" onClick={() => setShowShuffleConfirm(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed inset-x-6 top-1/2 -translate-y-1/2 z-50 bg-slate-900 border border-orange-500/30 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-3">🔀</div>
                <h3 className="text-white font-black text-xl mb-2">Shuffle Fixtures?</h3>
                <p className="text-white/50 text-sm mb-6">
                  {playedMatches.length > 0
                    ? `${playedMatches.length} match${playedMatches.length !== 1 ? "es" : ""} already played will be lost.`
                    : "Regenerate the match schedule in a new random order — same players, different fixtures."}
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowShuffleConfirm(false)}
                    className="flex-1 py-3 rounded-xl bg-white/10 text-white/70 font-semibold">Keep Current</button>
                  <button onClick={() => { shuffleFixtures(); setShowShuffleConfirm(false); }}
                    className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold">🔀 Shuffle</button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-white/5 px-4 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white font-black text-lg">Tournament</h2>
                <SyncStatusBadge />
              </div>
              <p className="text-white/40 text-xs">
                {playedMatches.length}/{currentTournament.matches.length} matches played · First to {currentTournament.config.winScore}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setPinIsInvalid(false);
                  setShowPinModal(true);
                }}
                title="Scorekeeper PIN"
                className="text-xs bg-white/10 text-gray-300 border border-white/15 px-2.5 py-1.5 rounded-full hover:bg-white/20 transition-colors font-medium flex items-center gap-1"
              >
                <span>🔑</span>
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                className="text-xs bg-purple-500/15 text-purple-300 border border-purple-500/25 px-3 py-1.5 rounded-full hover:bg-purple-500/25 transition-colors font-medium flex items-center gap-1 shadow-sm"
              >
                <span>📡</span>
                <span>Share</span>
              </button>
              <button
                onClick={() => setShowShuffleConfirm(true)}
                className="text-xs bg-orange-500/15 text-orange-400 border border-orange-500/20 px-3 py-1.5 rounded-full hover:bg-orange-500/25 transition-colors font-medium flex items-center gap-1"
              >
                <span>🔀</span>
                <span>Shuffle</span>
              </button>
            </div>
          </div>

          {/* Segmented control */}
          <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-0">
            {(["fixtures", "table"] as FixtureTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFixtureTab(tab)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                  fixtureTab === tab
                    ? "bg-white/15 text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {tab === "fixtures" ? "📋 Fixtures" : "📊 Table"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pt-4">
          {playedMatches.length === currentTournament.matches.length && (
            <div className="mx-4 mb-3 p-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-2xl flex items-center justify-between gap-3 shadow-lg shadow-yellow-500/10">
              <div>
                <p className="text-yellow-300 font-bold text-xs uppercase tracking-wide">
                  {currentTournament.final?.played ? "🏆 Tournament Finished" : "🏆 All Matches Complete"}
                </p>
                <p className="text-white/60 text-xs">
                  {currentTournament.final?.played ? "Reviewing past fixtures" : "Ready for the Grand Final"}
                </p>
              </div>
              <button
                onClick={() => setPhase(currentTournament.final?.played ? "tournament-summary" : "final")}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold text-xs shadow-md shadow-yellow-500/20 flex-shrink-0 hover:brightness-110 active:scale-95 transition-all"
              >
                {currentTournament.final?.played ? "Back to Summary →" : "Proceed to Final →"}
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

          {/* Subtle Cancel Tournament link at bottom to prevent miss-clicks */}
          <div className="pt-8 pb-14 flex justify-center">
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="text-white/20 hover:text-red-400 text-xs py-2 px-4 rounded-full border border-white/5 hover:border-red-500/20 hover:bg-red-500/5 transition-all flex items-center gap-1.5"
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
        {/* Share modal */}
        <ShareModal
          open={showShareModal}
          onClose={() => setShowShareModal(false)}
          slug={currentTournament.shareSlug ?? currentTournament.id}
        />
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
        <div className="min-h-full flex flex-col items-center justify-center px-6 text-center gap-6">
          <div className="text-6xl">🪙</div>
          <h2 className="text-white font-black text-2xl">It&apos;s a Tie!</h2>
          <p className="text-white/50 text-sm">Tiebreak couldn&apos;t be resolved — tap to flip a coin and decide who goes first</p>
          <div className="flex flex-col items-center gap-3 w-full">
            {[finalistA, finalistB].map((p) => (
              <button
                key={p.id}
                onClick={() => { startFinal(p.id); setCoinFlipVisible(false); }}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-lg"
              >
                {p.name} wins the flip
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
        <div className="min-h-full flex flex-col">
          <div className="px-4 pt-6 pb-3">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setPhase("fixtures")}
                className="text-xs bg-white/10 hover:bg-white/15 text-white/70 border border-white/10 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
              >
                <span>←</span>
                <span>Review / Edit Matches</span>
              </button>
              <span className="text-[11px] text-yellow-400 font-medium bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-full">
                Pre-Final Standings
              </span>
            </div>
            <h2 className="text-white font-black text-2xl mb-0.5">🏆 Grand Final</h2>
            <p className="text-white/40 text-xs">Round-robin complete! First to {cfg.finalWinScore} wins the tournament.</p>
          </div>

          {/* Finalists head-to-head */}
          <div className="px-4 mb-6">
            <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/20 border border-yellow-500/30 rounded-2xl p-6">
              <p className="text-yellow-400 text-xs text-center uppercase tracking-widest mb-4">Finalists</p>
              <div className="flex items-center justify-around">
                <div className="flex flex-col items-center gap-2">
                  <AvatarSVG type={finalistA.avatar} size={72} emoji={finalistA.avatarEmoji} color={finalistA.avatarColor} />
                  <p className="text-white font-bold text-sm">{finalistA.name}</p>
                  <p className="text-yellow-400 text-xs font-bold">
                    {table.find(r => r.playerId === idA)?.points ?? 0} pts
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-white/30 text-2xl font-black">VS</span>
                  <span className="text-yellow-400 text-xs">First to {cfg.finalWinScore}</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <AvatarSVG type={finalistB.avatar} size={72} emoji={finalistB.avatarEmoji} color={finalistB.avatarColor} />
                  <p className="text-white font-bold text-sm">{finalistB.name}</p>
                  <p className="text-yellow-400 text-xs font-bold">
                    {table.find(r => r.playerId === idB)?.points ?? 0} pts
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pre-final table */}
          <p className="px-4 text-white/40 text-xs uppercase tracking-widest mb-2">Standings before final</p>
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
          <div className="px-4 py-4 mt-auto">
            <button
              onClick={() => ensurePin(() => startFinal())}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 font-black text-white text-lg shadow-lg shadow-yellow-500/30"
            >
              🏆 Start Final Match
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
      <div className="min-h-full flex flex-col">
        <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />

        <div className="px-4 pt-6 pb-4">
          <h2 className="text-white font-black text-2xl mb-1">🏆 Grand Final</h2>
          <p className="text-white/40 text-sm">First to {currentTournament.config.finalWinScore} points wins the tournament</p>
        </div>

        {/* Head-to-head display */}
        <div className="px-4 mb-6">
          <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/20 border border-yellow-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-around">
              <motion.div layoutId={`player-card-${finalPlayerA.id}`} className="flex flex-col items-center gap-2">
                <AvatarSVG type={finalPlayerA.avatar} size={80} emoji={finalPlayerA.avatarEmoji} color={finalPlayerA.avatarColor} />
                <p className="text-white font-bold text-sm">{finalPlayerA.name}</p>
              </motion.div>
              <div className="flex flex-col items-center">
                <span className="text-white/30 text-2xl font-black">VS</span>
              </div>
              <motion.div layoutId={`player-card-${finalPlayerB.id}`} className="flex flex-col items-center gap-2">
                <AvatarSVG type={finalPlayerB.avatar} size={80} emoji={finalPlayerB.avatarEmoji} color={finalPlayerB.avatarColor} />
                <p className="text-white font-bold text-sm">{finalPlayerB.name}</p>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Score entry */}
        <ScoreInput
          match={final}
          playerA={finalPlayerA}
          playerB={finalPlayerB}
          isFinal={true}
          open={true}
          onClose={() => {}} // can't close final sheet
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
      <div className="min-h-full flex flex-col">
        <ConfettiBurst active={true} onComplete={() => {}} />

        {/* Winner celebration */}
        <div className="px-4 pt-8 pb-6 text-center">
          <p className="text-yellow-400 text-xs uppercase tracking-widest mb-2">Tournament Winner</p>
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
              <h2 className="text-white font-black text-3xl">{winnerPlayer.name}!</h2>
              <p className="text-yellow-400 font-bold text-lg">{winner.points} pts</p>
            </motion.div>
          )}

          {/* Final score display — tap to edit */}
          {final?.played && final.scoreA !== undefined && final.scoreB !== undefined && (
            <button
              onClick={() => {
                setActiveMatchId(final.id);
                setIsEditingMatch(true);
              }}
              className="mt-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-yellow-500/40 rounded-xl px-5 py-2.5 inline-flex items-center gap-3 cursor-pointer transition-all active:scale-[0.99]"
            >
              <span className="text-white font-bold">{getPlayer(final.playerA).name}</span>
              <span className="text-yellow-400 font-bold text-base">
                {final.scoreA} – {final.scoreB}
              </span>
              <span className="text-white font-bold">{getPlayer(final.playerB).name}</span>
              <span className="text-[10px] font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 ml-1">
                ✏️ Edit Final Score
              </span>
            </button>
          )}
        </div>

        {/* Final standings */}
        <div className="px-4 flex items-center justify-between mb-2">
          <p className="text-white/40 text-xs uppercase tracking-widest">Final Standings</p>
          <button
            onClick={() => setPhase("fixtures")}
            className="text-xs bg-white/10 hover:bg-white/15 text-white/70 border border-white/10 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
          >
            <span>📋</span>
            <span>View All Fixture Cards</span>
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
        <div className="px-4 py-6 flex flex-col gap-3">
          <button
            onClick={() => ensurePin(() => closeTournament())}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 font-black text-white text-lg shadow-lg shadow-purple-500/30"
          >
            Save &amp; Start Next Tournament 🏸
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
      <PinModal
        open={showPinModal}
        isInvalid={pinIsInvalid}
        onClose={() => {
          setShowPinModal(false);
          setPendingAction(null);
        }}
        onSuccess={() => {
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
