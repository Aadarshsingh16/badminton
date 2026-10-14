"use client";
// components/MatchCard.tsx — Fixture card with score display + tap to enter/edit score

import React from "react";
import { motion } from "framer-motion";
import { Match, Player } from "@/lib/types";
import { AvatarSVG } from "./avatars/AvatarSVG";

interface MatchCardProps {
  match: Match;
  playerA: Player;
  playerB: Player;
  byePlayer?: Player | null;
  isUpNext: boolean;
  index: number;
  onTap: (match: Match) => void;
  readOnly?: boolean;
}

export function MatchCard({ match, playerA, playerB, isUpNext, index, onTap, readOnly = false }: MatchCardProps) {
  const played = match.played;
  const winnerIsA = played && match.scoreA !== undefined && match.scoreB !== undefined && match.scoreA > match.scoreB;
  const winnerIsB = played && match.scoreA !== undefined && match.scoreB !== undefined && match.scoreB > match.scoreA;

  return (
    <motion.div
      layout
      layoutId={`match-${match.id}`}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      onClick={() => {
        if (!readOnly) onTap(match);
      }}
      className={`relative mb-3 rounded-[28px] transition-all overflow-hidden ${
        readOnly ? "cursor-default" : "cursor-pointer active:scale-[0.99]"
      } ${
        played
          ? "bg-[#1E2128] border border-white/10 shadow-sm"
          : isUpNext
          ? "bg-[#252833] border-2 border-[#FF5E48] shadow-[0_12px_28px_rgba(255,94,72,0.2)]"
          : "bg-[#1A1D23] border border-white/5 opacity-80"
      }`}
    >
      {/* Top Banner Row */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#8E95A5]">
            Match #{index + 1}
          </span>
          {isUpNext && !played && (
            <span className="bg-[#FF5E48] text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>Up Next</span>
            </span>
          )}
        </div>

        {/* Edit badge on played matches */}
        {played && !readOnly && (
          <div className="bg-white/10 hover:bg-white/15 text-[#F3F4EE] text-[10px] font-black px-2.5 py-0.5 rounded-full border border-white/10 transition-colors">
            Tap to Edit ↗
          </div>
        )}
      </div>

      {/* Main Players & Score Grid */}
      <div className="flex items-center px-4 pb-3.5 pt-1 gap-2">
        {/* Player A */}
        <div className={`flex-1 flex flex-col items-center gap-1.5 ${played && !winnerIsA ? "opacity-50" : ""}`}>
          <div className="relative">
            <AvatarSVG
              type={playerA.avatar}
              size={played ? 42 : 48}
              emoji={playerA.avatarEmoji}
              color={playerA.avatarColor}
            />
            {played && winnerIsA && (
              <span className="absolute -top-1.5 -right-1 text-xs">👑</span>
            )}
          </div>
          <p className={`text-xs font-black text-center truncate w-full ${winnerIsA ? "text-[#F5BA38]" : "text-[#F3F4EE]"}`}>
            {playerA.name}
          </p>
          {played && match.scoreA !== undefined && (
            <div className={`text-3xl font-black tabular-nums ${winnerIsA ? "text-[#F5BA38]" : "text-[#8E95A5]"}`}>
              {match.scoreA}
            </div>
          )}
          {played && match.pointsAwarded && (
            <div className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
              (match.pointsAwarded[playerA.id] ?? 0) >= 2
                ? "bg-[#9EC9A8]/20 text-[#A8DAB3] border-[#9EC9A8]/30"
                : (match.pointsAwarded[playerA.id] ?? 0) < 0
                ? "bg-[#FF5E48]/20 text-[#FF8E7E] border-[#FF5E48]/30"
                : "bg-white/5 text-[#8E95A5] border-white/10"
            }`}>
              {(match.pointsAwarded[playerA.id] ?? 0) > 0 ? "+" : ""}{match.pointsAwarded[playerA.id] ?? 0} pts
            </div>
          )}
        </div>

        {/* Center Divider / Action */}
        <div className="flex flex-col items-center gap-1 px-2">
          {played ? (
            <span className="text-[#8E95A5] text-xl font-black">–</span>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[#8E95A5] text-xs font-black">VS</span>
              {!readOnly && (
                <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                  isUpNext
                    ? "bg-[#FF5E48] text-white shadow-md shadow-[#FF5E48]/30"
                    : "bg-white/10 text-[#F3F4EE]"
                }`}>
                  <span>Score</span>
                  <span>↗</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Player B */}
        <div className={`flex-1 flex flex-col items-center gap-1.5 ${played && !winnerIsB ? "opacity-50" : ""}`}>
          <div className="relative">
            <AvatarSVG
              type={playerB.avatar}
              size={played ? 42 : 48}
              emoji={playerB.avatarEmoji}
              color={playerB.avatarColor}
            />
            {played && winnerIsB && (
              <span className="absolute -top-1.5 -right-1 text-xs">👑</span>
            )}
          </div>
          <p className={`text-xs font-black text-center truncate w-full ${winnerIsB ? "text-[#F5BA38]" : "text-[#F3F4EE]"}`}>
            {playerB.name}
          </p>
          {played && match.scoreB !== undefined && (
            <div className={`text-3xl font-black tabular-nums ${winnerIsB ? "text-[#F5BA38]" : "text-[#8E95A5]"}`}>
              {match.scoreB}
            </div>
          )}
          {played && match.pointsAwarded && (
            <div className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
              (match.pointsAwarded[playerB.id] ?? 0) >= 2
                ? "bg-[#9EC9A8]/20 text-[#A8DAB3] border-[#9EC9A8]/30"
                : (match.pointsAwarded[playerB.id] ?? 0) < 0
                ? "bg-[#FF5E48]/20 text-[#FF8E7E] border-[#FF5E48]/30"
                : "bg-white/5 text-[#8E95A5] border-white/10"
            }`}>
              {(match.pointsAwarded[playerB.id] ?? 0) > 0 ? "+" : ""}{match.pointsAwarded[playerB.id] ?? 0} pts
            </div>
          )}
        </div>
      </div>

      {/* Court sides row */}
      {!played && (
        <div className="flex justify-center items-center gap-2 py-2 bg-black/20 border-t border-white/5 text-[10px] text-[#8E95A5] font-bold">
          <span>SIDE {match.courtSide[playerA.id]}: {playerA.name.toUpperCase()}</span>
          <span>•</span>
          <span>SIDE {match.courtSide[playerB.id]}: {playerB.name.toUpperCase()}</span>
        </div>
      )}
    </motion.div>
  );
}
