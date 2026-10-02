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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-sm bg-white border border-slate-200/80 rounded-[30px] p-6 shadow-2xl space-y-4 text-slate-900"
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-xl text-slate-800 shadow-xs">
                🔒
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Scorekeeper PIN</h2>
                <p className="text-[11px] text-slate-400 font-medium">One-time host access for this device</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Enter the scorekeeper PIN to record scores and sync tournaments. This PIN is stored securely in your browser&apos;s local storage.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-950 focus:ring-1 focus:ring-slate-950 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none pr-10 font-mono tracking-wider transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
                  >
                    {showPin ? "🙈" : "👁️"}
                  </button>
                </div>
                {error && <p className="text-[11px] text-red-500 mt-1.5 font-bold">{error}</p>}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-full bg-slate-950 hover:bg-black text-white text-xs font-extrabold shadow-md active:scale-95 transition-all"
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
