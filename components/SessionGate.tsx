"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { useStore, getLocalDateString } from "@/lib/store";
import { apiSync } from "@/lib/apiSync";

export function SessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { appRole, setAppSession } = useStore();
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());

  // Allow spectators to view live pages without session gate
  if (pathname?.startsWith("/live")) return <>{children}</>;
  
  // If session is established, render normal app
  if (appRole) return <>{children}</>;

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

      if (res.ok) {
        apiSync.setPin(trimmed);
        setAppSession("admin", selectedDate);
        setShowPinModal(false);
      } else {
        // As requested: if password is wrong, fallback to viewer page automatically
        setAppSession("viewer", selectedDate);
        setShowPinModal(false);
      }
    } catch (err) {
      setError("Failed to connect to server.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F7F9FD] p-6 z-50">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl border border-slate-100 flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900 mb-2">Welcome</h1>
          <p className="text-sm text-slate-500 font-medium">Please select your session details.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
            Session Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex flex-col gap-3 mt-2">
          <button
            onClick={() => setAppSession("viewer", selectedDate)}
            className="w-full py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-sm transition-all"
          >
            Enter as Viewer
          </button>
          <button
            onClick={() => setShowPinModal(true)}
            className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all"
          >
            Enter as Admin
          </button>
        </div>
      </div>

      {showPinModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-[320px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-900 text-center mb-1">Admin Access</h3>
            <p className="text-xs font-medium text-slate-500 text-center mb-6">
              Enter the scorekeeper PIN.
            </p>

            <form onSubmit={handleAdminVerify} className="flex flex-col gap-4">
              <input
                type="password"
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-center text-lg font-black tracking-widest text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                autoFocus
              />
              
              {error && (
                <p className="text-xs font-bold text-red-500 text-center bg-red-50 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-extrabold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || !pin.trim()}
                  className="flex-1 py-3 rounded-full bg-slate-950 hover:bg-black disabled:bg-slate-500 text-white text-xs font-extrabold shadow-md active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                  {isVerifying ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Verify"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
