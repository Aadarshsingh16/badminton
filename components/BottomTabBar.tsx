"use client";
// components/BottomTabBar.tsx — Persistent 2-tab bottom navigation

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { getViewerSlug, isViewerMode } from "@/lib/viewerMode";

export function BottomTabBar() {
  const pathname = usePathname();
  const { dayTable, currentTournament, phase, isScoreSheetOpen } = useStore();
  const [viewerSlug, setViewerSlug] = useState<string | null>(null);

  useEffect(() => {
    setViewerSlug(getViewerSlug());
  }, [pathname]);

  const isViewer = !currentTournament && (isViewerMode() || !!viewerSlug);

  // Status indicator for Play tab
  const playStatus = (() => {
    if (isViewer) return "Live 📡";
    if (!currentTournament) return null;
    if (phase === "fixtures") {
      const remaining = currentTournament.matches.filter(m => !m.played).length;
      return `${remaining} left`;
    }
    if (phase === "final") return "Final!";
    if (phase === "tournament-summary") return "Done";
    return null;
  })();

  const tabs = [
    {
      href: isViewer ? `/live/${viewerSlug}` : "/",
      label: isViewer ? "Live Court" : "Play",
      icon: (active: boolean) => (
        <div className="relative">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 1.5a8.5 8.5 0 110 17 8.5 8.5 0 010-17z"
              fill={active ? "#0F172A" : "#94A3B8"}
            />
            <ellipse cx="12" cy="12" rx="3.5" ry="5" stroke={active ? "#0F172A" : "#94A3B8"} strokeWidth="1.5" fill="none" transform="rotate(-30 12 12)" />
            <line x1="6" y1="17" x2="18" y2="7" stroke={active ? "#0F172A" : "#94A3B8"} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {isViewer && (
            <>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500" />
            </>
          )}
        </div>
      ),
    },
    {
      href: "/day",
      label: "Day Table",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="3" stroke={active ? "#0F172A" : "#94A3B8"} strokeWidth="1.6" fill="none" />
          <path d="M7 15l3-3 3 3 4-5" stroke={active ? "#0F172A" : "#94A3B8"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="7" cy="15" r="1" fill={active ? "#0F172A" : "#94A3B8"} />
          <circle cx="10" cy="12" r="1" fill={active ? "#0F172A" : "#94A3B8"} />
          <circle cx="13" cy="15" r="1" fill={active ? "#0F172A" : "#94A3B8"} />
          <circle cx="17" cy="10" r="1" fill={active ? "#0F172A" : "#94A3B8"} />
        </svg>
      ),
    },
    {
      href: "/history",
      label: "History",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 8v4l3 3" stroke={active ? "#0F172A" : "#94A3B8"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="9" stroke={active ? "#0F172A" : "#94A3B8"} strokeWidth="1.6" />
        </svg>
      ),
    },
    {
      href: "/profiles",
      label: "Squad",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
            stroke={active ? "#0F172A" : "#94A3B8"}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="9"
            cy="7"
            r="4"
            stroke={active ? "#0F172A" : "#94A3B8"}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M22 21v-2a4 4 0 0 0-3-3.87"
            stroke={active ? "#0F172A" : "#94A3B8"}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M16 3.13a4 4 0 0 1 0 7.75"
            stroke={active ? "#0F172A" : "#94A3B8"}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
  ];

  // Badge for Day Table tab
  const dayBadge = dayTable.tournaments.length > 0 ? dayTable.tournaments.length : null;

  return (
    <motion.div
      initial={false}
      animate={{
        y: isScoreSheetOpen ? 120 : 0,
        opacity: isScoreSheetOpen ? 0 : 1,
      }}
      transition={{
        type: "spring",
        damping: 28,
        stiffness: 350,
      }}
      className={`fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto ${
        isScoreSheetOpen ? "pointer-events-none" : ""
      }`}
    >
      {/* Frosted clean white bottom navigation */}
      <div className="bg-white/92 backdrop-blur-xl border-t border-slate-200/70 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] px-4 pb-safe">
        <div className="flex items-center pt-2.5 pb-2">
          {tabs.map((tab, idx) => {
            const isFirstTab = idx === 0;
            const isActive = isFirstTab
              ? isViewer
                ? pathname.startsWith("/live") || pathname === "/"
                : pathname === "/"
              : pathname.startsWith(tab.href);

            const badge = tab.href === "/day" ? dayBadge : null;
            const status = isFirstTab ? playStatus : null;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex-1 flex flex-col items-center gap-1 py-0.5 relative transition-transform active:scale-95"
              >
                <div className="relative flex items-center justify-center">
                  {tab.icon(isActive)}
                  {badge && (
                    <div className="absolute -top-1 -right-2 w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center shadow-xs">
                      <span className="text-white text-[9px] font-extrabold">{badge}</span>
                    </div>
                  )}
                </div>

                <span
                  className={`text-[11px] transition-colors leading-tight ${
                    isActive ? "font-bold text-slate-950" : "font-medium text-slate-400"
                  }`}
                >
                  {tab.label}
                </span>

                {status && (
                  <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded-full -mt-0.5">
                    {status}
                  </span>
                )}

                {/* Subtle active dot indicator inspired by Image 3 */}
                {isActive && (
                  <motion.div
                    layoutId="tab-dot"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="w-1.5 h-1.5 rounded-full bg-slate-950 mt-0.5"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
