"use client";
// components/TournamentSetup.tsx — Pre-tournament config screen (scoring rules)

import React, { useState } from "react";
import { motion } from "framer-motion";
import { TournamentConfig, DEFAULT_CONFIG } from "@/lib/types";

interface TournamentSetupProps {
  playerCount: number;
  matchCount: number;          // how many round-robin matches will be generated
  onConfirm: (config: TournamentConfig) => void;
  onBack: () => void;
}

function Stepper({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-white text-sm font-semibold">{label}</p>
        {hint && <p className="text-white/40 text-xs mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-8 h-8 rounded-full bg-white/10 text-white font-bold hover:bg-white/20 transition-colors disabled:opacity-30 text-lg flex items-center justify-center"
        >
          −
        </button>
        <span className="text-white font-black text-lg w-8 text-center tabular-nums">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-8 h-8 rounded-full bg-white/10 text-white font-bold hover:bg-white/20 transition-colors disabled:opacity-30 text-lg flex items-center justify-center"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function TournamentSetup({ playerCount, matchCount, onConfirm, onBack }: TournamentSetupProps) {
  const [cfg, setCfg] = useState<TournamentConfig>({ ...DEFAULT_CONFIG });

  const update = (key: keyof TournamentConfig, value: number) =>
    setCfg((c) => ({ ...c, [key]: value }));

  const winPts = cfg.winPoints + cfg.bonusPoints;
  const loserPts = cfg.finalLoserPenalty;

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <button onClick={onBack} className="text-white/40 text-sm mb-4 flex items-center gap-1 hover:text-white/70 transition-colors">
          ← Back
        </button>
        <h2 className="text-white font-black text-2xl leading-tight">Tournament Setup</h2>
        <p className="text-white/40 text-xs mt-1">
          {playerCount} players · {matchCount} round-robin matches
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">

        {/* Round-robin rules */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2"
        >
          <p className="text-purple-400 text-xs uppercase tracking-widest font-bold pt-2 pb-1">
            🏸 Round-Robin Match Rules
          </p>

          <Stepper
            label="Win score"
            hint="First player to reach this score wins the match"
            value={cfg.winScore}
            onChange={(v) => update("winScore", v)}
            min={3}
            max={21}
          />
          <Stepper
            label="Base win points"
            hint="Points awarded to the winner"
            value={cfg.winPoints}
            onChange={(v) => update("winPoints", v)}
            min={1}
            max={10}
          />
          <Stepper
            label="Bonus points"
            hint={`Extra points added when win margin ≥ ${cfg.bonusMargin} (total: ${winPts})`}
            value={cfg.bonusPoints}
            onChange={(v) => update("bonusPoints", v)}
            min={0}
            max={5}
          />
          <Stepper
            label="Bonus margin"
            hint={`Minimum winning margin to earn bonus (e.g. ${cfg.winScore}-${cfg.winScore - cfg.bonusMargin} or better)`}
            value={cfg.bonusMargin}
            onChange={(v) => update("bonusMargin", v)}
            min={1}
            max={cfg.winScore - 1}
          />
        </motion.div>

        {/* Points preview */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-purple-500/10 border border-purple-500/20 rounded-2xl px-4 py-3"
        >
          <p className="text-purple-300 text-xs uppercase tracking-widest font-bold mb-2">📊 Match Points Preview</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Array.from({ length: cfg.winScore }, (_, i) => i).map((loserScore) => {
              const margin = cfg.winScore - loserScore;
              const pts = margin >= cfg.bonusMargin ? cfg.winPoints + cfg.bonusPoints : cfg.winPoints;
              return (
                <div key={loserScore} className="flex justify-between items-center bg-white/5 rounded-lg px-3 py-1">
                  <span className="text-white/50 font-mono">{cfg.winScore}–{loserScore}</span>
                  <span className={`font-black ${pts > cfg.winPoints ? "text-yellow-400" : "text-white"}`}>
                    {pts} pts {pts > cfg.winPoints ? "⭐" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Final rules */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 border border-yellow-500/20 rounded-2xl px-4 py-2"
        >
          <p className="text-yellow-400 text-xs uppercase tracking-widest font-bold pt-2 pb-1">
            🏆 Final Match Rules
          </p>

          <Stepper
            label="Final win score"
            hint="First player to reach this score wins the final"
            value={cfg.finalWinScore}
            onChange={(v) => update("finalWinScore", v)}
            min={3}
            max={21}
          />
          <Stepper
            label="Winner reward points"
            hint="Extra points awarded to winner for winning the final"
            value={cfg.finalWinBase}
            onChange={(v) => update("finalWinBase", v)}
            min={0}
            max={10}
          />
          <Stepper
            label="Loser penalty margin"
            hint={`Loser receives penalty if winner's margin ≥ this value (e.g. ${cfg.finalWinScore}–${cfg.finalWinScore - cfg.finalBonusMargin} or worse)`}
            value={cfg.finalBonusMargin}
            onChange={(v) => update("finalBonusMargin", v)}
            min={1}
            max={cfg.finalWinScore - 1}
          />
          <Stepper
            label="Loser penalty"
            hint={`Points deducted from loser when conceding margin ≥ ${cfg.finalBonusMargin} (currently: ${loserPts})`}
            value={Math.abs(cfg.finalLoserPenalty)}
            onChange={(v) => update("finalLoserPenalty", -v)}
            min={0}
            max={5}
          />
        </motion.div>

        {/* Final preview */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-4 py-3"
        >
          <p className="text-yellow-300 text-xs uppercase tracking-widest font-bold mb-2">🏆 Final Points Preview</p>
          <div className="space-y-1 text-sm">
            {[
              { score: `${cfg.finalWinScore}–0`, margin: cfg.finalWinScore },
              { score: `${cfg.finalWinScore}–${cfg.finalWinScore - cfg.finalBonusMargin}`, margin: cfg.finalBonusMargin },
              { score: `${cfg.finalWinScore}–${cfg.finalWinScore - cfg.finalBonusMargin + 1}`, margin: cfg.finalBonusMargin - 1 },
              { score: `${cfg.finalWinScore}–${cfg.finalWinScore - 1}`, margin: 1 },
            ].filter((v, i, arr) => arr.findIndex(x => x.score === v.score) === i).map(({ score, margin }) => {
              const winnerPts = cfg.finalWinBase;
              const loserPtsVal = margin >= cfg.finalBonusMargin ? cfg.finalLoserPenalty : 0;
              return (
                <div key={score} className="flex justify-between items-center bg-white/5 rounded-lg px-3 py-1">
                  <span className="text-white/50 font-mono">{score}</span>
                  <span className="text-white/60 text-xs">
                    Winner: <span className="text-green-400 font-bold">+{winnerPts} pts</span>
                    {" · "}
                    Loser: <span className={loserPtsVal < 0 ? "text-red-400 font-bold" : "text-white/40"}>{loserPtsVal} pts</span>
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
        {/* Practice / Test Mode Toggle Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => setCfg((c) => ({ ...c, isPractice: !c.isPractice }))}
          className={`cursor-pointer border rounded-2xl p-4 transition-all flex items-center justify-between gap-3 ${
            cfg.isPractice
              ? "bg-amber-500/15 border-amber-500/40 shadow-lg shadow-amber-500/10"
              : "bg-white/5 border-white/10 hover:border-white/20"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
              cfg.isPractice ? "bg-amber-500/30 text-amber-300" : "bg-white/10 text-gray-400"
            }`}>
              🧪
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Practice / Test Mode</span>
                {cfg.isPractice && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/40">
                    TESTING
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {cfg.isPractice
                  ? "Test match active: won't be saved to permanent history or leaderboards."
                  : "Ranked match: will be saved to Day Table & permanent Leaderboards."}
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className={`w-12 h-6 rounded-full transition-colors p-0.5 flex items-center ${
            cfg.isPractice ? "bg-amber-500 justify-end" : "bg-white/20 justify-start"
          }`}>
            <motion.div
              layout
              className="w-5 h-5 rounded-full bg-white shadow-md"
            />
          </div>
        </motion.div>
      </div>

      {/* Start button */}
      <div className="px-4 pb-6 pt-2">
        <motion.button
          onClick={() => onConfirm(cfg)}
          whileTap={{ scale: 0.97 }}
          className={`w-full py-4 rounded-2xl font-black text-white text-lg shadow-lg transition-all ${
            cfg.isPractice
              ? "bg-gradient-to-r from-amber-600 to-orange-600 shadow-amber-500/30"
              : "bg-gradient-to-r from-purple-600 to-blue-600 shadow-purple-500/30"
          }`}
        >
          {cfg.isPractice ? "Start Practice Tournament 🧪" : "Start Ranked Tournament 🏸"}
        </motion.button>
      </div>
    </div>
  );
}
