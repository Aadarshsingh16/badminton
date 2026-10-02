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
}

export function MatchCard({ match, playerA, playerB, isUpNext, index, onTap }: MatchCardProps) {
  const played = match.played;
  const winnerIsA = played && match.scoreA !== undefined && match.scoreB !== undefined && match.scoreA > match.scoreB;
  const winnerIsB = played && match.scoreA !== undefined && match.scoreB !== undefined && match.scoreB > match.scoreA;

  return (
    <motion.div
      layout
      layoutId={`match-${match.id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      onClick={() => onTap(match)}
      className={`relative mb-3 rounded-2xl border transition-all cursor-pointer ${
        played
          ? "bg-white/5 border-white/5 opacity-80 hover:opacity-100 hover:border-orange-400/30 hover:bg-orange-500/5"
          : isUpNext
          ? "bg-gradient-to-br from-purple-900/60 to-blue-900/60 border-purple-500/50 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20"
          : "bg-white/5 border-white/10 hover:bg-white/8"
      }`}
    >
      {/* Up Next badge */}
      {isUpNext && !played && (
        <div className="absolute -top-2 left-4 bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          Up Next
        </div>
      )}

      {/* Edit badge on played matches */}
      {played && (
        <div className="absolute -top-2 right-4 bg-slate-700 text-white/50 text-[10px] font-medium px-2 py-0.5 rounded-full">
          ✏️ tap to edit
        </div>
      )}

      {/* Round label */}
      <div className={`text-center text-xs font-medium pt-3 pb-1 ${isUpNext && !played ? "text-purple-300" : "text-white/30"}`}>
        Round {match.round + 1}
      </div>

      <div className="flex items-center px-4 pb-3 gap-2">
        {/* Player A */}
        <div className={`flex-1 flex flex-col items-center gap-1 ${played && winnerIsA ? "opacity-100" : played ? "opacity-50" : ""}`}>
          <AvatarSVG
            type={playerA.avatar}
            size={played ? 36 : 44}
            emoji={playerA.avatarEmoji}
            color={playerA.avatarColor}
          />
          <p className={`text-xs font-semibold text-center truncate w-full ${winnerIsA ? "text-white" : "text-white/70"}`}>
            {playerA.name}
          </p>
          {played && match.scoreA !== undefined && (
            <div className={`text-xl font-black tabular-nums ${winnerIsA ? "text-white" : "text-white/40"}`}>
              {match.scoreA}
            </div>
          )}
          {played && match.pointsAwarded && (
            <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              (match.pointsAwarded[playerA.id] ?? 0) >= 2
                ? "bg-green-500/20 text-green-400"
                : (match.pointsAwarded[playerA.id] ?? 0) < 0
                ? "bg-red-500/20 text-red-400"
                : "bg-white/10 text-white/40"
            }`}>
              {(match.pointsAwarded[playerA.id] ?? 0) > 0 ? "+" : ""}{match.pointsAwarded[playerA.id] ?? 0} pts
            </div>
          )}
        </div>

        {/* VS / Score separator */}
        <div className="flex flex-col items-center gap-1 px-2">
          {played ? (
            <span className="text-white/20 text-sm font-bold">–</span>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-white/30 text-sm font-bold">VS</span>
              <span className="text-purple-400 text-xs">Tap to score</span>
            </div>
          )}
        </div>

        {/* Player B */}
        <div className={`flex-1 flex flex-col items-center gap-1 ${played && winnerIsB ? "opacity-100" : played ? "opacity-50" : ""}`}>
          <AvatarSVG
            type={playerB.avatar}
            size={played ? 36 : 44}
            emoji={playerB.avatarEmoji}
            color={playerB.avatarColor}
          />
          <p className={`text-xs font-semibold text-center truncate w-full ${winnerIsB ? "text-white" : "text-white/70"}`}>
            {playerB.name}
          </p>
          {played && match.scoreB !== undefined && (
            <div className={`text-xl font-black tabular-nums ${winnerIsB ? "text-white" : "text-white/40"}`}>
              {match.scoreB}
            </div>
          )}
          {played && match.pointsAwarded && (
            <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              (match.pointsAwarded[playerB.id] ?? 0) >= 2
                ? "bg-green-500/20 text-green-400"
                : (match.pointsAwarded[playerB.id] ?? 0) < 0
                ? "bg-red-500/20 text-red-400"
                : "bg-white/10 text-white/40"
            }`}>
              {(match.pointsAwarded[playerB.id] ?? 0) > 0 ? "+" : ""}{match.pointsAwarded[playerB.id] ?? 0} pts
            </div>
          )}
        </div>
      </div>

      {/* Court sides (only on unplayed) */}
      {!played && (
        <div className="flex justify-center gap-4 pb-2 text-xs text-white/30">
          <span>Side {match.courtSide[playerA.id]}: {playerA.name}</span>
          <span>•</span>
          <span>Side {match.courtSide[playerB.id]}: {playerB.name}</span>
        </div>
      )}
    </motion.div>
  );
}
