"use client";
// components/BottomTabBar.tsx — Floating capsule bottom navigation with scroll hide/show

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { getViewerSlug, isViewerMode } from "@/lib/viewerMode";

export function BottomTabBar() {
  const pathname = usePathname();
  const { dayTable, currentTournament, phase, isScoreSheetOpen } = useStore();
  const [viewerSlug, setViewerSlug] = useState<string | null>(null);

  // Scroll detection state
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    setViewerSlug(getViewerSlug());
  }, [pathname]);

  // Reset scroll-down state on route change
  useEffect(() => {
    setIsScrolledDown(false);
    lastScrollY.current = 0;
  }, [pathname]);

  // Listen to scroll events across the window and any scrollable container (e.g. <main>)
  useEffect(() => {
    const handleScroll = (e: Event) => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const target = e.target;
          let currentY = 0;

          if (target === document || target === window) {
            currentY = window.scrollY || document.documentElement.scrollTop || 0;
          } else if (target instanceof HTMLElement) {
            currentY = target.scrollTop;
          }

          const diff = currentY - lastScrollY.current;

          // If scrolled down past 50px threshold and moving downwards with clear intent (> 8px)
          if (currentY > 60 && diff > 8) {
            setIsScrolledDown(true);
          } else if (diff < -8 || currentY <= 30) {
            // If scrolling upwards with clear intent or near the very top of the page
            setIsScrolledDown(false);
          }

          lastScrollY.current = Math.max(0, currentY);
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, []);

  const isViewer = !currentTournament && (isViewerMode() || !!viewerSlug);

  // Remaining matches count in tournament
  const remainingMatches =
    currentTournament && phase === "fixtures"
      ? currentTournament.matches.filter((m) => !m.played).length
      : null;

  // Day Table tournaments count
  const dayBadge = dayTable.tournaments.length > 0 ? dayTable.tournaments.length : null;

  const tabs = [
    {
      href: isViewer ? `/live/${viewerSlug}` : "/",
      label: isViewer ? "Live Court" : "Play",
      badge: isViewer ? (
        <span className="absolute -top-1 -right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      ) : phase === "final" ? (
        <span className="absolute -top-1.5 -right-2 text-[10px]">🏆</span>
      ) : remainingMatches !== null && remainingMatches > 0 ? (
        <span className="absolute -top-1 -right-2 px-1 min-w-[15px] h-[15px] bg-blue-600 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-2xs">
          {remainingMatches}
        </span>
      ) : null,
      icon: (active: boolean) => (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" className="transition-colors">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 1.5a8.5 8.5 0 110 17 8.5 8.5 0 010-17z"
            fill={active ? "#FFFFFF" : "#94A3B8"}
          />
          <ellipse
            cx="12"
            cy="12"
            rx="3.5"
            ry="5"
            stroke={active ? "#FFFFFF" : "#94A3B8"}
            strokeWidth="1.6"
            fill="none"
            transform="rotate(-30 12 12)"
          />
          <line
            x1="6"
            y1="17"
            x2="18"
            y2="7"
            stroke={active ? "#FFFFFF" : "#94A3B8"}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      href: "/day",
      label: "Day Table",
      badge: dayBadge ? (
        <span className="absolute -top-1 -right-2 px-1 min-w-[15px] h-[15px] bg-slate-900 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-2xs">
          {dayBadge}
        </span>
      ) : null,
      icon: (active: boolean) => (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" className="transition-colors">
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="3"
            stroke={active ? "#FFFFFF" : "#94A3B8"}
            strokeWidth="1.7"
            fill="none"
          />
          <path
            d="M7 15l3-3 3 3 4-5"
            stroke={active ? "#FFFFFF" : "#94A3B8"}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="7" cy="15" r="1.1" fill={active ? "#FFFFFF" : "#94A3B8"} />
          <circle cx="10" cy="12" r="1.1" fill={active ? "#FFFFFF" : "#94A3B8"} />
          <circle cx="13" cy="15" r="1.1" fill={active ? "#FFFFFF" : "#94A3B8"} />
          <circle cx="17" cy="10" r="1.1" fill={active ? "#FFFFFF" : "#94A3B8"} />
        </svg>
      ),
    },
    {
      href: "/history",
      label: "History",
      badge: null,
      icon: (active: boolean) => (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" className="transition-colors">
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke={active ? "#FFFFFF" : "#94A3B8"}
            strokeWidth="1.7"
          />
          <path
            d="M12 7v5l3.5 2"
            stroke={active ? "#FFFFFF" : "#94A3B8"}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      href: "/profiles",
      label: "Squad",
      badge: null,
      icon: (active: boolean) => (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" className="transition-colors">
          <path
            d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
            stroke={active ? "#FFFFFF" : "#94A3B8"}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="9"
            cy="7"
            r="3.8"
            stroke={active ? "#FFFFFF" : "#94A3B8"}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M21 21v-2a3.8 3.8 0 0 0-2.5-3.6"
            stroke={active ? "#FFFFFF" : "#94A3B8"}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M15.5 3.3a3.8 3.8 0 0 1 0 7.4"
            stroke={active ? "#FFFFFF" : "#94A3B8"}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
  ];

  const isHidden = isScoreSheetOpen || isScrolledDown;

  return (
    <motion.div
      initial={false}
      animate={{
        y: isHidden ? 90 : 0,
        opacity: isHidden ? 0 : 1,
      }}
      transition={{
        type: "spring",
        damping: 28,
        stiffness: 350,
      }}
      className={`fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] inset-x-0 z-30 max-w-[390px] mx-auto px-4 pointer-events-none select-none`}
    >
      {/* Floating Capsule Dock */}
      <nav
        aria-label="Bottom Navigation"
        className="w-full pointer-events-auto bg-white/88 backdrop-blur-2xl border border-white/80 shadow-[0_12px_32px_-6px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.05)] rounded-full p-1.5 flex items-center justify-between gap-1"
      >
        {tabs.map((tab, idx) => {
          const isFirstTab = idx === 0;
          const isActive = isFirstTab
            ? isViewer
              ? pathname.startsWith("/live") || pathname === "/"
              : pathname === "/"
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-full transition-all active:scale-95 group ${
                isActive ? "text-white" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {/* Active animated pill capsule */}
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="absolute inset-0 bg-slate-950 rounded-full shadow-sm -z-10"
                />
              )}

              <div className="relative flex items-center justify-center mb-0.5">
                {tab.icon(isActive)}
                {tab.badge}
              </div>

              <span
                className={`text-[10px] sm:text-[10.5px] leading-tight font-extrabold tracking-tight transition-colors ${
                  isActive ? "text-white" : "text-slate-400 group-hover:text-slate-700"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </motion.div>
  );
}
