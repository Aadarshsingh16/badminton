"use client";
// components/TournamentSetup.tsx — Pre-tournament config screen (scoring rules & tournament format)

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { TournamentConfig, DEFAULT_CONFIG, TournamentFormat, Player } from "@/lib/types";
import { useStore } from "@/lib/store";
import { AvatarSVG } from "./avatars/AvatarSVG";
import { computePlayerByeCounts } from "@/lib/ranking";

interface TournamentSetupProps {
  playerCount: number;
  matchCount: number; // how many round-robin matches will be generated
  onConfirm: (config: TournamentConfig) => void;
  onBack: () => void;
  selectedPlayerIds?: string[];
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
    <div className="flex items-center justify-between py-3.5 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-[#F3F4EE] text-sm font-black">{label}</p>
        {hint && <p className="text-[#8E95A5] text-xs mt-0.5 font-medium leading-tight">{hint}</p>}
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-9 h-9 rounded-full bg-[#181B22] border border-white/10 hover:border-white/20 text-[#F3F4EE] font-black text-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-20 disabled:pointer-events-none"
        >
          −
        </button>
        <span className="text-[#F3F4EE] font-black text-lg w-8 text-center tabular-nums">
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-9 h-9 rounded-full bg-[#FF5E48] hover:bg-[#fa6249] text-white font-black text-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-20 disabled:pointer-events-none shadow-sm"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function TournamentSetup({
  playerCount,
  matchCount,
  onConfirm,
  onBack,
  selectedPlayerIds: propsSelectedIds,
}: TournamentSetupProps) {
  const store = useStore();
  const selectedPlayerIds = propsSelectedIds || store.selectedPlayerIds;
  const players = store.players;
  const pastTournaments = store.pastTournaments;
  const completedDays = store.completedDays;
  const dayTable = store.dayTable;

  const isEligibleForDE = playerCount === 7 || playerCount === 8;

  // Compute career points for finding wooden spoon / lowest on leaderboard
  const { totalPointsMap, lowestPlayerId } = useMemo(() => {
    const ptsMap: { [pid: string]: number } = {};
    for (const pid of selectedPlayerIds) ptsMap[pid] = 0;

    for (const cd of completedDays) {
      if (cd.totals) {
        for (const [pid, pts] of Object.entries(cd.totals)) {
          if (ptsMap[pid] !== undefined) ptsMap[pid] += pts || 0;
        }
      }
    }
    if (dayTable?.totals) {
      for (const [pid, pts] of Object.entries(dayTable.totals)) {
        if (ptsMap[pid] !== undefined) ptsMap[pid] += pts || 0;
      }
    }

    let lowestId = selectedPlayerIds[0];
    let minPts = ptsMap[lowestId] ?? 0;
    for (const pid of selectedPlayerIds) {
      if ((ptsMap[pid] ?? 0) < minPts) {
        minPts = ptsMap[pid] ?? 0;
        lowestId = pid;
      }
    }
    return { totalPointsMap: ptsMap, lowestPlayerId: lowestId };
  }, [selectedPlayerIds, completedDays, dayTable]);

  // Compute how many upper byes each player has received across past tournaments
  const byeCounts = useMemo(() => {
    return computePlayerByeCounts(pastTournaments, selectedPlayerIds);
  }, [pastTournaments, selectedPlayerIds]);

  // Find player with the minimum byes received
  const minByesPlayerId = useMemo(() => {
    if (selectedPlayerIds.length === 0) return null;
    let minId = selectedPlayerIds[0];
    let minCount = byeCounts[minId] ?? 0;
    for (const pid of selectedPlayerIds) {
      if ((byeCounts[pid] ?? 0) < minCount) {
        minCount = byeCounts[pid] ?? 0;
        minId = pid;
      }
    }
    return minId;
  }, [selectedPlayerIds, byeCounts]);

  // Initial format: default to double-elimination if 7 or 8 players, else round-robin
  const [selectedFormat, setSelectedFormat] = useState<TournamentFormat>(
    isEligibleForDE ? "double-elimination" : "round-robin"
  );

  // Upper Bye player (for 7-player DE)
  const defaultByePlayerId = lowestPlayerId || selectedPlayerIds[selectedPlayerIds.length - 1];
  const [selectedByeId, setSelectedByeId] = useState<string>(defaultByePlayerId);

  const [cfg, setCfg] = useState<TournamentConfig>({
    ...DEFAULT_CONFIG,
    format: isEligibleForDE ? "double-elimination" : "round-robin",
    upperByePlayerId: defaultByePlayerId,
  });

  const update = (key: keyof TournamentConfig, value: number) =>
    setCfg((c) => ({ ...c, [key]: value }));

  const handleFormatChange = (fmt: TournamentFormat) => {
    setSelectedFormat(fmt);
    setCfg((c) => ({
      ...c,
      format: fmt,
      upperByePlayerId: fmt === "double-elimination" && playerCount === 7 ? selectedByeId : undefined,
    }));
  };

  const handleByeSelect = (pid: string) => {
    setSelectedByeId(pid);
    setCfg((c) => ({ ...c, upperByePlayerId: pid }));
  };

  const winPts = cfg.winPoints + cfg.bonusPoints;
  const isDE = selectedFormat === "double-elimination" && isEligibleForDE;

  // Selected player objects for bye selector
  const activePlayers: Player[] = useMemo(() => {
    return selectedPlayerIds
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is Player => Boolean(p));
  }, [selectedPlayerIds, players]);

