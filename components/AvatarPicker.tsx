"use client";
// components/AvatarPicker.tsx — Modal to pick emoji + color for custom players

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EMOJI_OPTIONS = ["🏸", "🎾", "🏆", "⚡", "🔥", "💪", "🌟", "🦅", "🐉", "🎯", "🚀", "🦁", "🐺", "🦊", "🐯"];
const COLOR_OPTIONS = [
  "#6C63FF", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FECA57", "#FF9FF3", "#54A0FF", "#5F27CD", "#FF6348",
  "#2ED573", "#FFA502", "#747D8C", "#A29BFE", "#FD79A8",
];

interface AvatarPickerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (emoji: string, color: string, name: string) => void;
}

export function AvatarPicker({ open, onClose, onConfirm }: AvatarPickerProps) {
  const [selectedEmoji, setSelectedEmoji] = useState("🏸");
  const [selectedColor, setSelectedColor] = useState("#6C63FF");
  const [name, setName] = useState("");

  const handleConfirm = () => {
    if (!name.trim()) return;
    onConfirm(selectedEmoji, selectedColor, name.trim());
    setName("");
    setSelectedEmoji("🏸");
    setSelectedColor("#6C63FF");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm mx-auto shadow-2xl"
          >
            <h3 className="text-white font-bold text-lg mb-4 text-center">Add New Player</h3>

            {/* Preview */}
            <div
              className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center text-4xl border-4 border-white/10"
              style={{ backgroundColor: `${selectedColor}30` }}
            >
              {selectedEmoji}
            </div>

            {/* Name input */}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player name..."
              maxLength={16}
              className="w-full bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-purple-400 text-sm"
            />

            {/* Emoji picker */}
            <p className="text-white/50 text-xs mb-2 uppercase tracking-wider">Choose Emoji</p>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => setSelectedEmoji(e)}
                  className={`w-full aspect-square rounded-xl text-2xl flex items-center justify-center transition-all ${
                    selectedEmoji === e
                      ? "bg-white/20 scale-110 ring-2 ring-white/40"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>

            {/* Color picker */}
            <p className="text-white/50 text-xs mb-2 uppercase tracking-wider">Choose Color</p>
            <div className="grid grid-cols-5 gap-2 mb-6">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  className={`w-full aspect-square rounded-xl transition-all ${
                    selectedColor === c ? "scale-110 ring-2 ring-white" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white/70 font-medium hover:bg-white/15 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!name.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: selectedColor }}
              >
                Add Player
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
