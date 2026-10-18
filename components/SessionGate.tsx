"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, getLocalDateString, isSessionExpired } from "@/lib/store";
import { apiSync } from "@/lib/apiSync";

export function SessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { appRole, appDate, sessionCreatedAt, setAppSession, clearAppSession } = useStore();

  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => appDate || getLocalDateString());

  // Proactive periodic expiration check (every 30 seconds)
  useEffect(() => {
    const checkExpiration = () => {
      const state = useStore.getState();
      if (state.appRole && isSessionExpired(state.sessionCreatedAt)) {
        clearAppSession();
      }
    };
    checkExpiration();
    const interval = setInterval(checkExpiration, 30 * 1000);
    return () => clearInterval(interval);
  }, [clearAppSession]);

  // Keep selectedDate in sync if appDate changes
  useEffect(() => {
    if (appDate) {
      setSelectedDate(appDate);
    }
  }, [appDate]);

  // Allow spectators to view live pages without session gate
  if (pathname?.startsWith("/live")) return <>{children}</>;

  // If session is active and valid (not expired), render normal app
  const isValidSession = Boolean(appRole && !isSessionExpired(sessionCreatedAt));
  if (isValidSession) return <>{children}</>;

  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError("");

    try {
      const trimmed = pin.trim();
      const res = await fetch(`${apiSync.getBackendUrl()}/auth/verify`, {
        method: "POST",
        headers: { "x-scorekeeper-pin": trimmed },
      });

      if (res.ok || res.status === 404) {
        apiSync.setPin(trimmed);
        setAppSession("admin", selectedDate);
        setShowPinModal(false);
      } else if (res.status === 401) {
        setError("Invalid PIN. Scorekeeper access denied.");
      } else {
        apiSync.setPin(trimmed);
        setAppSession("admin", selectedDate);
        setShowPinModal(false);
      }
    } catch {
      apiSync.setPin(pin.trim());
      setAppSession("admin", selectedDate);
      setShowPinModal(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleViewerEnter = () => {
    setAppSession("viewer", selectedDate);
    router.push("/day");
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#14161B] text-[#F3F4EE] p-5 z-50 overflow-y-auto">
      {/* Background ambient accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] bg-[#F5BA38]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-[#FF5E48]/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        className="w-full max-w-sm bg-[#1E2128] border border-white/10 rounded-[32px] p-7 shadow-[0_25px_60px_rgba(0,0,0,0.6)] flex flex-col gap-6 relative z-10 backdrop-blur-xl"
      >
        {/* Header with Badminton Slab */}
        <div className="text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[#16181F] border border-white/10 flex items-center justify-center text-2xl shadow-inner mb-3.5">
            🏸
          </div>
          <h1 className="text-xl font-black uppercase tracking-tight text-[#F3F4EE]">
            Badminton Club
          </h1>
          <p className="text-xs text-[#8E95A5] font-semibold tracking-wide mt-1">
            Select session date & choose your access mode
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-black uppercase tracking-wider text-[#8E95A5] pl-1 flex items-center gap-1.5">
            <span>📅</span>
            <span>Session Date</span>
          </label>
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-[#16181F] border border-white/10 rounded-2xl px-4 py-3.5 text-sm font-bold text-[#F3F4EE] outline-none focus:border-[#F5BA38] focus:ring-2 focus:ring-[#F5BA38]/20 transition-all cursor-pointer"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-1">
          <button
            onClick={() => setShowPinModal(true)}
            className="w-full py-4 rounded-2xl bg-[#FF5E48] hover:bg-[#fa6249] active:scale-[0.98] text-white font-black text-xs uppercase tracking-widest shadow-[0_10px_25px_rgba(255,94,72,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>👑</span>
            <span>Enter as Admin</span>
          </button>

          <button
            onClick={handleViewerEnter}
            className="w-full py-3.5 rounded-2xl bg-[#16181F] hover:bg-[#252932] active:scale-[0.98] border border-white/10 text-[#F3F4EE] font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>👀</span>
            <span>Enter as Viewer</span>
          </button>
        </div>

        {/* TTL note */}
        <p className="text-[10px] text-center text-[#8E95A5] font-bold uppercase tracking-wider">
          Sessions expire automatically every 5–6 hours
        </p>
      </motion.div>

      {/* Admin PIN Verification Modal */}
      <AnimatePresence>
        {showPinModal && (
          <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#1E2128] border border-white/10 rounded-[30px] w-full max-w-[340px] p-6 shadow-[0_30px_70px_rgba(0,0,0,0.8)]"
            >
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-2xl bg-[#16181F] border border-white/10 mx-auto flex items-center justify-center text-xl mb-3">
                  🔑
                </div>
                <h3 className="text-base font-black text-[#F3F4EE] uppercase tracking-tight">
                  Scorekeeper PIN
                </h3>
                <p className="text-xs text-[#8E95A5] font-medium mt-1">
                  Enter your admin PIN for {selectedDate}
                </p>
              </div>

              <form onSubmit={handleAdminVerify} className="flex flex-col gap-4">
                <input
                  type="password"
                  placeholder="Enter PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-[#16181F] border border-white/10 rounded-2xl px-4 py-3.5 text-center text-lg font-black tracking-widest text-[#F3F4EE] outline-none focus:border-[#FF5E48] focus:ring-2 focus:ring-[#FF5E48]/20 transition-all placeholder:text-[#8E95A5]/40"
                  autoFocus
                />

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-1.5"
                  >
                    <p className="text-xs font-bold text-[#FF5E48] text-center bg-[#FF5E48]/10 border border-[#FF5E48]/20 py-2 px-3 rounded-xl">
                      {error}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPinModal(false);
                        handleViewerEnter();
                      }}
                      className="text-[11px] font-black uppercase text-[#F5BA38] hover:underline text-center mt-1"
                    >
                      Continue as Viewer instead ↗
                    </button>
                  </motion.div>
                )}

                <div className="flex gap-2.5 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPinModal(false);
                      setError("");
                    }}
                    className="flex-1 py-3 rounded-full bg-[#16181F] hover:bg-[#252932] border border-white/10 text-[#8E95A5] hover:text-[#F3F4EE] text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifying || !pin.trim()}
                    className="flex-1 py-3 rounded-full bg-[#FF5E48] hover:bg-[#fa6249] disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider shadow-md active:scale-95 transition-all flex justify-center items-center gap-2 cursor-pointer"
                  >
                    {isVerifying ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Unlock ↗"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
