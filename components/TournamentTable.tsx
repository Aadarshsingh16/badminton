"use client";
// components/TournamentTable.tsx — Live tournament standings with animated row resorting

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TournamentRow, Player } from "@/lib/types";
import { AvatarSVG } from "./avatars/AvatarSVG";

interface TournamentTableProps {
  rows: TournamentRow[];
  players: Player[];
  finalistIds?: [string, string];
  showFinalLabel?: boolean;
}

const RANK_COLORS = ["#FFD166", "#A8DADC", "#FF6B35", "#9B9B9B"];
const RANK_LABELS = ["🥇", "🥈", "🥉", "4th", "5th", "6th", "7th"];

export function TournamentTable({ rows, players, finalistIds, showFinalLabel }: TournamentTableProps) {
  const getPlayer = (id: string) => players.find((p) => p.id === id);

  return (
    <div className="px-4 pb-4">
      {showFinalLabel && (
        <div className="text-center mb-3">
          <span className="text-xs bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full font-medium">
            ⭐ Final results included
          </span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center px-3 py-2 mb-1">
        <span className="text-white/30 text-xs w-6 text-center">#</span>
        <span className="text-white/30 text-xs flex-1 pl-2">Player</span>
        <span className="text-white/30 text-xs w-8 text-center">MP</span>
        <span className="text-white/30 text-xs w-8 text-center">W</span>
        <span className="text-white/30 text-xs w-10 text-center">+/-</span>
        <span className="text-white/30 text-xs w-10 text-center font-bold">PTS</span>
      </div>

      <AnimatePresence>
        {rows.map((row, idx) => {
          const player = getPlayer(row.playerId);
          if (!player) return null;
          const isFinalist = finalistIds?.includes(row.playerId);
          const rankColor = RANK_COLORS[idx] ?? "#9B9B9B";

          return (
            <motion.div
              key={row.playerId}
              layout
              layoutId={`table-row-${row.playerId}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className={`flex items-center px-3 py-3 mb-2 rounded-xl border ${
                isFinalist
                  ? "bg-yellow-500/10 border-yellow-500/30"
                  : "bg-white/5 border-white/5"
              }`}
            >
              {/* Rank */}
              <div className="w-6 text-center">
                <span className="text-sm font-bold" style={{ color: rankColor }}>
                  {RANK_LABELS[idx] ?? `${idx + 1}`}
                </span>
              </div>

              {/* Avatar + Name */}
              <div className="flex items-center gap-2 flex-1 pl-1 min-w-0">
                <AvatarSVG
                  type={player.avatar}
                  size={32}
                  emoji={player.avatarEmoji}
                  color={player.avatarColor}
                />
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{player.name}</p>
                  {isFinalist && (
                    <p className="text-yellow-400 text-xs">Finalist</p>
                  )}
                </div>
              </div>

              {/* Matches played */}
              <span className="text-white/50 text-sm w-8 text-center">{row.matchesPlayed}</span>

              {/* Wins */}
              <span className="text-white/50 text-sm w-8 text-center">{row.wins}</span>

              {/* Point diff */}
              <span className={`text-sm w-10 text-center font-medium ${
                row.pointDiff > 0 ? "text-green-400" : row.pointDiff < 0 ? "text-red-400" : "text-white/40"
              }`}>
                {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
              </span>

              {/* Points */}
              <motion.span
                key={row.points}
                initial={{ scale: 1.2, color: "#FFD166" }}
                animate={{ scale: 1, color: "#ffffff" }}
                transition={{ duration: 0.3 }}
                className="text-base font-black w-10 text-center tabular-nums text-white"
              >
                {row.points}
              </motion.span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
