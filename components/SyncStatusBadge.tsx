"use client";
// components/SyncStatusBadge.tsx — Subtle non-intrusive cloud sync indicator with quick actions

import React, { useEffect, useState } from "react";
import { apiSync } from "@/lib/apiSync";
import { useStore } from "@/lib/store";
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
          className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full transition-all active:scale-95 shadow-2xs"
          title="Click to manage sync queue"
        >
          <span>⚡</span>
          <span>{status.pendingCount} queued</span>
        </button>
      ) : (
        <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold px-1">
          <span className="text-emerald-600">✓</span>
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
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50"
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-6 top-1/2 -translate-y-1/2 z-50 max-w-xs mx-auto bg-white border border-slate-200/80 rounded-[28px] p-5 shadow-2xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500">⚡</span>
                  <h4 className="text-slate-900 font-black text-sm">Offline Sync Queue</h4>
                </div>
                <span className="text-xs font-mono font-bold text-amber-900 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300">
                  {status.pendingCount} items
                </span>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Pending updates saved on this device. If the server is waking up or you have old test requests stuck, you can sync immediately or clear them.
              </p>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => {
                    const st = useStore.getState();
                    if (st.currentTournament && !st.currentTournament.isPractice) {
                      apiSync.syncTournamentDirectly(st.currentTournament, st.players);
                    }
                    apiSync.forceSyncAll();
                    setShowMenu(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <span>↻</span>
                  <span>Sync All Now</span>
                </button>

                <button
                  onClick={() => {
                    apiSync.clearQueue();
                    setShowMenu(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <span>🧹</span>
                  <span>Clear Stuck Queue</span>
                </button>

                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full py-1 text-center text-slate-400 hover:text-slate-600 text-[11px] font-bold transition-colors"
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
