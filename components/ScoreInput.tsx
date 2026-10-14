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
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 text-[#F3F4EE] text-2xl font-black transition-all active:scale-95 flex items-center justify-center disabled:opacity-25 flex-shrink-0 cursor-pointer"
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
            className={`w-14 text-center text-4xl sm:text-5xl font-black bg-[#14161B] border-2 rounded-2xl outline-none tabular-nums
              ${highlight ? "border-[#FF5E48] text-[#FF5E48]" : "border-white/20 text-[#F3F4EE]"}`}
            style={{ MozAppearance: "textfield" } as React.CSSProperties}
          />
        ) : (
          <motion.button
            key={value}
            type="button"
            initial={{ scale: 1.2, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={() => { setRaw(String(value)); setInputMode(true); setTimeout(() => inputRef.current?.select(), 30); }}
            className={`text-4xl sm:text-5xl font-black w-14 text-center tabular-nums rounded-2xl py-0.5 hover:bg-white/5 transition-colors flex-shrink-0 cursor-pointer ${
              highlight ? "text-[#FF5E48]" : "text-[#F3F4EE]"
            }`}
          >
            {value}
          </motion.button>
        )}

        <button
          type="button"
          onClick={() => onChange(Math.min(maxScore, value + 1))}
          disabled={value >= maxScore}
          className="w-10 h-10 rounded-full bg-[#FF5E48] hover:bg-[#FF725E] text-white text-2xl font-black transition-all active:scale-95 disabled:opacity-25 shadow-md shadow-[#FF5E48]/30 flex items-center justify-center flex-shrink-0 cursor-pointer"
        >
          +
        </button>
      </div>
      <p className="text-[#8E95A5] text-[10px] font-bold">tap number to type</p>
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
            className="fixed inset-0 bg-black/75 z-40 backdrop-blur-sm"
            onClick={onMinimize ? handleMinimize : handleClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-[#1A1D24] border-t border-white/10 rounded-t-[36px] shadow-2xl pb-8 pt-4 px-4 sm:px-5 max-w-md mx-auto text-[#F3F4EE]"
          >
            {/* Header with drag handle and Minimize button */}
            <div className="flex items-center justify-between px-1 mb-3">
              <div className="w-16" />
              <div className="w-12 h-1.5 bg-white/20 rounded-full" />
              <div className="w-16 flex justify-end">
                {onMinimize && (
                  <button
                    type="button"
                    onClick={handleMinimize}
                    className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 text-[11px] font-bold text-[#F3F4EE] transition-colors flex items-center gap-1 active:scale-95 shadow-2xs cursor-pointer"
                  >
                    <span>⌄</span>
                    <span>Hide</span>
                  </button>
                )}
              </div>
            </div>

            {/* Match label */}
            <p className="text-center text-[#8E95A5] text-xs uppercase tracking-wider font-black mb-1">
              {isFinal
                ? `🏆 Grand Final — First to ${maxScore}`
                : `Round ${match.round + 1} — First to ${maxScore}`}
            </p>
            {isEditing && (
              <p className="text-center text-[#F5BA38] font-bold text-xs mb-3">✏️ Editing confirmed score</p>
            )}

            {/* Court side indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={`text-xs px-3 py-1 rounded-full font-bold border ${sideA === 1 ? "bg-white/10 text-[#F3F4EE] border-white/10" : "bg-white/5 text-[#8E95A5] border-white/5"}`}>
                {playerA.name}: Side {sideA}
              </div>
              {onToggleCourtSide && (
                <button
                  onClick={onToggleCourtSide}
                  className="text-xs px-2.5 py-1 bg-white/10 hover:bg-white/20 text-[#F3F4EE] rounded-full font-bold border border-white/10 transition-colors cursor-pointer"
                >
                  ⇄ Swap
                </button>
              )}
              <div className={`text-xs px-3 py-1 rounded-full font-bold border ${sideB === 1 ? "bg-white/10 text-[#F3F4EE] border-white/10" : "bg-white/5 text-[#8E95A5] border-white/5"}`}>
                {playerB.name}: Side {sideB}
              </div>
            </div>

            {/* Score inputs - symmetric 3-column grid */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-1 sm:gap-2 mb-3">
              {/* Player A */}
              <div className="flex flex-col items-center gap-2 min-w-0">
                <AvatarSVG type={playerA.avatar} size={52} emoji={playerA.avatarEmoji} color={playerA.avatarColor} />
                <p className="text-[#F3F4EE] font-black text-sm text-center truncate w-full px-1">{playerA.name}</p>
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
                <span className="text-[#8E95A5] font-black text-lg sm:text-xl">VS</span>
                {canConfirm && (
                  <span className="text-[11px] font-bold text-[#F5BA38] whitespace-nowrap">
                    {winnerIsA ? `🏆 ${playerA.name}` : `🏆 ${playerB.name}`}
                  </span>
                )}
              </div>

              {/* Player B */}
              <div className="flex flex-col items-center gap-2 min-w-0">
                <AvatarSVG type={playerB.avatar} size={52} emoji={playerB.avatarEmoji} color={playerB.avatarColor} />
                <p className="text-[#F3F4EE] font-black text-sm text-center truncate w-full px-1">{playerB.name}</p>
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
                className="flex justify-center gap-2 mb-4 flex-wrap"
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
                            ? "bg-[#F5BA38]/20 text-[#F5BA38] border-[#F5BA38]/30"
                            : hasPenalty
                            ? "bg-[#FF5E48]/20 text-[#FF8E7E] border-[#FF5E48]/30"
                            : "bg-white/10 text-[#F3F4EE] border-white/10"
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
                          ? "bg-[#9EC9A8]/20 text-[#A8DAB3] border-[#9EC9A8]/30"
                          : "bg-white/10 text-[#8E95A5] border-white/10"
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
              className={`w-full py-4 rounded-full font-black text-sm uppercase tracking-wider transition-all ${
                canConfirm
                  ? isEditing
                    ? "bg-[#F5BA38] hover:bg-[#E0A82E] text-[#14161B] shadow-xl shadow-[#F5BA38]/20 cursor-pointer flex items-center justify-center gap-2"
                    : "bg-[#FF5E48] hover:bg-[#E84A35] text-white shadow-xl shadow-[#FF5E48]/30 cursor-pointer flex items-center justify-center gap-2"
                  : "bg-white/5 text-[#8E95A5] border border-white/5 cursor-not-allowed"
              }`}
            >
              <span>
                {canConfirm
                  ? isEditing ? "Update Score ↗" : "Confirm Score ↗"
                  : `Set a winner (first to ${maxScore})`}
              </span>
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
