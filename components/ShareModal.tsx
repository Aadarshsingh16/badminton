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
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-x-6 top-1/2 -translate-y-1/2 max-w-sm mx-auto z-50 bg-slate-900 border border-purple-500/30 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-2xl mb-3">
              📡
            </div>

            <h3 className="text-white font-black text-xl mb-1">Live Share Link</h3>
            <p className="text-white/50 text-xs mb-3">
              Friends can scan or open the link to watch real-time scores courtside!
            </p>

            {isCloudSynced && (
              <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Cloud Stream Ready ✓
              </div>
            )}

            {/* QR Code Container */}
            <div className="bg-white p-3.5 rounded-2xl shadow-inner mb-5">
              {shareUrl && (
                <QRCodeSVG
                  value={shareUrl}
                  size={180}
                  level="M"
                  includeMargin={false}
                />
              )}
            </div>

            {/* URL input + copy button */}
            <div className="w-full flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-1.5 mb-4">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="bg-transparent text-white/70 text-xs px-2 flex-1 outline-none truncate font-mono"
              />
              <button
                onClick={handleCopy}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                  copied
                    ? "bg-green-500 text-white"
                    : "bg-purple-600 hover:bg-purple-500 text-white"
                }`}
              >
                {copied ? "Copied! ✓" : "Copy"}
              </button>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 font-semibold text-sm transition-colors"
            >
              Done
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
