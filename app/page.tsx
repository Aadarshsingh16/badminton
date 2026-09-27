"use client";
// app/page.tsx — Play tab: context-aware screen (player-select → fixtures/table → final → summary)

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, FIXED_PLAYERS } from "@/lib/store";
import { computeTournamentTable, isRoundRobinComplete } from "@/lib/ranking";
import { AvatarSVG } from "@/components/avatars/AvatarSVG";
import { AvatarPicker } from "@/components/AvatarPicker";
import { MatchCard } from "@/components/MatchCard";
import { ScoreInput } from "@/components/ScoreInput";
import { TournamentTable } from "@/components/TournamentTable";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { Player, Match, AvatarType } from "@/lib/types";

type FixtureTab = "fixtures" | "table";

export default function PlayPage() {
  const {
    players,
    selectedPlayerIds,
    currentTournament,
    phase,
    needsCoinFlip,
    dayTable,
    togglePlayerSelection,
    addPlayer,
    startTournament,
    confirmMatchScore,
    undoLastMatch,
    toggleCourtSide,
    startFinal,
    confirmFinalScore,
    closeTournament,
    startNextTournament,
  } = useStore();

  const [fixtureTab, setFixtureTab] = useState<FixtureTab>("fixtures");
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [coinFlipVisible, setCoinFlipVisible] = useState(false);

  const getPlayer = (id: string): Player =>
    players.find((p) => p.id === id) ?? { id, name: id, avatar: "custom" as AvatarType };

  // ——— Player Select Screen ———
  if (phase === "player-select") {
    const canStart = selectedPlayerIds.length >= 3;
    const hasPreviousTournament = dayTable.tournaments.length > 0;

    return (
      <div className="min-h-full flex flex-col">
        <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />

        {/* Header */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🏸</span>
            <div>
              <h1 className="text-white font-black text-2xl leading-tight">Badminton</h1>
              <p className="text-white/40 text-xs">Round-robin tournament manager</p>
            </div>
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
            onClick={startTournament}
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
              ? `Start Tournament (${selectedPlayerIds.length} players) 🏸`
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

  // ——— Fixtures + Table Screen ———
  if (phase === "fixtures" && currentTournament) {
    const table = computeTournamentTable(currentTournament);
    const playedMatches = currentTournament.matches.filter((m) => m.played);
    const unplayedMatches = currentTournament.matches.filter((m) => !m.played);
    const upNextMatch = unplayedMatches[0] ?? null;
    const activeMatch = currentTournament.matches.find((m) => m.id === activeMatchId) ?? null;
    const activePlayerA = activeMatch ? getPlayer(activeMatch.playerA) : null;
    const activePlayerB = activeMatch ? getPlayer(activeMatch.playerB) : null;
    const lastPlayedMatch = playedMatches[playedMatches.length - 1];

    // Group matches by round for bye display
    const byeRounds = currentTournament.byes;

    return (
      <div className="min-h-full flex flex-col">
        <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />

        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-white/5 px-4 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-white font-black text-lg">Tournament</h2>
              <p className="text-white/40 text-xs">
                {playedMatches.length}/{currentTournament.matches.length} matches played
              </p>
            </div>
            <div className="flex items-center gap-2">
              {playedMatches.length > 0 && (
                <button
                  onClick={undoLastMatch}
                  className="text-xs bg-white/10 text-white/50 px-3 py-1.5 rounded-full hover:bg-white/15 transition-colors"
                >
                  ↩ Undo
                </button>
              )}
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
                {/* Round-by-round with bye display */}
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
                      onTap={(m) => setActiveMatchId(m.id)}
                    />
                  );
                })}

                {/* Bye display */}
                {Object.entries(byeRounds).map(([round, byeId]) =>
                  byeId ? (
                    <div key={round} className="mb-3 px-3 py-2 bg-white/3 border border-white/5 rounded-xl text-center">
                      <p className="text-white/30 text-xs">
                        Round {Number(round) + 1}: <span className="text-white/50">{getPlayer(byeId).name}</span> has a bye
                      </p>
                    </div>
                  ) : null
                )}
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
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Score input sheet */}
        {activeMatch && activePlayerA && activePlayerB && (
          <ScoreInput
            match={activeMatch}
            playerA={activePlayerA}
            playerB={activePlayerB}
            isFinal={false}
            open={!!activeMatchId}
            onClose={() => setActiveMatchId(null)}
            onConfirm={(sA, sB) => {
              // Check if this will be a blowout
              const margin = Math.abs(sA - sB);
              if (margin >= 4) setShowConfetti(true);
              confirmMatchScore(activeMatch.id, sA, sB);
              setActiveMatchId(null);
            }}
            onToggleCourtSide={() => toggleCourtSide(activeMatch.id)}
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
      return (
        <div className="min-h-full flex flex-col">
          <div className="px-4 pt-6 pb-4">
            <h2 className="text-white font-black text-2xl mb-1">🏆 Grand Final</h2>
            <p className="text-white/40 text-sm">Round-robin complete! Time for the final.</p>
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
                  <span className="text-yellow-400 text-xs">First to 6</span>
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
          <TournamentTable rows={table} players={players} finalistIds={finalistIds} />

          {/* Start final button */}
          <div className="px-4 py-4 mt-auto">
            <button
              onClick={() => startFinal()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 font-black text-white text-lg shadow-lg shadow-yellow-500/30"
            >
              🏆 Start Final Match
            </button>
          </div>
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
          <p className="text-white/40 text-sm">First to 6 points wins the tournament</p>
        </div>

        {/* Head-to-head display */}
        <div className="px-4 mb-6">
          <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/20 border border-yellow-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-around">
              <motion.div
                layoutId={`player-card-${finalPlayerA.id}`}
                className="flex flex-col items-center gap-2"
              >
                <AvatarSVG type={finalPlayerA.avatar} size={80} emoji={finalPlayerA.avatarEmoji} color={finalPlayerA.avatarColor} />
                <p className="text-white font-bold text-sm">{finalPlayerA.name}</p>
              </motion.div>
              <div className="flex flex-col items-center">
                <span className="text-white/30 text-2xl font-black">VS</span>
              </div>
              <motion.div
                layoutId={`player-card-${finalPlayerB.id}`}
                className="flex flex-col items-center gap-2"
              >
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
            if (margin >= 4) setShowConfetti(true);
            confirmFinalScore(sA, sB);
          }}
          onToggleCourtSide={undefined}
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

          {/* Final score display */}
          {final?.played && final.scoreA !== undefined && final.scoreB !== undefined && (
            <div className="mt-4 bg-white/5 border border-white/10 rounded-xl px-6 py-3 inline-flex items-center gap-3">
              <span className="text-white font-bold">{getPlayer(final.playerA).name}</span>
              <span className="text-white/40 text-sm">
                {final.scoreA} – {final.scoreB}
              </span>
              <span className="text-white font-bold">{getPlayer(final.playerB).name}</span>
            </div>
          )}
        </div>

        {/* Final standings */}
        <p className="px-4 text-white/40 text-xs uppercase tracking-widest mb-2">Final Standings</p>
        <TournamentTable
          rows={table}
          players={players}
          showFinalLabel={true}
        />

        {/* Actions */}
        <div className="px-4 py-6 flex flex-col gap-3">
          <button
            onClick={closeTournament}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 font-black text-white text-lg shadow-lg shadow-purple-500/30"
          >
            Save & Start Next Tournament 🏸
          </button>
        </div>
      </div>
    );
  }

  return null;
}
