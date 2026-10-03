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
  slug: string;
}

export function ShareModal({ open, onClose, slug }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [isCloudSynced, setIsCloudSynced] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/live/${slug}`);
    }
    if (open) {
      const state = useStore.getState();
      if (state.currentTournament && !state.currentTournament.isPractice) {
        apiSync.syncTournamentDirectly(state.currentTournament, state.players).then((ok) => {
          if (ok) setIsCloudSynced(true);
        });
      }
    }
  }, [slug, open]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API restricted
      const el = document.createElement("textarea");
      el.value = shareUrl;
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
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-3xl mb-3 shadow-2xs">
              📡
            </div>

            <h3 className="text-slate-900 font-black text-xl mb-1">Live Share Link</h3>
            <p className="text-slate-500 text-xs mb-3 font-medium leading-relaxed">
              Friends can scan or open the link to watch real-time scores courtside!
            </p>

            {isCloudSynced && (
              <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Cloud Stream Ready ✓
              </div>
            )}

            {/* QR Code Container */}
            <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl shadow-inner mb-4">
              {shareUrl && (
                <QRCodeSVG
                  value={shareUrl}
                  size={175}
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
                value={shareUrl}
                className="bg-transparent text-slate-700 text-xs px-3 flex-1 outline-none truncate font-mono font-medium"
              />
              <button
                onClick={handleCopy}
                className={`text-xs font-black px-3.5 py-1.5 rounded-full transition-all shadow-2xs ${
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
              className="w-full py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
            >
              Done
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
