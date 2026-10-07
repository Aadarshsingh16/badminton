"use client";
// components/ScoreInput.tsx — Bottom sheet for entering match scores

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Player, Match, TournamentConfig, DEFAULT_CONFIG } from "@/lib/types";
import { AvatarSVG } from "./avatars/AvatarSVG";
import { useStore } from "@/lib/store";

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
    <div className="flex flex-col items-center gap-1 w-full">
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-0.5 w-full">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xl font-black transition-all active:scale-95 flex items-center justify-center disabled:opacity-25 flex-shrink-0"
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
            className={`w-11 sm:w-13 text-center text-3xl sm:text-4xl font-black bg-slate-50 border-2 rounded-2xl outline-none tabular-nums
              ${highlight ? "border-emerald-500 text-emerald-700 bg-emerald-50" : "border-slate-300 text-slate-900"}`}
            style={{ MozAppearance: "textfield" } as React.CSSProperties}
          />
        ) : (
          <motion.button
            key={value}
            type="button"
            initial={{ scale: 1.25, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={() => { setRaw(String(value)); setInputMode(true); setTimeout(() => inputRef.current?.select(), 30); }}
            className={`text-3xl sm:text-4xl font-black w-11 sm:w-13 text-center tabular-nums rounded-2xl py-0.5 hover:bg-slate-50 transition-colors flex-shrink-0 ${
              highlight ? "text-emerald-700 font-black" : "text-slate-900"
            }`}
          >
            {value}
          </motion.button>
        )}

        <button
          type="button"
          onClick={() => onChange(Math.min(maxScore, value + 1))}
          disabled={value >= maxScore}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-950 hover:bg-slate-800 text-white text-xl font-black transition-all active:scale-95 disabled:opacity-25 shadow-xs flex items-center justify-center flex-shrink-0"
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

  // Sync sheet open state with global store so BottomTabBar smoothly hides/shows
  const setIsScoreSheetOpen = useStore((s) => s.setIsScoreSheetOpen);
  const totalTournamentPlayers = useStore((s) => s.currentTournament?.playerIds?.length || s.players.length) || 3;

  useEffect(() => {
    setIsScoreSheetOpen(open);
    return () => {
      setIsScoreSheetOpen(false);
    };
  }, [open, setIsScoreSheetOpen]);

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
    setIsScoreSheetOpen(false);
    onConfirm(scoreA, scoreB);
    reset();
    onClose();
  };

  const handleClose = () => {
    setIsScoreSheetOpen(false);
    reset();
    onClose();
  };

  const handleMinimize = () => {
    setIsScoreSheetOpen(false);
    onMinimize?.();
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
            className="fixed inset-0 bg-slate-950/60 z-40 backdrop-blur-sm"
            onClick={onMinimize ? handleMinimize : handleClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200/80 rounded-t-[36px] shadow-2xl pb-8 pt-4 px-4 sm:px-5 max-w-md mx-auto"
          >
            {/* Header with drag handle and Minimize button */}
            <div className="flex items-center justify-between px-1 mb-3">
              <div className="w-16" />
              <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
              <div className="w-16 flex justify-end">
                {onMinimize && (
                  <button
                    type="button"
                    onClick={handleMinimize}
                    className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition-colors flex items-center gap-1 active:scale-95 shadow-2xs cursor-pointer"
                  >
                    <span>⌄</span>
                    <span>Hide</span>
                  </button>
                )}
              </div>
            </div>

            {/* Match label */}
            <p className="text-center text-slate-400 text-xs uppercase tracking-wider font-extrabold mb-1">
              {isFinal
                ? `🏆 Grand Final — First to ${maxScore}`
                : `Round ${match.round + 1} — First to ${maxScore}`}
            </p>
            {isEditing && (
              <p className="text-center text-amber-600 font-bold text-xs mb-3">✏️ Editing confirmed score</p>
            )}

            {/* Court side indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={`text-xs px-3 py-1 rounded-full font-bold border ${sideA === 1 ? "bg-indigo-50 text-indigo-700 border-indigo-200/70" : "bg-orange-50 text-orange-700 border-orange-200/70"}`}>
                {playerA.name}: Side {sideA}
              </div>
              {onToggleCourtSide && (
                <button
                  onClick={onToggleCourtSide}
                  className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 font-bold border border-slate-200 transition-colors cursor-pointer"
                >
                  ⇄ Swap
                </button>
              )}
              <div className={`text-xs px-3 py-1 rounded-full font-bold border ${sideB === 1 ? "bg-indigo-50 text-indigo-700 border-indigo-200/70" : "bg-orange-50 text-orange-700 border-orange-200/70"}`}>
                {playerB.name}: Side {sideB}
              </div>
            </div>

            {/* Score inputs - symmetric 3-column grid */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-1 sm:gap-2 mb-3">
              {/* Player A */}
              <div className="flex flex-col items-center gap-2 min-w-0">
                <AvatarSVG type={playerA.avatar} size={52} emoji={playerA.avatarEmoji} color={playerA.avatarColor} />
                <p className="text-slate-900 font-black text-sm text-center truncate w-full px-1">{playerA.name}</p>
                <ScoreCounter
                  value={scoreA}
                  onChange={updateScoreA}
                  maxScore={maxScore}
                  highlight={aWins}
                  label={playerA.name}
                />
              </div>

              {/* VS divider */}
              <div className="flex flex-col items-center gap-1 pt-12 sm:pt-14 px-1">
                <span className="text-slate-300 font-black text-lg sm:text-xl">VS</span>
                {canConfirm && (
                  <span className="text-[11px] font-bold text-indigo-600 whitespace-nowrap">
                    {winnerIsA ? `🏆 ${playerA.name}` : `🏆 ${playerB.name}`}
                  </span>
                )}
              </div>

              {/* Player B */}
              <div className="flex flex-col items-center gap-2 min-w-0">
                <AvatarSVG type={playerB.avatar} size={52} emoji={playerB.avatarEmoji} color={playerB.avatarColor} />
                <p className="text-slate-900 font-black text-sm text-center truncate w-full px-1">{playerB.name}</p>
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
                className="flex justify-center gap-3 mb-4 flex-wrap"
              >
                {[
                  { player: playerA, score: scoreA, won: aWins },
                  { player: playerB, score: scoreB, won: bWins },
                ].map(({ player, won }) => {
                  if (isFinal) {
                    const N = totalTournamentPlayers;
                    const bonusMargin = config?.finalBonusMargin ?? DEFAULT_CONFIG.finalBonusMargin;
                    const hasPenalty = margin >= bonusMargin;
                    const dayPts = won ? N : (hasPenalty ? Math.max(1, (N - 1) - 1) : Math.max(1, N - 1));
                    const label = won ? "1st 🏆" : (hasPenalty ? "2nd, -1 penalty" : "2nd");
                    return (
                      <div
                        key={player.id}
                        className={`text-xs px-3 py-1 rounded-full font-black border ${
                          won
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : hasPenalty
                            ? "bg-amber-50 text-amber-800 border-amber-300"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {player.name}: {dayPts} Day Pts ({label})
                      </div>
                    );
                  }

                  const pts = won
                    ? (margin >= config.bonusMargin ? config.winPoints + config.bonusPoints : config.winPoints)
                    : 0;

                  return (
                    <div
                      key={player.id}
                      className={`text-xs px-3 py-1 rounded-full font-black border ${
                        pts > 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
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
              className={`w-full py-4 rounded-2xl font-black text-base transition-all ${
                canConfirm
                  ? isEditing
                    ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 active:scale-98 cursor-pointer"
                    : "bg-slate-950 hover:bg-slate-800 text-white shadow-xl shadow-slate-950/20 active:scale-98 cursor-pointer"
                  : "bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed font-bold"
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
