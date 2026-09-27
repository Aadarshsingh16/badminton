"use client";
// components/ScoreInput.tsx — Bottom sheet for entering match scores

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Player, Match } from "@/lib/types";
import { AvatarSVG } from "./avatars/AvatarSVG";

interface ScoreInputProps {
  match: Match;
  playerA: Player;
  playerB: Player;
  isFinal?: boolean;  // first-to-6 instead of 5
  open: boolean;
  onClose: () => void;
  onConfirm: (scoreA: number, scoreB: number) => void;
  onToggleCourtSide?: () => void;
}

export function ScoreInput({
  match,
  playerA,
  playerB,
  isFinal = false,
  open,
  onClose,
  onConfirm,
  onToggleCourtSide,
}: ScoreInputProps) {
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const maxScore = isFinal ? 6 : 5;

  const canConfirm =
    (scoreA === maxScore || scoreB === maxScore) && scoreA !== scoreB;

  const reset = () => {
    setScoreA(0);
    setScoreB(0);
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
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-slate-900 border-t border-white/10 rounded-t-3xl pb-8 pt-4 px-4 max-w-lg mx-auto"
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

            {/* Match label */}
            <p className="text-center text-white/50 text-xs uppercase tracking-widest mb-4">
              {isFinal ? "🏆 Grand Final — First to 6" : `Round ${match.round + 1} — First to ${maxScore}`}
            </p>

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
            <div className="flex items-center justify-between gap-3 mb-6">
              {/* Player A */}
              <div className="flex-1 flex flex-col items-center gap-2">
                <AvatarSVG type={playerA.avatar} size={52} emoji={playerA.avatarEmoji} color={playerA.avatarColor} />
                <p className="text-white font-semibold text-sm text-center truncate w-full text-center">{playerA.name}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScoreA(Math.max(0, scoreA - 1))}
                    className="w-10 h-10 rounded-full bg-white/10 text-white text-xl font-bold hover:bg-white/20 transition-colors active:scale-95"
                  >
                    −
                  </button>
                  <motion.span
                    key={scoreA}
                    initial={{ scale: 1.3, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`text-4xl font-black w-12 text-center tabular-nums ${
                      scoreA === maxScore && scoreA > scoreB ? "text-green-400" : "text-white"
                    }`}
                  >
                    {scoreA}
                  </motion.span>
                  <button
                    onClick={() => setScoreA(Math.min(maxScore, scoreA + 1))}
                    disabled={scoreA === maxScore}
                    className="w-10 h-10 rounded-full bg-white/10 text-white text-xl font-bold hover:bg-white/20 transition-colors active:scale-95 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* VS divider */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-white/30 font-black text-xl">VS</span>
                {scoreA === maxScore || scoreB === maxScore ? (
                  <span className="text-xs text-white/40">
                    {scoreA > scoreB ? "🏆 A wins" : "🏆 B wins"}
                  </span>
                ) : null}
              </div>

              {/* Player B */}
              <div className="flex-1 flex flex-col items-center gap-2">
                <AvatarSVG type={playerB.avatar} size={52} emoji={playerB.avatarEmoji} color={playerB.avatarColor} />
                <p className="text-white font-semibold text-sm text-center truncate w-full text-center">{playerB.name}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScoreB(Math.max(0, scoreB - 1))}
                    className="w-10 h-10 rounded-full bg-white/10 text-white text-xl font-bold hover:bg-white/20 transition-colors active:scale-95"
                  >
                    −
                  </button>
                  <motion.span
                    key={scoreB}
                    initial={{ scale: 1.3, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`text-4xl font-black w-12 text-center tabular-nums ${
                      scoreB === maxScore && scoreB > scoreA ? "text-green-400" : "text-white"
                    }`}
                  >
                    {scoreB}
                  </motion.span>
                  <button
                    onClick={() => setScoreB(Math.min(maxScore, scoreB + 1))}
                    disabled={scoreB === maxScore}
                    className="w-10 h-10 rounded-full bg-white/10 text-white text-xl font-bold hover:bg-white/20 transition-colors active:scale-95 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Confirm button */}
            <motion.button
              onClick={handleConfirm}
              disabled={!canConfirm}
              whileTap={canConfirm ? { scale: 0.97 } : undefined}
              className={`w-full py-4 rounded-2xl font-bold text-white text-lg transition-all ${
                canConfirm
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg shadow-purple-500/30"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              {canConfirm ? "Confirm Score ✓" : `Set a winner (first to ${maxScore})`}
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