  // Match count display
  const deMatchEstimate = playerCount === 8 ? 15 : "10–13";

  return (
    <div className="min-h-full flex flex-col bg-[#14161B] text-[#F3F4EE] pb-32">
      {/* Top Header */}
      <div className="px-5 pt-6 pb-3 border-b border-white/10 bg-[#14161B]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-[#1E2128] border border-white/10 text-[#F3F4EE] font-black text-sm flex items-center justify-center hover:bg-[#252932] active:scale-95 transition-all"
            title="Back to Player Selection"
          >
            ←
          </button>
          <div>
            <h1 className="text-[#F3F4EE] font-black text-2xl uppercase tracking-tight leading-none">
              Tournament Setup
            </h1>
            <p className="text-[#8E95A5] text-xs mt-1 font-semibold uppercase tracking-wider">
              {playerCount} players · {isDE ? `${deMatchEstimate} DE matches` : `${matchCount} RR matches`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 space-y-4">
        {/* Format Selector Tabs (Only when 7 or 8 players) */}
        {isEligibleForDE && (
          <div className="bg-[#181B22] border border-white/10 p-1.5 rounded-2xl flex items-center gap-1 shadow-sm">
            <button
              type="button"
              onClick={() => handleFormatChange("double-elimination")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                isDE
                  ? "bg-[#FF5E48] text-white shadow-md"
                  : "text-[#8E95A5] hover:text-[#F3F4EE] hover:bg-white/5"
              }`}
            >
              <span>⚡ Double Elimination</span>
              <span className="text-[10px] bg-black/25 px-2 py-0.5 rounded-full font-mono">
                Fast
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleFormatChange("round-robin")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                !isDE
                  ? "bg-[#FF5E48] text-white shadow-md"
                  : "text-[#8E95A5] hover:text-[#F3F4EE] hover:bg-white/5"
              }`}
            >
              <span>🔄 Round Robin</span>
              <span className="text-[10px] bg-black/25 px-2 py-0.5 rounded-full font-mono">
                {matchCount}m
              </span>
            </button>
          </div>
        )}

        {/* Hero Info Card */}
        <div className="rounded-[30px] p-5 bg-[#1E2128] border border-white/10 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#14161B] border border-white/10 flex items-center justify-center text-2xl">
                {isDE ? "⚡" : "🏸"}
              </div>
              <div>
                <p className="text-[10px] uppercase font-black tracking-wider text-[#FF5E48]">
                  {isDE ? "Bracket Tournament" : "Scoring Configuration"}
                </p>
                <h3 className="text-[#F3F4EE] font-black text-base leading-tight">
                  {isDE ? `${playerCount}-Player Double Elimination` : "Round-Robin & Finals"}
                </h3>
              </div>
            </div>
            <span className="text-xs font-black text-[#F3F4EE] bg-white/10 px-3 py-1.5 rounded-full uppercase tracking-wider">
              {isDE ? `${deMatchEstimate} Matches` : `${matchCount} Matches`}
            </span>
          </div>
          <p className="text-[#8E95A5] text-xs mt-2.5 leading-relaxed font-medium">
            {isDE
              ? `Upper & Lower brackets with placement matches for every position. Quicker format without fatigue (${deMatchEstimate} matches vs ${matchCount} in round-robin).`
              : "Customize target win scores, bonus point thresholds, and final match rules before launching."}
          </p>
        </div>

        {/* 7-Player Double Elimination: Upper Bye Selector */}
        {isDE && playerCount === 7 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1E2128] border border-white/10 rounded-[28px] p-5 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#F5BA38] bg-[#F5BA38]/10 px-2.5 py-1 rounded-full border border-[#F5BA38]/30 inline-flex items-center gap-1">
                  <span>🎟️</span>
                  <span>Upper Bracket Bye</span>
                </span>
                <p className="text-[11px] text-[#8E95A5] mt-1.5 font-medium leading-tight">
                  Select which player advances directly to the Upper Semifinals:
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {activePlayers.map((player) => {
                const isSelected = selectedByeId === player.id;
                const isLowest = player.id === lowestPlayerId;
                const playerByes = byeCounts[player.id] ?? 0;
                const isLeastByes = player.id === minByesPlayerId;

                return (
                  <div
                    key={player.id}
                    onClick={() => handleByeSelect(player.id)}
                    className={`cursor-pointer rounded-2xl p-3 border transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-[#F5BA38]/15 border-2 border-[#F5BA38] shadow-sm"
                        : "bg-[#181B22] border-white/5 hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#14161B] border border-white/10 flex-shrink-0 flex items-center justify-center">
                        <AvatarSVG avatar={player.avatar} size={40} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-black text-[#F3F4EE] truncate">
                            {player.name}
                          </span>
                          {isLowest && (
                            <span className="text-[9px] font-black bg-[#FF5E48]/20 text-[#FF5E48] px-2 py-0.5 rounded-full border border-[#FF5E48]/30">
                              🥄 Season Spoon
                            </span>
                          )}
                          {isLeastByes && !isLowest && (
                            <span className="text-[9px] font-black bg-[#6C79E0]/20 text-[#9EAAFF] px-2 py-0.5 rounded-full border border-[#6C79E0]/30">
                              🎯 Least Byes ({playerByes})
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8E95A5] mt-0.5 font-medium">
                          Byes received: <strong className="text-[#F3F4EE]">{playerByes}</strong>
                          {" · "}
                          Season pts: <strong className="text-[#F3F4EE]">{totalPointsMap[player.id] ?? 0}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <div
                        className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-[#F5BA38] border-[#F5BA38] text-[#14161B]"
                            : "border-white/20 bg-transparent"
                        }`}
                      >
                        {isSelected && <span className="font-black text-xs">✓</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-[#8E95A5] pt-1 leading-relaxed">
              💡 <strong>Tip:</strong> The player with the Season Wooden Spoon is pre-selected by default to balance tournament competition, but you can choose any player.
            </p>
          </motion.div>
        )}

        {/* Double Elimination Match Rules & Scoring Steppers */}
        {isDE ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1E2128] border border-white/10 rounded-[28px] p-5 shadow-sm space-y-1"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#FF5E48] bg-[#FF5E48]/10 px-2.5 py-1 rounded-full border border-[#FF5E48]/20 inline-flex items-center gap-1">
                <span>🏸</span>
                <span>Match Score Rules</span>
              </span>
              <span className="text-[10px] text-[#8E95A5] font-mono font-medium">Editable</span>
            </div>

            <Stepper
              label="Bracket win score"
              hint="Score needed to win Upper & Lower bracket matches"
              value={cfg.winScore}
              onChange={(v) => update("winScore", v)}
              min={3}
              max={21}
            />

            <Stepper
              label="Grand Final win score"
              hint="Score needed to win the Championship Final"
              value={cfg.finalWinScore}
              onChange={(v) => update("finalWinScore", v)}
              min={3}
              max={21}
            />

            <Stepper
              label="Decider / Qualifier win score"
              hint="Score needed in 3-man mini round-robin or 3-point decider"
              value={cfg.deciderWinScore ?? 3}
              onChange={(v) => update("deciderWinScore", v)}
              min={2}
              max={11}
            />

            <Stepper
              label="Shutout penalty margin"
              hint={`Margin in Lower Final & Grand Final that triggers -1 Day Point penalty (e.g. ${cfg.winScore}-${cfg.winScore - cfg.bonusMargin} or worse)`}
              value={cfg.bonusMargin}
              onChange={(v) => {
                update("bonusMargin", v);
                update("finalBonusMargin", v);
              }}
              min={1}
              max={Math.min(cfg.winScore - 1, cfg.finalWinScore - 1)}
            />
          </motion.div>
        ) : (
          /* Round-robin rules card */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1E2128] border border-white/10 rounded-[28px] p-5 shadow-sm space-y-1"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#FF5E48] bg-[#FF5E48]/10 px-2.5 py-1 rounded-full border border-[#FF5E48]/20 inline-flex items-center gap-1">
                <span>🏸</span>
                <span>Round-Robin Rules</span>
              </span>
              <span className="text-[10px] text-[#8E95A5] font-mono font-medium">Stage 1</span>
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
        )}

        {/* Round-robin Points Preview Card (Only in RR mode) */}
        {!isDE && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-[#181B22] border border-white/5 rounded-[26px] p-4.5 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <p className="text-[#8E95A5] text-[10px] uppercase tracking-wider font-black">
                📊 Points Preview (Round-Robin)
              </p>
              <span className="text-[10px] text-[#FF5E48] font-bold">First to {cfg.winScore}</span>
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
                        ? "bg-[#F5BA38]/15 border-[#F5BA38]/30"
                        : "bg-[#1E2128] border-white/5"
                    }`}
                  >
                    <span className="text-[#8E95A5] font-mono font-bold text-xs">
                      {cfg.winScore}–{loserScore}
                    </span>
                    <span
                      className={`font-black text-xs ${
                        hasBonus ? "text-[#F5BA38]" : "text-[#F3F4EE]"
                      }`}
                    >
                      {pts} pts {hasBonus ? "⭐" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Final rules card (Only in RR mode) */}
        {!isDE && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#1E2128] border border-white/10 rounded-[28px] p-5 shadow-sm space-y-1"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#F5BA38] bg-[#F5BA38]/10 px-2.5 py-1 rounded-full border border-[#F5BA38]/30 inline-flex items-center gap-1">
                <span>🏆</span>
                <span>Final Match Rules</span>
              </span>
              <span className="text-[10px] text-[#8E95A5] font-mono font-medium">Championship</span>
            </div>

            <Stepper
              label="Final win score"
              hint="First player to reach this score wins the championship final"
              value={cfg.finalWinScore}
              onChange={(v) => update("finalWinScore", v)}
              min={3}
              max={21}
            />
            <Stepper
              label="Blowout penalty margin"
              hint={`Loser receives a -1 Day Point penalty if winner's margin ≥ this value (e.g. ${cfg.finalWinScore}–${cfg.finalWinScore - cfg.finalBonusMargin} or worse)`}
              value={cfg.finalBonusMargin}
              onChange={(v) => update("finalBonusMargin", v)}
              min={1}
              max={cfg.finalWinScore - 1}
            />
          </motion.div>
        )}

        {/* Day Points breakdown card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#181B22] border border-white/5 rounded-[26px] p-4.5 space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#F5BA38] text-[10px] uppercase tracking-wider font-black">
                🏆 Day Points Breakdown ({playerCount} Players · {isDE ? "Double Elimination" : "Round Robin"})
              </p>
              <p className="text-[#8E95A5] text-[11px] mt-0.5 leading-tight">
                {isDE
                  ? "Points awarded strictly by final bracket positions & placement matches."
                  : "Points awarded based on final match margin."}
              </p>
            </div>
            <span className="text-[10px] text-[#F5BA38] font-bold">
              GF: First to {cfg.finalWinScore}
            </span>
          </div>

          {isDE ? (
            <div className="space-y-1.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#1E2128] rounded-xl px-3 py-2 border border-white/5 flex justify-between items-center">
                  <span className="text-[#8E95A5] font-bold text-[11px]">1st Place</span>
                  <strong className="text-[#9EC9A8] font-black">{playerCount} pts</strong>
                </div>
                <div className="bg-[#1E2128] rounded-xl px-3 py-2 border border-white/5 flex justify-between items-center">
                  <span className="text-[#8E95A5] font-bold text-[11px]">2nd Place</span>
                  <span className="text-[#F3F4EE] font-black">
                    {playerCount - 1} pts <span className="text-[#FF5E48] text-[10px]">({playerCount - 2} shut)</span>
                  </span>
                </div>
                <div className="bg-[#1E2128] rounded-xl px-3 py-2 border border-white/5 flex justify-between items-center">
                  <span className="text-[#8E95A5] font-bold text-[11px]">3rd Place</span>
                  <span className="text-[#F3F4EE] font-black">
                    {playerCount - 2} pts <span className="text-[#FF5E48] text-[10px]">({playerCount - 3} shut)</span>
                  </span>
                </div>
                <div className="bg-[#1E2128] rounded-xl px-3 py-2 border border-white/5 flex justify-between items-center">
                  <span className="text-[#8E95A5] font-bold text-[11px]">4th Place</span>
                  <strong className="text-[#F3F4EE] font-black">{playerCount - 3} pts</strong>
                </div>
                <div className="bg-[#1E2128] rounded-xl px-3 py-2 border border-white/5 flex justify-between items-center">
                  <span className="text-[#8E95A5] font-bold text-[11px]">5th Place</span>
                  <strong className="text-[#F3F4EE] font-black">{playerCount - 4} pts</strong>
                </div>
                <div className="bg-[#1E2128] rounded-xl px-3 py-2 border border-white/5 flex justify-between items-center">
                  <span className="text-[#8E95A5] font-bold text-[11px]">6th Place</span>
                  <strong className="text-[#F3F4EE] font-black">{playerCount - 5} pts</strong>
                </div>
                <div className="bg-[#1E2128] rounded-xl px-3 py-2 border border-white/5 flex justify-between items-center">
                  <span className="text-[#8E95A5] font-bold text-[11px]">7th Place</span>
                  <strong className="text-[#F3F4EE] font-black">{playerCount - 6} pts</strong>
                </div>
                {playerCount === 8 && (
                  <div className="bg-[#1E2128] rounded-xl px-3 py-2 border border-white/5 flex justify-between items-center">
                    <span className="text-[#8E95A5] font-bold text-[11px]">8th Place</span>
                    <strong className="text-[#FF5E48] font-black">1 pt</strong>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-[#8E95A5] pt-1 leading-relaxed">
                🚨 <strong>Shutout rules:</strong> Normal bracket matches have no penalty. Only the <strong>Lower Final</strong> and <strong>Grand Final</strong> apply the -1 Day Point penalty when losing by margin &ge; {cfg.bonusMargin}.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center bg-[#1E2128] rounded-xl px-3 py-2 border border-white/5">
                <span className="text-[#8E95A5] font-mono font-bold text-[11px]">
                  Margin &ge; {cfg.finalBonusMargin} (Blowout)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[#F3F4EE] font-bold text-[11px]">
                    1st: <strong className="text-[#9EC9A8] font-black">{playerCount} pts</strong>
                  </span>
                  <span className="text-white/20">·</span>
                  <span className="text-[#F3F4EE] font-bold text-[11px]">
                    2nd: <strong className="text-[#FF5E48] font-black">{Math.max(1, playerCount - 2)} pts 🚨</strong>
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center bg-[#1E2128] rounded-xl px-3 py-2 border border-white/5">
                <span className="text-[#8E95A5] font-mono font-bold text-[11px]">
                  Margin &lt; {cfg.finalBonusMargin} (Close)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[#F3F4EE] font-bold text-[11px]">
                    1st: <strong className="text-[#9EC9A8] font-black">{playerCount} pts</strong>
                  </span>
                  <span className="text-white/20">·</span>
                  <span className="text-[#F3F4EE] font-bold text-[11px]">
                    2nd: <strong className="text-[#F3F4EE] font-black">{Math.max(1, playerCount - 1)} pts</strong>
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-[#8E95A5] pt-1 leading-relaxed">
                💡 <strong>Rest of the table:</strong> 3rd place gets {Math.max(1, playerCount - 2)} pts, 4th gets {Math.max(1, Math.max(0, playerCount - 3))} pts, down to 1 pt for last place.
              </p>
            </div>
          )}
        </motion.div>

        {/* Practice / Test Mode Toggle Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => setCfg((c) => ({ ...c, isPractice: !c.isPractice }))}
          className={`cursor-pointer border rounded-[28px] p-4.5 transition-all flex items-center justify-between gap-3 shadow-sm ${
            cfg.isPractice
              ? "bg-[#F5BA38]/15 border-2 border-[#F5BA38]"
              : "bg-[#1E2128] border border-white/10 hover:border-white/20"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl ${
                cfg.isPractice ? "bg-[#F5BA38] text-[#14161B]" : "bg-white/10 text-[#8E95A5]"
              }`}
            >
              🧪
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-[#F3F4EE]">Practice / Test Mode</span>
                {cfg.isPractice && (
                  <span className="text-[10px] bg-[#F5BA38] text-[#14161B] font-black px-2 py-0.5 rounded-full">
                    TESTING
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8E95A5] mt-0.5 font-medium leading-tight">
                {cfg.isPractice
                  ? "Test match active: won't be saved to permanent history or leaderboards."
                  : "Ranked match: will be saved to Day Table & permanent Leaderboards."}
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <div
            className={`w-12 h-6 rounded-full transition-colors p-0.5 flex items-center flex-shrink-0 ${
              cfg.isPractice ? "bg-[#FF5E48] justify-end" : "bg-white/20 justify-start"
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
      <div className="sticky bottom-0 p-5 bg-gradient-to-t from-[#14161B] via-[#14161B]/95 to-transparent pt-3 z-30">
        <motion.button
          onClick={() => {
            const finalConfig: TournamentConfig = {
              ...cfg,
              format: selectedFormat,
              upperByePlayerId:
                selectedFormat === "double-elimination" && playerCount === 7
                  ? selectedByeId
                  : undefined,
            };
            onConfirm(finalConfig);
          }}
          whileTap={{ scale: 0.98 }}
          className={`w-full py-4 rounded-full font-black text-white text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${
            cfg.isPractice
              ? "bg-[#F5BA38] text-[#14161B] shadow-[0_10px_25px_rgba(245,186,56,0.3)]"
              : "bg-[#FF5E48] hover:bg-[#fa6249] shadow-[0_10px_25px_rgba(255,94,72,0.35)]"
          }`}
        >
          <span>
            {cfg.isPractice
              ? `Start Practice ${isDE ? "Bracket" : "Tournament"} 🧪`
              : `Start Ranked ${isDE ? "Double Elimination" : "Tournament"} 🏸`}
          </span>
          <span>&rarr;</span>
        </motion.button>
      </div>
    </div>
  );
}
