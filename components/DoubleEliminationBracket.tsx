"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Tournament, Player, Match } from "@/lib/types";
import { AvatarSVG } from "./avatars/AvatarSVG";
import { getMatchShortform } from "@/lib/fixtures";

interface DoubleEliminationBracketProps {
  tournament: Tournament;
  players: Player[];
  onSelectMatch?: (matchId: string) => void;
  readOnly?: boolean;
}

export function DoubleEliminationBracket({
  tournament,
  players,
  onSelectMatch,
  readOnly = false,
}: DoubleEliminationBracketProps) {
  const [activeSection, setActiveSection] = useState<"all" | "upper" | "lower">("all");

  const upperScrollRef = useRef<HTMLDivElement>(null);
  const lowerScrollRef = useRef<HTMLDivElement>(null);

  // Reset scroll to the beginning (Quarterfinals / Round 1) whenever tournament or section switches
  useEffect(() => {
    if (upperScrollRef.current) {
      upperScrollRef.current.scrollLeft = 0;
    }
    if (lowerScrollRef.current) {
      lowerScrollRef.current.scrollLeft = 0;
    }
  }, [activeSection, tournament.id]);

  const count = tournament.playerIds.length;
  const is7P = count === 7;
  const matches = tournament.matches;
  const config = tournament.config;
  const upperByeId = config?.upperByePlayerId || tournament.byes?.[1] || null;

  const getPlayer = (id?: string | null): Player | null => {
    if (!id) return null;
    return players.find((p) => p.id === id) || { id, name: id, avatar: "custom" as any };
  };

  const findMatch = (id: string): Match | undefined => matches.find((m) => m.id === id);

  // Upper matches
  const uq1 = findMatch("de-uq-1");
  const uq2 = findMatch("de-uq-2");
  const uq3 = findMatch("de-uq-3");
  const uq4 = findMatch("de-uq-4");
  const us1 = findMatch("de-us-1");
  const us2 = findMatch("de-us-2");
  const uf = findMatch("de-uf");
  const gf = findMatch("de-gf") || tournament.final;

  // Lower matches
  const qDecider = findMatch("de-q-decider");
  const qrr1 = findMatch("de-q-rr-1");
  const qrr2 = findMatch("de-q-rr-2");
  const qrr3 = findMatch("de-q-rr-3");
  const lr1 = findMatch("de-lr1") || findMatch("de-lr1-1");
  const lr1_2 = findMatch("de-lr1-2");
  const lr2_1 = findMatch("de-lr2-1");
  const lr2_2 = findMatch("de-lr2-2");
  const lr3 = findMatch("de-lr3");
  const lf = findMatch("de-lf");

  // Placement matches
  const p78 = findMatch("de-p78");
  const p56 = findMatch("de-p56");

  // Step scroll helpers (column width + gap is approx 235px)
  const scrollUpperTo = (colIndex: number) => {
    if (upperScrollRef.current) {
      upperScrollRef.current.scrollTo({ left: colIndex * 235, behavior: "smooth" });
    }
  };

  const stepUpper = (direction: -1 | 1) => {
    if (upperScrollRef.current) {
      upperScrollRef.current.scrollBy({ left: direction * 235, behavior: "smooth" });
    }
  };

  const scrollLowerTo = (colIndex: number) => {
    if (lowerScrollRef.current) {
      lowerScrollRef.current.scrollTo({ left: colIndex * 235, behavior: "smooth" });
    }
  };

  const stepLower = (direction: -1 | 1) => {
    if (lowerScrollRef.current) {
      lowerScrollRef.current.scrollBy({ left: direction * 235, behavior: "smooth" });
    }
  };

  // Renders an individual match node card
  const renderMatchNode = (
    match: Match | undefined,
    defaultLabel: string,
    fallbackA?: string,
    fallbackB?: string,
    isGrandFinal?: boolean
  ) => {
    if (!match) {
      return (
        <div className="w-[195px] xs:w-[215px] sm:w-[230px] shrink-0 bg-[#181B22]/60 border border-dashed border-white/10 rounded-2xl p-3 select-none">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#8E95A5]">
              {defaultLabel}
            </span>
            <span className="text-[9px] font-bold text-white/30 uppercase">Waiting</span>
          </div>
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs text-[#8E95A5]/60 italic py-1 px-2 rounded-lg bg-black/10">
              <span className="truncate">{fallbackA || "TBD"}</span>
              <span className="font-mono">—</span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#8E95A5]/60 italic py-1 px-2 rounded-lg bg-black/10">
              <span className="truncate">{fallbackB || "TBD"}</span>
              <span className="font-mono">—</span>
            </div>
          </div>
        </div>
      );
    }

    const played = !!match.played;
    const pA = getPlayer(match.playerA);
    const pB = getPlayer(match.playerB);
    const scoreA = match.scoreA;
    const scoreB = match.scoreB;
    const winnerIsA = played && scoreA !== undefined && scoreB !== undefined && scoreA > scoreB;
    const winnerIsB = played && scoreA !== undefined && scoreB !== undefined && scoreB > scoreA;

    const shortform = getMatchShortform(match);
    const targetScore = match.targetScore || (isGrandFinal ? config?.finalWinScore || 6 : config?.winScore || 5);

    const isReadyToPlay = !played && !!pA && !!pB;

    return (
      <motion.div
        whileHover={!readOnly && isReadyToPlay ? { y: -2, scale: 1.01 } : {}}
        onClick={() => {
          if (!readOnly && onSelectMatch) {
            onSelectMatch(match.id);
          }
        }}
        className={`w-[195px] xs:w-[215px] sm:w-[230px] shrink-0 rounded-2xl p-3 border transition-all ${
          isGrandFinal
            ? "bg-gradient-to-br from-[#1E2128] via-[#1A1D24] to-[#F5BA38]/10 border-[#F5BA38]/40 shadow-lg"
            : played
            ? "bg-[#1E2128] border-white/10 shadow-xs"
            : isReadyToPlay
            ? "bg-[#1E2128] border-[#FF5E48]/50 shadow-md ring-1 ring-[#FF5E48]/30 cursor-pointer"
            : "bg-[#181B22]/70 border-white/5 opacity-80"
        }`}
      >
        {/* Match Header with Shortform Badge */}
        <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                isGrandFinal
                  ? "bg-[#F5BA38] text-[#14161B]"
                  : match.bracket === "upper"
                  ? "bg-[#9EC9A8]/20 text-[#9EC9A8]"
                  : match.bracket === "lower"
                  ? "bg-[#F5BA38]/20 text-[#F5BA38]"
                  : "bg-[#6C79E0]/20 text-[#6C79E0]"
              }`}
            >
              {shortform}
            </span>
            <span className="text-[10px] font-bold text-[#8E95A5] truncate">
              {defaultLabel}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {played ? (
              <span className="text-[9px] font-black text-[#9EC9A8] bg-[#9EC9A8]/10 px-1.5 py-0.2 rounded-full">
                Final
              </span>
            ) : isReadyToPlay ? (
              <span className="text-[9px] font-black text-[#FF5E48] bg-[#FF5E48]/15 px-1.5 py-0.2 rounded-full animate-pulse">
                Ready
              </span>
            ) : (
              <span className="text-[9px] font-medium text-white/30">
                To {targetScore}
              </span>
            )}
          </div>
        </div>

        {/* Players & Scores */}
        <div className="space-y-1.5 pt-2">
          {/* Player A */}
          <div
            className={`flex items-center justify-between py-1 px-2 rounded-xl transition-colors ${
              winnerIsA
                ? "bg-[#9EC9A8]/15 text-[#F3F4EE] font-black"
                : played
                ? "text-[#8E95A5] opacity-60"
                : "text-[#F3F4EE]"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {pA ? (
                <AvatarSVG
                  type={pA.avatar}
                  size={20}
                  emoji={pA.avatarEmoji}
                  color={pA.avatarColor}
                  className="flex-shrink-0"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-white/10 flex-shrink-0" />
              )}
              <span className="text-xs truncate font-bold">
                {pA?.name || fallbackA || "TBD"}
              </span>
              {winnerIsA && <span className="text-xs flex-shrink-0">👑</span>}
            </div>
            <span
              className={`font-black text-sm tabular-nums ml-2 ${
                winnerIsA ? "text-[#9EC9A8]" : "text-[#8E95A5]"
              }`}
            >
              {scoreA !== undefined ? scoreA : "—"}
            </span>
          </div>

          {/* Player B */}
          <div
            className={`flex items-center justify-between py-1 px-2 rounded-xl transition-colors ${
              winnerIsB
                ? "bg-[#9EC9A8]/15 text-[#F3F4EE] font-black"
                : played
                ? "text-[#8E95A5] opacity-60"
                : "text-[#F3F4EE]"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {pB ? (
                <AvatarSVG
                  type={pB.avatar}
                  size={20}
                  emoji={pB.avatarEmoji}
                  color={pB.avatarColor}
                  className="flex-shrink-0"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-white/10 flex-shrink-0" />
              )}
              <span className="text-xs truncate font-bold">
                {pB?.name || fallbackB || "TBD"}
              </span>
              {winnerIsB && <span className="text-xs flex-shrink-0">👑</span>}
            </div>
            <span
              className={`font-black text-sm tabular-nums ml-2 ${
                winnerIsB ? "text-[#9EC9A8]" : "text-[#8E95A5]"
              }`}
            >
              {scoreB !== undefined ? scoreB : "—"}
            </span>
          </div>
        </div>
      </motion.div>
    );
  };

  // Bye Slot component
  const renderByeSlot = (player: Player | null, label: string, note: string) => {
    return (
      <div className="w-[195px] xs:w-[215px] sm:w-[230px] shrink-0 bg-[#F5BA38]/10 border border-[#F5BA38]/30 rounded-2xl p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-1 border-b border-[#F5BA38]/20">
          <span className="text-[9px] font-black uppercase text-[#F5BA38] bg-[#F5BA38]/20 px-1.5 py-0.5 rounded">
            {label}
          </span>
          <span className="text-[9px] text-[#F5BA38] font-bold">DIRECT ADVANCE</span>
        </div>
        <div className="flex items-center gap-2 py-2">
          {player ? (
            <AvatarSVG
              type={player.avatar}
              size={24}
              emoji={player.avatarEmoji}
              color={player.avatarColor}
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-white/10" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-black text-[#F3F4EE] truncate">
              {player ? player.name : "Bye Player"}
            </p>
            <p className="text-[10px] text-[#F5BA38] font-medium truncate">{note}</p>
          </div>
        </div>
      </div>
    );
  };

  // Horizontal flow connectors
  const renderConnector = (height: number = 60) => (
    <div className="shrink-0 flex items-center justify-center px-1 text-[#8E95A5]/40 select-none">
      <svg width="18" height={height} viewBox={`0 0 18 ${height}`} fill="none" className="overflow-visible">
        <path
          d={`M 0 ${height / 2} H 18`}
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="3 3"
        />
      </svg>
    </div>
  );

  return (
    <div className="space-y-4 pb-12">
      {/* Header with Stats & View Toggle */}
      <div className="px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#181B22] p-4 rounded-3xl border border-white/10 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-[#FF5E48] bg-[#FF5E48]/15 px-2.5 py-1 rounded-full">
              ⚔️ Double Elimination
            </span>
            <span className="text-xs font-bold text-[#8E95A5]">
              {is7P ? "7-Player Bracket" : "8-Player Bracket"}
            </span>
          </div>
          <p className="text-xs text-[#8E95A5] mt-1 font-medium">
            Upper Bracket winners advance to Grand Final · Lower Bracket gives a second chance
          </p>
        </div>

        {/* Section View Pills */}
        <div className="flex bg-[#14161B] p-1 rounded-full border border-white/10 text-xs font-black self-start sm:self-auto">
          {(
            [
              { id: "all", label: "Full Tree" },
              { id: "upper", label: "Upper 👑" },
              { id: "lower", label: "Lower ⚡" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveSection(t.id)}
              className={`py-1.5 px-3 rounded-full transition-all cursor-pointer ${
                activeSection === t.id
                  ? "bg-[#F3F4EE] text-[#14161B] shadow-xs"
                  : "text-[#8E95A5] hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 1: UPPER BRACKET (WINNERS)                             */}
      {/* ============================================================== */}
      {(activeSection === "all" || activeSection === "upper") && (
        <div className="space-y-3 bg-[#14161B]/80 p-4 sm:p-5 rounded-3xl border border-white/5 shadow-md">
          {/* Header Row & Quick Jump Stepper */}
          <div className="flex flex-col gap-2.5 border-b border-white/5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">👑</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#9EC9A8]">
                  Upper Bracket (Winners Flow)
                </h3>
              </div>
              <span className="text-[10px] text-[#8E95A5] font-mono">
                1 Loss = Drop to Lower
              </span>
            </div>

            {/* Jump-to-Round Stepper */}
            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {[
                  { label: "Quarters", icon: "⚔️" },
                  { label: "Semis", icon: "🛡️" },
                  { label: "Upper Final", icon: "👑" },
                  { label: "Grand Final", icon: "🏆" },
                ].map((item, idx) => (
                  <button
                    key={item.label}
                    onClick={() => scrollUpperTo(idx)}
                    className="py-1 px-2.5 rounded-lg bg-[#181B22] hover:bg-white/10 border border-white/5 text-[10px] font-black text-[#8E95A5] hover:text-white flex items-center gap-1 shrink-0 cursor-pointer transition-all active:scale-95"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Arrow Steps */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => stepUpper(-1)}
                  title="Previous round"
                  className="w-7 h-7 rounded-lg bg-[#181B22] hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center text-sm font-bold border border-white/5 cursor-pointer active:scale-95"
                >
                  ‹
                </button>
                <button
                  onClick={() => stepUpper(1)}
                  title="Next round"
                  className="w-7 h-7 rounded-lg bg-[#181B22] hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center text-sm font-bold border border-white/5 cursor-pointer active:scale-95"
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          {/* Smooth Horizontal Snap Scroll Area */}
          <div
            ref={upperScrollRef}
            className="overflow-x-auto scroll-smooth snap-x snap-mandatory pb-3 pt-1 select-none flex items-start gap-2.5"
          >
            {/* Column 1: Upper Quarterfinals */}
            <div className="snap-start shrink-0 space-y-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#8E95A5] pl-1">
                Quarterfinals
              </div>
              <div className="space-y-3">
                {renderMatchNode(uq1, "UQF1", "Player 1", "Player 3")}
                {renderMatchNode(uq2, "UQF2", "Player 2", "Player 4")}
                {renderMatchNode(uq3, "UQF3", "Player 5", "Player 6")}
                {is7P ? (
                  renderByeSlot(
                    getPlayer(upperByeId),
                    "Upper Bye",
                    "Advances directly to Semifinal 2"
                  )
                ) : (
                  renderMatchNode(uq4, "UQF4", "Player 7", "Player 8")
                )}
              </div>
            </div>

            {renderConnector(260)}

            {/* Column 2: Upper Semifinals */}
            <div className="snap-start shrink-0 space-y-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#8E95A5] pl-1">
                Semifinals
              </div>
              <div className="space-y-16 pt-6">
                {renderMatchNode(us1, "US1", "Winner UQF1", "Winner UQF2")}
                {renderMatchNode(
                  us2,
                  "US2",
                  "Winner UQF3",
                  is7P ? getPlayer(upperByeId)?.name || "Bye Player" : "Winner UQF4"
                )}
              </div>
            </div>

            {renderConnector(260)}

            {/* Column 3: Upper Final */}
            <div className="snap-start shrink-0 space-y-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#8E95A5] pl-1">
                Upper Final
              </div>
              <div className="pt-24">
                {renderMatchNode(uf, "Upper Final", "Winner US1", "Winner US2")}
              </div>
            </div>

            {renderConnector(260)}

            {/* Column 4: Grand Championship Final */}
            <div className="snap-start shrink-0 space-y-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#F5BA38] pl-1 flex items-center gap-1">
                <span>🏆</span>
                <span>Grand Final</span>
              </div>
              <div className="pt-24">
                {renderMatchNode(
                  gf,
                  "Grand Final",
                  "Upper Champion",
                  "Lower Champion",
                  true
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 2: LOWER BRACKET (ELIMINATION)                         */}
      {/* ============================================================== */}
      {(activeSection === "all" || activeSection === "lower") && (
        <div className="space-y-3 bg-[#14161B]/80 p-4 sm:p-5 rounded-3xl border border-white/5 shadow-md">
          {/* Header Row & Quick Jump Stepper */}
          <div className="flex flex-col gap-2.5 border-b border-white/5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">⚡</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#F5BA38]">
                  Lower Bracket (Knockout Flow)
                </h3>
              </div>
              <span className="text-[10px] text-[#8E95A5] font-mono">
                1 Loss = Eliminated
              </span>
            </div>

            {/* Jump-to-Round Stepper */}
            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {[
                  { label: is7P ? "LR1 & Decider" : "Round 1", icon: "⚡" },
                  { label: "Round 2", icon: "🥊" },
                  { label: "Round 3", icon: "🔥" },
                  { label: "Lower Final", icon: "🎯" },
                ].map((item, idx) => (
                  <button
                    key={item.label}
                    onClick={() => scrollLowerTo(idx)}
                    className="py-1 px-2.5 rounded-lg bg-[#181B22] hover:bg-white/10 border border-white/5 text-[10px] font-black text-[#8E95A5] hover:text-white flex items-center gap-1 shrink-0 cursor-pointer transition-all active:scale-95"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Arrow Steps */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => stepLower(-1)}
                  title="Previous round"
                  className="w-7 h-7 rounded-lg bg-[#181B22] hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center text-sm font-bold border border-white/5 cursor-pointer active:scale-95"
                >
                  ‹
                </button>
                <button
                  onClick={() => stepLower(1)}
                  title="Next round"
                  className="w-7 h-7 rounded-lg bg-[#181B22] hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center text-sm font-bold border border-white/5 cursor-pointer active:scale-95"
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          {/* Smooth Horizontal Snap Scroll Area */}
          <div
            ref={lowerScrollRef}
            className="overflow-x-auto scroll-smooth snap-x snap-mandatory pb-3 pt-1 select-none flex items-start gap-2.5"
          >
            {/* Column 1: Lower Round 1 / Qualifiers */}
            <div className="snap-start shrink-0 space-y-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#8E95A5] pl-1">
                {is7P ? "Lower Round 1 & Decider" : "Lower Round 1"}
              </div>
              <div className="space-y-3">
                {renderMatchNode(lr1, "LR1", "UQF Loser A", "UQF Loser B")}

                {/* Show Decider or Mini-RR if 7-player */}
                {is7P && qDecider && (
                  <div className="space-y-1">
                    <div className="text-[9px] font-black uppercase text-[#8E95A5] pl-1">
                      3-Point Bye Decider
                    </div>
                    {renderMatchNode(qDecider, "Q-DEC", "Non-Shutout 1", "Non-Shutout 2")}
                  </div>
                )}

                {is7P && (qrr1 || qrr2 || qrr3) && (
                  <div className="space-y-1">
                    <div className="text-[9px] font-black uppercase text-[#8E95A5] pl-1">
                      3-Man Mini RR (To 3)
                    </div>
                    {qrr1 && renderMatchNode(qrr1, "QRR1", "Loser A", "Loser B")}
                    {qrr2 && renderMatchNode(qrr2, "QRR2", "Loser B", "Loser C")}
                    {qrr3 && renderMatchNode(qrr3, "QRR3", "Loser C", "Loser A")}
                  </div>
                )}

                {!is7P && lr1_2 && renderMatchNode(lr1_2, "LR1 (Match 2)", "Loser UQF3", "Loser UQF4")}
              </div>
            </div>

            {renderConnector(240)}

            {/* Column 2: Lower Round 2 */}
            <div className="snap-start shrink-0 space-y-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#8E95A5] pl-1">
                Lower Round 2
              </div>
              <div className="space-y-8 pt-4">
                {renderMatchNode(lr2_1, "LR2 (Match 1)", "Winner LR1", "Loser US1")}
                {renderMatchNode(lr2_2, "LR2 (Match 2)", is7P ? "LR2 Bye Player" : "Winner LR1.2", "Loser US2")}
              </div>
            </div>

            {renderConnector(240)}

            {/* Column 3: Lower Round 3 */}
            <div className="snap-start shrink-0 space-y-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#8E95A5] pl-1">
                Lower Round 3
              </div>
              <div className="pt-16">
                {renderMatchNode(lr3, "LR3", "Winner LR2.1", "Winner LR2.2")}
              </div>
            </div>

            {renderConnector(240)}

            {/* Column 4: Lower Final */}
            <div className="snap-start shrink-0 space-y-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#FF5E48] pl-1 flex items-center gap-1">
                <span>🔥</span>
                <span>Lower Final</span>
              </div>
              <div className="pt-16">
                {renderMatchNode(lf, "Lower Final", "Loser Upper Final", "Winner LR3")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 3: PLACEMENT MATCHES (FOR 8 PLAYERS)                   */}
      {/* ============================================================== */}
      {!is7P && (p56 || p78) && (
        <div className="space-y-3 bg-[#14161B]/80 p-4 sm:p-5 rounded-3xl border border-white/5 shadow-md">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
            <span className="text-sm">🎯</span>
            <h3 className="text-xs font-black uppercase tracking-wider text-blue-400">
              Placement Deciders (Rank Allocation)
            </h3>
          </div>
          <div className="flex items-center gap-6 overflow-x-auto pb-2">
            {p56 && (
              <div className="space-y-2 shrink-0">
                <span className="text-[10px] font-black uppercase text-[#8E95A5]">
                  5th / 6th Place Match
                </span>
                {renderMatchNode(p56, "P56", "Loser LR2.1", "Loser LR2.2")}
              </div>
            )}
            {p78 && (
              <div className="space-y-2 shrink-0">
                <span className="text-[10px] font-black uppercase text-[#8E95A5]">
                  7th / 8th Place Match
                </span>
                {renderMatchNode(p78, "P78", "Loser LR1.1", "Loser LR1.2")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
