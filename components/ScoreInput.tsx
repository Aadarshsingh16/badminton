"use client";
// components/ScoreInput.tsx — Bottom sheet for entering match scores

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Player, Match, TournamentConfig, DEFAULT_CONFIG } from "@/lib/types";
import { AvatarSVG } from "./avatars/AvatarSVG";

interface ScoreInputProps {
  match: Match;
  playerA: Player;
  playerB: Player;
  isFinal?: boolean;
  isEditing?: boolean;       // true when editing an already-played match
  open: boolean;
  onClose: () => void;
  onConfirm: (scoreA: number, scoreB: number) => void;
  onToggleCourtSide?: () => void;
  config?: TournamentConfig;
  onMinimize?: () => void;
  currentScores?: { scoreA: number; scoreB: number };
  onScoresChange?: (scoreA: number, scoreB: number) => void;
}

function ScoreCounter({
  value,
  onChange,
  maxScore,
  highlight,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  maxScore: number;
  highlight: boolean;
  label: string;
}) {
  const [inputMode, setInputMode] = useState(false);
  const [raw, setRaw] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync raw when value changes externally
  useEffect(() => {
    if (!inputMode) setRaw(String(value));
  }, [value, inputMode]);

  const commitRaw = () => {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 0 && n <= maxScore) {
      onChange(n);
    } else {
      setRaw(String(value));
    }
    setInputMode(false);
  };

  return (
    <div className="flex-1 flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-2xl font-black transition-colors active:scale-95 flex items-center justify-center disabled:opacity-30"
        >
          −
        </button>

        {inputMode ? (
          <input
            ref={inputRef}
            type="number"
            value={raw}
            min={0}
            max={maxScore}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={commitRaw}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRaw();
              if (e.key === "Escape") { setRaw(String(value)); setInputMode(false); }
            }}
            className={`w-16 text-center text-4xl font-black bg-slate-50 border-2 rounded-2xl outline-none tabular-nums
              ${highlight ? "border-emerald-500 text-emerald-700 bg-emerald-50" : "border-slate-300 text-slate-900"}`}
            style={{ MozAppearance: "textfield" } as React.CSSProperties}
          />
        ) : (
          <motion.button
            key={value}
            initial={{ scale: 1.25, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={() => { setRaw(String(value)); setInputMode(true); setTimeout(() => inputRef.current?.select(), 30); }}
            className={`text-4xl font-black w-16 text-center tabular-nums rounded-2xl px-1 py-1 hover:bg-slate-50 transition-colors ${
              highlight ? "text-emerald-700 font-black" : "text-slate-900"
            }`}
          >
            {value}
          </motion.button>
        )}

        <button
          onClick={() => onChange(Math.min(maxScore, value + 1))}
          disabled={value === maxScore}
          className="w-11 h-11 rounded-full bg-slate-950 hover:bg-slate-800 text-white text-2xl font-black transition-colors active:scale-95 disabled:opacity-30 shadow-xs flex items-center justify-center"
        >
          +
        </button>
      </div>
      <p className="text-slate-400 text-[10px] font-medium">tap score to type</p>
    </div>
  );
}

