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
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white border border-slate-200/80 rounded-[32px] p-6 max-w-sm mx-auto shadow-2xl text-slate-900"
          >
            <h3 className="text-slate-900 font-extrabold text-lg mb-4 text-center">Add New Player</h3>

            {/* Preview */}
            <div
              className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center text-4xl border-4 border-slate-100 shadow-sm"
              style={{ backgroundColor: `${selectedColor}25` }}
            >
              {selectedEmoji}
            </div>

            {/* Name input */}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
              placeholder="Player name..."
              maxLength={16}
              className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 rounded-2xl px-4 py-3 mb-4 focus:outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950 text-sm font-semibold transition-all"
            />

            {/* Emoji picker */}
            <p className="text-slate-400 text-xs mb-2 font-bold uppercase tracking-wider">Choose Emoji</p>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => setSelectedEmoji(e)}
                  className={`w-full aspect-square rounded-2xl text-2xl flex items-center justify-center transition-all ${
                    selectedEmoji === e
                      ? "bg-slate-100 scale-110 ring-2 ring-slate-950 shadow-xs"
                      : "bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>

            {/* Color picker */}
            <p className="text-slate-400 text-xs mb-2 font-bold uppercase tracking-wider">Choose Color</p>
            <div className="grid grid-cols-5 gap-2 mb-6">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  className={`w-full aspect-square rounded-2xl transition-all ${
                    selectedColor === c ? "scale-110 ring-2 ring-slate-950 shadow-xs" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 rounded-full bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!name.trim()}
                className="flex-1 py-3.5 rounded-full font-extrabold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed text-xs shadow-md active:scale-95"
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
