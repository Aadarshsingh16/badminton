"use client";
// components/ShareModal.tsx — Shareable live link + QR code modal

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { apiSync } from "@/lib/apiSync";
import { useStore } from "@/lib/store";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  slug?: string;
  date?: string;
}

export function ShareModal({ open, onClose, slug, date }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [shareMode, setShareMode] = useState<"day" | "tournament">("day");
  const [isCloudSynced, setIsCloudSynced] = useState(false);

  const state = useStore();
  const effectiveDate = date || (slug && /^\d{4}-\d{2}-\d{2}$/.test(slug) ? slug : (state.dayTable.date || new Date().toISOString().slice(0, 10)));
  const tournamentSlug = slug && !/^\d{4}-\d{2}-\d{2}$/.test(slug) ? slug : (state.currentTournament?.shareSlug || state.currentTournament?.id || "");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const dayShareUrl = `${origin}/live/${effectiveDate}`;
  const tourneyShareUrl = tournamentSlug ? `${origin}/live/${tournamentSlug}` : dayShareUrl;

  const currentUrl = shareMode === "day" ? dayShareUrl : tourneyShareUrl;

  useEffect(() => {
    if (open) {
      const currentState = useStore.getState();
      if (currentState.currentTournament && !currentState.currentTournament.isPractice) {
        apiSync.syncTournamentDirectly(currentState.currentTournament, currentState.players).then((ok) => {
          if (ok) setIsCloudSynced(true);
        });
      }
    }
  }, [open, slug, date]);

  const handleCopy = async () => {
    if (!currentUrl) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = currentUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-x-6 top-1/2 -translate-y-1/2 max-w-sm mx-auto z-50 bg-white border border-slate-200/80 rounded-[32px] p-6 shadow-2xl flex flex-col items-center text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-3xl mb-2.5 shadow-2xs">
              📡
            </div>

            <h3 className="text-slate-900 font-black text-xl mb-1">Live Share Link</h3>
            <p className="text-slate-500 text-xs mb-3 font-medium leading-relaxed">
              Friends can scan or open the link to watch real-time court action & standings!
            </p>

            {/* Link Mode Switcher if a single tournament also exists */}
            {tournamentSlug && (
              <div className="w-full flex gap-1 bg-slate-100 p-1 rounded-2xl mb-3.5">
                <button
                  type="button"
                  onClick={() => setShareMode("day")}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all ${
                    shareMode === "day"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  🗓️ Day Session Link
                </button>
                <button
                  type="button"
                  onClick={() => setShareMode("tournament")}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all ${
                    shareMode === "tournament"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  🏸 Tournament Only
                </button>
              </div>
            )}

            <div className="mb-3.5 flex flex-wrap items-center justify-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold">
                {shareMode === "day" ? "✨ Follows all tournaments + Day Table" : "🏸 Single tournament focus"}
              </span>

              {isCloudSynced && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Stream Ready ✓
                </span>
              )}
            </div>

            {/* QR Code Container */}
            <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl shadow-inner mb-4">
              {currentUrl && (
                <QRCodeSVG
                  value={currentUrl}
                  size={165}
                  level="M"
                  includeMargin={false}
                />
              )}
            </div>

            {/* URL input + copy button */}
            <div className="w-full flex items-center gap-2 bg-slate-100 border border-slate-200/80 rounded-full p-1.5 mb-3">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="bg-transparent text-slate-700 text-xs px-3 flex-1 outline-none truncate font-mono font-medium"
              />
              <button
                onClick={handleCopy}
                className={`text-xs font-black px-3.5 py-1.5 rounded-full transition-all shadow-2xs cursor-pointer ${
                  copied
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-950 hover:bg-slate-800 text-white active:scale-95"
                }`}
              >
                {copied ? "Copied! ✓" : "Copy"}
              </button>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
