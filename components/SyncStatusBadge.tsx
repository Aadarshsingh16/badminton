"use client";
// components/SyncStatusBadge.tsx — Cloud sync indicator with deep recovery & restore

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
  const [syncProgress, setSyncProgress] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = apiSync.subscribe(setStatus);
    return () => unsubscribe();
  }, []);

  const handleSyncAll = async () => {
    setSyncProgress("Recovering local data...");
    const st = useStore.getState();
    const allPlayers = st.players;

    // Deep recovery: pull from ALL localStorage sources, ignoring tombstones
    const allTournaments = apiSync.recoverAllTournamentsFromStorage();
    const total = allTournaments.length;

    if (total === 0) {
      setSyncProgress("No tournaments found in local storage.");
      setTimeout(() => setSyncProgress(null), 3000);
      return;
    }

    setSyncProgress(`Found ${total} tournaments. Syncing...`);

    let synced = 0;
    let failed = 0;
    for (const t of allTournaments) {
      setSyncProgress(`Syncing ${synced + 1}/${total}...`);
      try {
        const ok = await apiSync.syncTournamentDirectly(t, allPlayers);
        if (ok) {
          synced++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    // Also flush any remaining queue items
    apiSync.forceSyncAll();

    const msg = failed > 0
      ? `Done: ${synced}/${total} synced, ${failed} failed`
      : `✓ All ${synced} tournaments synced!`;
    setSyncProgress(msg);
    setTimeout(() => {
      setSyncProgress(null);
      setShowMenu(false);
    }, 3000);
  };

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
        <button
          onClick={() => setShowMenu(true)}
          className="flex items-center gap-1 text-slate-400 text-[10px] font-bold px-1 hover:text-slate-600 transition-colors"
        >
          <span className="text-emerald-600">✓</span>
          <span>Cloud synced</span>
        </button>
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
              onClick={() => { if (!syncProgress) setShowMenu(false); }}
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
                  <h4 className="text-slate-900 font-black text-sm">Cloud Sync</h4>
                </div>
                <span className="text-xs font-mono font-bold text-amber-900 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300">
                  {status.pendingCount} queued
                </span>
              </div>

              {syncProgress && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-3 py-2.5 text-xs text-indigo-800 font-bold flex items-center gap-2">
                  {syncProgress.startsWith("✓") ? (
                    <span className="text-emerald-600 text-sm">✅</span>
                  ) : syncProgress.includes("failed") ? (
                    <span className="text-rose-500 text-sm">⚠️</span>
                  ) : (
                    <span className="w-3.5 h-3.5 border-2 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin flex-shrink-0" />
                  )}
                  <span>{syncProgress}</span>
                </div>
              )}

              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Restore & Sync deeply recovers <strong>all</strong> tournaments from this device&apos;s local storage and pushes them to the cloud database.
              </p>

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleSyncAll}
                  disabled={!!syncProgress && !syncProgress.startsWith("✓") && !syncProgress.includes("failed") && !syncProgress.includes("No tournaments")}
                  className="w-full py-2.5 px-3 rounded-full bg-slate-950 hover:bg-slate-800 disabled:bg-slate-400 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <span>🔄</span>
                  <span>Restore & Sync All</span>
                </button>

                <button
                  onClick={() => {
                    apiSync.clearQueue();
                    setSyncProgress(null);
                    setShowMenu(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <span>🧹</span>
                  <span>Clear Stuck Queue</span>
                </button>

                <button
                  onClick={() => { if (!syncProgress) setShowMenu(false); }}
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
