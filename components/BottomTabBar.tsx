"use client";
// components/BottomTabBar.tsx — Persistent 2-tab bottom navigation

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";

const tabs = [
  {
    href: "/",
    label: "Play",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 1.5a8.5 8.5 0 110 17 8.5 8.5 0 010-17z"
          fill={active ? "#A78BFA" : "#4B5563"}
        />
        <ellipse cx="12" cy="12" rx="3.5" ry="5" stroke={active ? "#A78BFA" : "#4B5563"} strokeWidth="1.5" fill="none" transform="rotate(-30 12 12)" />
        <line x1="6" y1="17" x2="18" y2="7" stroke={active ? "#A78BFA" : "#4B5563"} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/day",
    label: "Day Table",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke={active ? "#A78BFA" : "#4B5563"} strokeWidth="1.5" fill="none" />
        <path d="M7 15l3-3 3 3 4-5" stroke={active ? "#A78BFA" : "#4B5563"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="7" cy="15" r="1" fill={active ? "#A78BFA" : "#4B5563"} />
        <circle cx="10" cy="12" r="1" fill={active ? "#A78BFA" : "#4B5563"} />
        <circle cx="13" cy="15" r="1" fill={active ? "#A78BFA" : "#4B5563"} />
        <circle cx="17" cy="10" r="1" fill={active ? "#A78BFA" : "#4B5563"} />
      </svg>
    ),
  },
  {
    href: "/history",
    label: "History",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 8v4l3 3" stroke={active ? "#A78BFA" : "#4B5563"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" stroke={active ? "#A78BFA" : "#4B5563"} strokeWidth="1.5" />
      </svg>
    ),
  },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const { dayTable, currentTournament, phase } = useStore();

  // Status indicator for Play tab
  const playStatus = (() => {
    if (!currentTournament) return null;
    if (phase === "fixtures") {
      const remaining = currentTournament.matches.filter(m => !m.played).length;
      return `${remaining} left`;
    }
    if (phase === "final") return "Final!";
    if (phase === "tournament-summary") return "Done";
    return null;
  })();

  // Badge for Day Table tab
  const dayBadge = dayTable.tournaments.length > 0 ? dayTable.tournaments.length : null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 max-w-lg mx-auto">
      {/* Frosted glass tab bar */}
      <div className="bg-slate-900/95 backdrop-blur-xl border-t border-white/10 px-6 pb-safe">
        <div className="flex items-center pt-2 pb-3">
          {tabs.map((tab) => {
            const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            const badge = tab.href === "/day" ? dayBadge : null;
            const status = tab.href === "/" ? playStatus : null;

            return (
              <Link key={tab.href} href={tab.href} className="flex-1 flex flex-col items-center gap-1 py-1 relative">
                <div className="relative">
                  {tab.icon(isActive)}
                  {badge && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-[9px] font-bold">{badge}</span>
                    </div>
                  )}
                </div>

                <span className={`text-xs font-semibold transition-colors ${isActive ? "text-purple-400" : "text-gray-500"}`}>
                  {tab.label}
                </span>

                {status && (
                  <span className="text-[9px] text-purple-300 font-medium -mt-0.5">{status}</span>
                )}

                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-purple-400 rounded-full"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
