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
    <div className="flex items-center justify-between py-3.5 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-slate-900 text-sm font-bold">{label}</p>
        {hint && <p className="text-slate-500 text-xs mt-0.5 font-medium leading-tight">{hint}</p>}
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
        >
          −
        </button>
        <span className="text-slate-900 font-black text-lg w-8 text-center tabular-nums">
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-9 h-9 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-black text-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none shadow-xs"
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
    <div className="min-h-full flex flex-col bg-[#F7F9FD] text-slate-900 pb-32">
      {/* Top Header */}
      <div className="px-5 pt-6 pb-3 border-b border-slate-200/60 bg-[#F7F9FD]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white border border-slate-200/80 text-slate-700 font-black text-sm flex items-center justify-center shadow-xs hover:bg-slate-50 active:scale-95 transition-all"
            title="Back to Player Selection"
          >
            ←
          </button>
          <div>
            <h1 className="text-slate-900 font-black text-2xl tracking-tight leading-none">
              Tournament Setup
            </h1>
            <p className="text-slate-500 text-xs mt-1 font-medium">
              {playerCount} players · {matchCount} round-robin matches
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 space-y-4">
        {/* Hero Info Card */}
        <div className="rounded-[30px] p-5 bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-white border border-indigo-100/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white border border-indigo-100 flex items-center justify-center text-2xl shadow-xs">
                🏸
              </div>
              <div>
                <p className="text-[10px] uppercase font-black tracking-wider text-indigo-700">
                  Scoring Configuration
                </p>
                <h3 className="text-slate-900 font-black text-base leading-tight">
                  Round-Robin &amp; Finals
                </h3>
              </div>
            </div>
            <span className="text-xs font-black text-indigo-900 bg-indigo-100/80 px-3 py-1.5 rounded-full">
              {matchCount} Matches
            </span>
          </div>
          <p className="text-slate-600 text-xs mt-2.5 leading-relaxed font-medium">
            Customize target win scores, bonus point thresholds, and final match rules before launching.
          </p>
        </div>

        {/* Round-robin rules card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200/80 rounded-[28px] p-5 shadow-xs space-y-1"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100/80 inline-flex items-center gap-1">
              <span>🏸</span>
              <span>Round-Robin Match Rules</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono font-medium">Stage 1</span>
          </div>

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

        {/* Round-robin points preview card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-indigo-50/60 border border-indigo-100/90 rounded-[26px] p-4.5 space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <p className="text-indigo-900 text-[10px] uppercase tracking-wider font-black">
              📊 Points Preview (Round-Robin)
            </p>
            <span className="text-[10px] text-indigo-600 font-bold">First to {cfg.winScore}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            {Array.from({ length: cfg.winScore }, (_, i) => i).map((loserScore) => {
              const margin = cfg.winScore - loserScore;
              const hasBonus = margin >= cfg.bonusMargin;
              const pts = hasBonus ? cfg.winPoints + cfg.bonusPoints : cfg.winPoints;
              return (
                <div
                  key={loserScore}
                  className={`flex justify-between items-center rounded-xl px-3 py-1.5 border transition-all ${
                    hasBonus
                      ? "bg-amber-50/90 border-amber-200/80 shadow-2xs"
                      : "bg-white border-slate-200/70 shadow-2xs"
                  }`}
                >
                  <span className="text-slate-600 font-mono font-bold text-xs">
                    {cfg.winScore}–{loserScore}
                  </span>
                  <span
                    className={`font-black text-xs ${
                      hasBonus ? "text-amber-900" : "text-slate-900"
                    }`}
                  >
                    {pts} pts {hasBonus ? "⭐" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Final rules card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-slate-200/80 rounded-[28px] p-5 shadow-xs space-y-1"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/80 inline-flex items-center gap-1">
              <span>🏆</span>
              <span>Final Match Rules</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono font-medium">Championship</span>
          </div>

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
            hint={`Points deducted from loser when margin ≥ ${cfg.finalBonusMargin} (currently: ${loserPts})`}
            value={Math.abs(cfg.finalLoserPenalty)}
            onChange={(v) => update("finalLoserPenalty", -v)}
            min={0}
            max={5}
          />
        </motion.div>

        {/* Final preview card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-amber-50/70 border border-amber-200/80 rounded-[26px] p-4.5 space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <p className="text-amber-900 text-[10px] uppercase tracking-wider font-black">
              🏆 Final Points Preview
            </p>
            <span className="text-[10px] text-amber-800 font-bold">First to {cfg.finalWinScore}</span>
          </div>

          <div className="space-y-1.5 text-xs">
            {[
              { score: `${cfg.finalWinScore}–0`, margin: cfg.finalWinScore },
              { score: `${cfg.finalWinScore}–${cfg.finalWinScore - cfg.finalBonusMargin}`, margin: cfg.finalBonusMargin },
              { score: `${cfg.finalWinScore}–${cfg.finalWinScore - cfg.finalBonusMargin + 1}`, margin: cfg.finalBonusMargin - 1 },
              { score: `${cfg.finalWinScore}–${cfg.finalWinScore - 1}`, margin: 1 },
            ].filter((v, i, arr) => arr.findIndex((x) => x.score === v.score) === i).map(({ score, margin }) => {
              const winnerPts = cfg.finalWinBase;
              const loserPtsVal = margin >= cfg.finalBonusMargin ? cfg.finalLoserPenalty : 0;
              return (
                <div
                  key={score}
                  className="flex justify-between items-center bg-white rounded-xl px-3 py-2 border border-amber-200/60 shadow-2xs"
                >
                  <span className="text-slate-700 font-mono font-bold">{score}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium text-[11px]">
                      Winner: <strong className="text-emerald-700 font-black">+{winnerPts} pts</strong>
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-600 font-medium text-[11px]">
                      Loser:{" "}
                      <strong className={loserPtsVal < 0 ? "text-rose-600 font-black" : "text-slate-500 font-bold"}>
                        {loserPtsVal} pts
                      </strong>
                    </span>
                  </div>
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
          className={`cursor-pointer border rounded-[28px] p-4.5 transition-all flex items-center justify-between gap-3 shadow-xs ${
            cfg.isPractice
              ? "bg-amber-50/90 border-2 border-amber-400"
              : "bg-white border border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-xs ${
                cfg.isPractice ? "bg-amber-100 border border-amber-300 text-amber-900" : "bg-slate-100 text-slate-600"
              }`}
            >
              🧪
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900">Practice / Test Mode</span>
                {cfg.isPractice && (
                  <span className="text-[10px] bg-amber-200/80 text-amber-950 font-black px-2 py-0.5 rounded-full border border-amber-300">
                    TESTING
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium leading-tight">
                {cfg.isPractice
                  ? "Test match active: won't be saved to permanent history or leaderboards."
                  : "Ranked match: will be saved to Day Table & permanent Leaderboards."}
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <div
            className={`w-12 h-6 rounded-full transition-colors p-0.5 flex items-center flex-shrink-0 ${
              cfg.isPractice ? "bg-slate-950 justify-end" : "bg-slate-200 justify-start"
            }`}
          >
            <motion.div
              layout
              className="w-5 h-5 rounded-full bg-white shadow-sm"
            />
          </div>
        </motion.div>
      </div>

      {/* Sticky Bottom CTA Bar */}
      <div className="sticky bottom-0 p-5 bg-gradient-to-t from-[#F7F9FD] via-[#F7F9FD]/95 to-transparent pt-3 z-30">
        <motion.button
          onClick={() => onConfirm(cfg)}
          whileTap={{ scale: 0.98 }}
          className={`w-full py-4 rounded-full font-black text-white text-base shadow-lg transition-all flex items-center justify-center gap-2 ${
            cfg.isPractice
              ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/20"
              : "bg-slate-950 hover:bg-slate-800 shadow-slate-950/20"
          }`}
        >
          <span>{cfg.isPractice ? "Start Practice Tournament 🧪" : "Start Ranked Tournament 🏸"}</span>
          <span>&rarr;</span>
        </motion.button>
      </div>
    </div>
  );
}  </motion.button>
      </div>
    </div>
  );
}
