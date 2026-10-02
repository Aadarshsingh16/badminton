"use client";
// components/SyncStatusBadge.tsx — Subtle non-intrusive cloud sync indicator with quick actions

import React, { useEffect, useState } from "react";
import { apiSync } from "@/lib/apiSync";
import { motion, AnimatePresence } from "framer-motion";

export function SyncStatusBadge() {
  const [status, setStatus] = useState({
    isSyncing: false,
    pendingCount: 0,
    error: false,
  });
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const unsubscribe = apiSync.subscribe(setStatus);
    return () => unsubscribe();
  }, []);

  return (
    <>
      {status.isSyncing ? (
        <div className="flex items-center gap-1.5 bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
          <span>Syncing...</span>
        </div>
      ) : status.pendingCount > 0 ? (
        <button
          onClick={() => setShowMenu(true)}
          className="flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all active:scale-95"
          title="Click to manage sync queue"
        >
          <span>⚡</span>
          <span>{status.pendingCount} queued</span>
        </button>
      ) : (
        <div className="flex items-center gap-1 text-white/30 text-[10px] font-medium px-1">
          <span className="text-green-400/80">✓</span>
          <span>Cloud synced</span>
        </div>
      )}

      {/* Sync Queue Manager Modal */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-6 top-1/2 -translate-y-1/2 z-50 max-w-xs mx-auto bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">⚡</span>
                  <h4 className="text-white font-bold text-sm">Offline Sync Queue</h4>
                </div>
                <span className="text-xs font-mono text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                  {status.pendingCount} items
                </span>
              </div>

              <p className="text-[11px] text-white/50 leading-relaxed">
                Pending updates saved on this device. If the server is waking up or you have old test requests stuck, you can sync immediately or clear them.
              </p>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => {
                    apiSync.forceSyncAll();
                    setShowMenu(false);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <span>↻</span>
                  <span>Sync All Now</span>
                </button>

                <button
                  onClick={() => {
                    apiSync.clearQueue();
                    setShowMenu(false);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/70 hover:text-red-300 border border-white/10 hover:border-red-500/30 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <span>🧹</span>
                  <span>Clear Stuck Queue</span>
                </button>

                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full py-1.5 text-center text-white/40 hover:text-white/60 text-[11px] font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
