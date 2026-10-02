"use client";
// components/SyncStatusBadge.tsx — Subtle non-intrusive cloud sync indicator

import React, { useEffect, useState } from "react";
import { apiSync } from "@/lib/apiSync";

export function SyncStatusBadge() {
  const [status, setStatus] = useState({
    isSyncing: false,
    pendingCount: 0,
    error: false,
  });

  useEffect(() => {
    const unsubscribe = apiSync.subscribe(setStatus);
    return () => unsubscribe();
  }, []);

  if (status.isSyncing) {
    return (
      <div className="flex items-center gap-1.5 bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
        <span>Syncing...</span>
      </div>
    );
  }

  if (status.pendingCount > 0) {
    return (
      <div className="flex items-center gap-1 bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">
        <span>⚡</span>
        <span>{status.pendingCount} queued</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-white/30 text-[10px] font-medium px-1">
      <span className="text-green-400/80">✓</span>
      <span>Cloud synced</span>
    </div>
  );
}