export function ScoreInput({
  match,
  playerA,
  playerB,
  isFinal = false,
  isEditing = false,
  open,
  onClose,
  onConfirm,
  onToggleCourtSide,
  config = DEFAULT_CONFIG,
  onMinimize,
  currentScores,
  onScoresChange,
}: ScoreInputProps) {
  const maxScore = isFinal ? config.finalWinScore : config.winScore;

  const [scoreA, setScoreA] = useState(() => currentScores?.scoreA ?? match.scoreA ?? 0);
  const [scoreB, setScoreB] = useState(() => currentScores?.scoreB ?? match.scoreB ?? 0);

  // Re-seed when sheet opens or match changes
  useEffect(() => {
    if (open) {
      if (currentScores) {
        setScoreA(currentScores.scoreA);
        setScoreB(currentScores.scoreB);
      } else {
        setScoreA(match.scoreA ?? 0);
        setScoreB(match.scoreB ?? 0);
      }
    }
  }, [open, match.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateScoreA = (v: number) => {
    setScoreA(v);
    onScoresChange?.(v, scoreB);
  };

  const updateScoreB = (v: number) => {
    setScoreB(v);
    onScoresChange?.(scoreA, v);
  };

  const canConfirm =
    (scoreA === maxScore || scoreB === maxScore) && scoreA !== scoreB;

  const reset = () => {
    setScoreA(0);
    setScoreB(0);
    onScoresChange?.(0, 0);
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(scoreA, scoreB);
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const sideA = match.courtSide[playerA.id];
  const sideB = match.courtSide[playerB.id];

  // Points preview
  const winScore = Math.max(scoreA, scoreB);
  const loseScore = Math.min(scoreA, scoreB);
  const margin = winScore - loseScore;
  const winnerIsA = scoreA > scoreB;
  const aWins = scoreA === maxScore && scoreA > scoreB;
  const bWins = scoreB === maxScore && scoreB > scoreA;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
            onClick={onMinimize ? onMinimize : handleClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-slate-900 border-t border-white/10 rounded-t-3xl pb-8 pt-4 px-4 max-w-lg mx-auto"
          >
            {/* Header with drag handle and Minimize button */}
            <div className="flex items-center justify-between px-1 mb-3">
              <div className="w-16" />
              <div className="w-10 h-1 bg-white/20 rounded-full" />
              <div className="w-16 flex justify-end">
                {onMinimize && (
                  <button
                    type="button"
                    onClick={onMinimize}
                    className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white/80 transition-colors flex items-center gap-1 active:scale-95 shadow-sm"
                  >
                    <span>⌄</span>
                    <span>Hide</span>
                  </button>
                )}
              </div>
            </div>

            {/* Match label */}
            <p className="text-center text-white/50 text-xs uppercase tracking-widest mb-1">
              {isFinal
                ? `🏆 Grand Final — First to ${maxScore}`
                : `Round ${match.round + 1} — First to ${maxScore}`}
            </p>
            {isEditing && (
              <p className="text-center text-orange-400 text-xs mb-3">✏️ Editing confirmed score</p>
            )}

            {/* Court side indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={`text-xs px-3 py-1 rounded-full font-medium ${sideA === 1 ? "bg-blue-500/20 text-blue-300" : "bg-orange-500/20 text-orange-300"}`}>
                {playerA.name}: Side {sideA}
              </div>
              {onToggleCourtSide && (
                <button
                  onClick={onToggleCourtSide}
                  className="text-xs px-2 py-1 bg-white/10 text-white/50 rounded-full hover:bg-white/20 transition-colors"
                >
                  ⇄ Swap
                </button>
              )}
              <div className={`text-xs px-3 py-1 rounded-full font-medium ${sideB === 1 ? "bg-blue-500/20 text-blue-300" : "bg-orange-500/20 text-orange-300"}`}>
                {playerB.name}: Side {sideB}
              </div>
            </div>

            {/* Score inputs */}
            <div className="flex items-start justify-between gap-3 mb-2">
              {/* Player A */}
              <div className="flex-1 flex flex-col items-center gap-2">
                <AvatarSVG type={playerA.avatar} size={52} emoji={playerA.avatarEmoji} color={playerA.avatarColor} />
                <p className="text-white font-semibold text-sm text-center truncate w-full">{playerA.name}</p>
                <ScoreCounter
                  value={scoreA}
                  onChange={updateScoreA}
                  maxScore={maxScore}
                  highlight={aWins}
                  label={playerA.name}
                />
              </div>

              {/* VS divider */}
              <div className="flex flex-col items-center gap-1 pt-14">
                <span className="text-white/30 font-black text-xl">VS</span>
                {canConfirm && (
                  <span className="text-xs text-white/40">
                    {winnerIsA ? `🏆 ${playerA.name}` : `🏆 ${playerB.name}`}
                  </span>
                )}
              </div>

              {/* Player B */}
              <div className="flex-1 flex flex-col items-center gap-2">
                <AvatarSVG type={playerB.avatar} size={52} emoji={playerB.avatarEmoji} color={playerB.avatarColor} />
                <p className="text-white font-semibold text-sm text-center truncate w-full">{playerB.name}</p>
                <ScoreCounter
                  value={scoreB}
                  onChange={updateScoreB}
                  maxScore={maxScore}
                  highlight={bWins}
                  label={playerB.name}
                />
              </div>
            </div>

            {/* Points preview */}
            {canConfirm && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center gap-4 mb-4"
              >
                {[
                  { player: playerA, score: scoreA, won: aWins },
                  { player: playerB, score: scoreB, won: bWins },
                ].map(({ player, score, won }) => {
                  const pts = isFinal
                    ? (won
                        ? (margin >= config.finalBonusMargin ? config.finalWinBase + config.finalWinBonus : config.finalWinBase)
                        : (margin >= config.finalBonusMargin ? config.finalLoserPenalty : 0))
                    : (won
                        ? (margin >= config.bonusMargin ? config.winPoints + config.bonusPoints : config.winPoints)
                        : 0);
                  return (
                    <div key={player.id} className={`text-xs px-3 py-1 rounded-full font-bold ${
                      pts > 0 ? "bg-green-500/20 text-green-400"
                      : pts < 0 ? "bg-red-500/20 text-red-400"
                      : "bg-white/10 text-white/40"
                    }`}>
                      {player.name}: {pts > 0 ? "+" : ""}{pts} pts
                    </div>
                  );
                })}
              </motion.div>
            )}

            {/* Confirm button */}
            <motion.button
              onClick={handleConfirm}
              disabled={!canConfirm}
              whileTap={canConfirm ? { scale: 0.97 } : undefined}
              className={`w-full py-4 rounded-2xl font-bold text-white text-lg transition-all ${
                canConfirm
                  ? isEditing
                    ? "bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-500/30"
                    : "bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg shadow-purple-500/30"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              {canConfirm
                ? isEditing ? "Update Score ✏️" : "Confirm Score ✓"
                : `Set a winner (first to ${maxScore})`}
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
