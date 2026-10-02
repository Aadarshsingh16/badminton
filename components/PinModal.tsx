"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiSync } from "@/lib/apiSync";

interface PinModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isInvalid?: boolean;
}

export function PinModal({ open, onClose, onSuccess, isInvalid = false }: PinModalProps) {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState(isInvalid ? "Incorrect PIN. Please re-enter." : "");

  useEffect(() => {
    if (open) {
      setPin(apiSync.getPin());
      setError(isInvalid ? "Incorrect PIN. Please re-enter." : "");
    }
  }, [open, isInvalid]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = pin.trim();
    if (!trimmed) {
      setError("PIN cannot be empty");
      return;
    }

    apiSync.setPin(trimmed);
    setError("");
    onClose();
    if (onSuccess) onSuccess();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-sm bg-slate-900 border border-purple-500/30 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-xl text-purple-300">
                🔒
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Scorekeeper PIN</h2>
                <p className="text-[11px] text-gray-400">One-time access for this device</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Enter the scorekeeper PIN to record scores and sync tournaments. This PIN is stored securely in your browser&apos;s local storage and never exposed to spectators.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <div className="relative">
                  <input
                    type={showPin ? "text" : "password"}
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="Enter scorekeeper PIN..."
                    autoFocus
                    className="w-full bg-slate-950 border border-white/20 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none pr-10 tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-xs"
                  >
                    {showPin ? "🙈" : "👁️"}
                  </button>
                </div>
                {error && <p className="text-[11px] text-red-400 mt-1.5 font-medium">{error}</p>}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all"
                >
                  Save PIN
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
