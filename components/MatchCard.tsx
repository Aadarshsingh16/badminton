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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      onClick={() => onTap(match)}
      className={`relative mb-3.5 rounded-[26px] border transition-all cursor-pointer ${
        played
          ? "bg-white border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-slate-300"
          : isUpNext
          ? "bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-white border-2 border-indigo-300 shadow-md shadow-indigo-100/50 hover:shadow-lg"
          : "bg-white border-slate-200/80 shadow-2xs hover:border-slate-300 hover:shadow-xs"
      }`}
    >
      {/* Up Next badge */}
      {isUpNext && !played && (
        <div className="absolute -top-2.5 left-5 bg-slate-950 text-white text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Up Next</span>
        </div>
      )}

      {/* Edit badge on played matches */}
      {played && (
        <div className="absolute -top-2.5 right-4 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
          ✏️ tap to edit
        </div>
      )}

      {/* Match number label */}
      <div className={`text-center text-[11px] font-extrabold pt-3.5 pb-1 ${isUpNext && !played ? "text-indigo-600" : "text-slate-400"}`}>
        Match {index + 1}
      </div>

      <div className="flex items-center px-4 pb-3.5 gap-2">
        {/* Player A */}
        <div className={`flex-1 flex flex-col items-center gap-1.5 ${played && winnerIsA ? "opacity-100" : played ? "opacity-45" : ""}`}>
          <div className="relative">
            <AvatarSVG
              type={playerA.avatar}
              size={played ? 40 : 48}
              emoji={playerA.avatarEmoji}
              color={playerA.avatarColor}
            />
            {played && winnerIsA && (
              <span className="absolute -top-1 -right-1 text-xs">👑</span>
            )}
          </div>
          <p className={`text-xs font-black text-center truncate w-full ${winnerIsA ? "text-slate-900" : "text-slate-700"}`}>
            {playerA.name}
          </p>
          {played && match.scoreA !== undefined && (
            <div className={`text-2xl font-black tabular-nums ${winnerIsA ? "text-slate-900 font-black" : "text-slate-400"}`}>
              {match.scoreA}
            </div>
          )}
          {played && match.pointsAwarded && (
            <div className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
              (match.pointsAwarded[playerA.id] ?? 0) >= 2
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : (match.pointsAwarded[playerA.id] ?? 0) < 0
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
            }`}>
              {(match.pointsAwarded[playerA.id] ?? 0) > 0 ? "+" : ""}{match.pointsAwarded[playerA.id] ?? 0} pts
            </div>
          )}
        </div>

        {/* VS / Score separator */}
        <div className="flex flex-col items-center gap-1 px-2">
          {played ? (
            <span className="text-slate-300 text-base font-black">–</span>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-slate-300 text-sm font-black">VS</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isUpNext ? "bg-indigo-600 text-white shadow-2xs" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                Score
              </span>
            </div>
          )}
        </div>

        {/* Player B */}
        <div className={`flex-1 flex flex-col items-center gap-1.5 ${played && winnerIsB ? "opacity-100" : played ? "opacity-45" : ""}`}>
          <div className="relative">
            <AvatarSVG
              type={playerB.avatar}
              size={played ? 40 : 48}
              emoji={playerB.avatarEmoji}
              color={playerB.avatarColor}
            />
            {played && winnerIsB && (
              <span className="absolute -top-1 -right-1 text-xs">👑</span>
            )}
          </div>
          <p className={`text-xs font-black text-center truncate w-full ${winnerIsB ? "text-slate-900" : "text-slate-700"}`}>
            {playerB.name}
          </p>
          {played && match.scoreB !== undefined && (
            <div className={`text-2xl font-black tabular-nums ${winnerIsB ? "text-slate-900 font-black" : "text-slate-400"}`}>
              {match.scoreB}
            </div>
          )}
          {played && match.pointsAwarded && (
            <div className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
              (match.pointsAwarded[playerB.id] ?? 0) >= 2
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : (match.pointsAwarded[playerB.id] ?? 0) < 0
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
            }`}>
              {(match.pointsAwarded[playerB.id] ?? 0) > 0 ? "+" : ""}{match.pointsAwarded[playerB.id] ?? 0} pts
            </div>
          )}
        </div>
      </div>

      {/* Court sides (only on unplayed) */}
      {!played && (
        <div className="flex justify-center gap-3 pb-3 text-[11px] text-slate-400 font-medium">
          <span>Side {match.courtSide[playerA.id]}: {playerA.name}</span>
          <span>•</span>
          <span>Side {match.courtSide[playerB.id]}: {playerB.name}</span>
        </div>
      )}
    </motion.div>
  );
}
