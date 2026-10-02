"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  useStore,
  FIXED_PLAYERS,
  recoverTournamentsFromSyncQueue,
  recoverCompletedDaysFromSyncQueue,
} from "@/lib/store";
import { AvatarSVG } from "@/components/avatars/AvatarSVG";
import { AvatarType } from "@/lib/types";
import { isViewerMode, getViewerSlug } from "@/lib/viewerMode";
import { getBackendUrl } from "@/lib/backend";

interface PlayerLore {
  id: string;
  name: string;
  title: string;
  origin: string;
  avatar: AvatarType;
  badgeEmoji: string;
  tagline: string;
  roastBio: string;
  playstyle: string;
  specialMove: string;
  weakness: string;
  vibeQuotes: {
    courtMood: string;
    dailyRoast: string;
    excuse: string;
  };
  funStats: {
    label: string;
    value: number;
    color: string;
  }[];
}

const PLAYER_LORES: { [id: string]: PlayerLore } = {
  gautam: {
    id: "gautam",
    name: "Gautam",
    title: "The Himalayan Smasher",
    origin: "🏔️ Uttarakhand Peaks",
    avatar: "chinese",
    badgeEmoji: "🥟",
    tagline: "100% Indian, 0% Mandarin, 100% Momos Energy",
    roastBio:
      "Proudly hails from the high mountain peaks of Uttarakhand, yet gets asked for momos and chopstick tips in every tournament. Compact 5'4\" frame packed with mountain goat agility. Runs around the court like he's sprinting up Kedarnath with no oxygen.",
    playstyle: "Mountain Ninja / Short King Agility",
    specialMove: "🥟 The Steamed Momos Smash (Fast, spicy, drops without warning)",
    weakness: "Any shuttle hit higher than 6 feet or people assuming he speaks Cantonese",
    vibeQuotes: {
      courtMood:
        "Bro I am literally from Uttarakhand, why does everyone keep asking if I want red chutney with the shuttlecock?!",
      dailyRoast: "I am NOT 5'2\". In proper thick badminton socks I am clearly 5'4.5\"!",
      excuse:
        "The court ceiling here is way too high. In Uttarakhand mountains the air is thinner, my smash lands twice as fast.",
    },
    funStats: [
      { label: "Mountain Agility", value: 96, color: "from-emerald-400 to-teal-500" },
      { label: "Himalayan Lungs", value: 92, color: "from-blue-400 to-cyan-500" },
      { label: "Physical Height", value: 46, color: "from-amber-400 to-orange-500" },
      { label: "Momos Defense", value: 99, color: "from-purple-400 to-pink-500" },
    ],
  },

  anirudh: {
    id: "anirudh",
    name: "Anirudh",
    title: "The Night Shift Slayer",
    origin: "🌙 3 AM US Shift Cubicle",
    avatar: "fighter",
    badgeEmoji: "🥱",
    tagline: "Will play badminton for food, but prefers sleeping until 4 PM",
    roastBio:
      "The certified sloth of the squad. Works US night shifts so he can legally sleep through daylight, adult duties, and incoming drop shots. Takes at least two full matches and an energy drink just for his nervous system to achieve consciousness.",
    playstyle: "Low-Battery Striker / Horizontal Sloth Defense",
    specialMove:
      "🥱 Power Nap Reflex (Looks completely asleep on court, then reflex-blocks a 100 km/h smash)",
    weakness: "Matches scheduled before sunset, bright court lights, and waking up before 3 PM",
    vibeQuotes: {
      courtMood:
        "Bro please don't smash before 4 PM... my US shift ended 2 hours ago. My eyes have been open for only 14 minutes.",
      dailyRoast: "I'm not lazy, I'm just saving kinetic energy for the year 2029.",
      excuse: "My circadian rhythm was 180 degrees out of phase with the shuttlecock's trajectory.",
    },
    funStats: [
      { label: "Sleep Deprivation", value: 99, color: "from-indigo-400 to-purple-500" },
      { label: "Night Shift Stamina", value: 94, color: "from-violet-400 to-purple-600" },
      { label: "Morning Alertness", value: 14, color: "from-red-400 to-rose-500" },
      { label: "Low Battery Reflex", value: 89, color: "from-cyan-400 to-blue-500" },
    ],
  },

  akshat: {
    id: "akshat",
    name: "Akshat",
    title: "The Silicon Valley Dynamo",
    origin: "💵 Remote USA / California Hours",
    avatar: "dwarf",
    badgeEmoji: "💻",
    tagline: "Earns in USD, smashes in INR, center of gravity unshakeable",
    roastBio:
      "Pocket-sized powerhouse pulling in American dollars while sitting in his shorts. Impossible to topple on court because his center of gravity is 12 inches from the floor. Calculates his tournament points directly into USD conversion rates.",
    playstyle: "Low-Center Dynamo / Precision Angle Hustler",
    specialMove: "🇺🇸 The Green Card Drop (Lands precisely on the white line with tax-free accuracy)",
    weakness: "High clears that require a step ladder and late night standup calls with California",
    vibeQuotes: {
      courtMood:
        "Converting today's tournament points to USD right now... still richer than your win rate.",
      dailyRoast: "Being short is a pure aerodynamic advantage. You tall guys have too much wind drag.",
      excuse: "I was distracted by a Slack ping from my US tech lead right as I was about to smash.",
    },
    funStats: [
      { label: "USD Conversion Power", value: 100, color: "from-emerald-400 to-green-500" },
      { label: "Center of Gravity", value: 98, color: "from-blue-400 to-indigo-500" },
      { label: "Vertical Reach", value: 44, color: "from-amber-400 to-orange-500" },
      { label: "Algorithmic Precision", value: 92, color: "from-purple-400 to-pink-500" },
    ],
  },

  udbhaw: {
    id: "udbhaw",
    name: "Udbhaw",
    title: "The Court Destroyer",
    origin: "⚡ Danger Zone / Decibel Factory",
    avatar: "bigfoot",
    badgeEmoji: "🦍",
    tagline: "6 feet of pure rage, one bad call away from breaking a racket",
    roastBio:
      "Towering giant who looks like he wandered onto the badminton court straight out of a WWE cage match. Blood pressure jumps 30% whenever a shuttle touches the net tape. Smashes the shuttle like it personally insulted his ancestors.",
    playstyle: "Angry Hulk / Pure Thunder & Menace",
    specialMove:
      "💥 Decibel Smash 3000 (Shuttle travels at Mach 2 or punches a permanent hole in the ceiling)",
    weakness: "Tight net drop shots that force his giant 6-foot spine to bend all the way down",
    vibeQuotes: {
      courtMood:
        "WHO TOUCHED THE NET?! I WILL SNAP THIS RACKET IN HALF AND THROW IT TO JUPITER!",
      dailyRoast: "I am calm. THIS IS MY CALM INDOOR VOICE!",
      excuse: "The shuttle was defective! It clearly had illegal anti-gravity physics installed!",
    },
    funStats: [
      { label: "Smash Decibels", value: 100, color: "from-red-500 to-orange-500" },
      { label: "Blood Pressure", value: 98, color: "from-rose-500 to-red-600" },
      { label: "Height Dominance", value: 96, color: "from-amber-400 to-yellow-500" },
      { label: "Patience Level", value: 8, color: "from-slate-400 to-gray-500" },
    ],
  },

  harsh: {
    id: "harsh",
    name: "Harsh",
    title: "The Theoretical Grandmaster",
    origin: "📚 Engineering Library & Coaching",
    avatar: "nerd",
    badgeEmoji: "🤓",
    tagline: "Solving differential equations mid-rally, 100% textbook theory",
    roastBio:
      "Currently preparing for GATE and refuses to hit any shot that doesn't obey Navier-Stokes fluid dynamics. Carries 3 notebooks and a scientific calculator in his racket bag. Explains why he missed a shot with 4 lines of calculus.",
    playstyle: "Calculated Geometry / Formulaic Grinder",
    specialMove: "📐 The Bernoulli Arc (A shot so mathematically derived nobody understands it)",
    weakness: "Opponents playing with zero logic, chaotic lucky frame hits, and GATE syllabus stress",
    vibeQuotes: {
      courtMood:
        "According to Bernoulli's equation and my GATE revision notes, that shuttle was aerodynamically OUT.",
      dailyRoast: "I was mentally revising Engineering Mathematics during that 3-point rally.",
      excuse: "The atmospheric humidity at 25°C caused non-linear drag coefficient variance.",
    },
    funStats: [
      { label: "GATE Preparation", value: 100, color: "from-blue-400 to-cyan-500" },
      { label: "Trajectory Calculus", value: 98, color: "from-indigo-400 to-purple-500" },
      { label: "Physics Excuses", value: 99, color: "from-purple-400 to-pink-500" },
      { label: "Street Smart Chaos", value: 36, color: "from-orange-400 to-red-500" },
    ],
  },

  adarsh: {
    id: "adarsh",
    name: "Adarsh",
    title: "The Amnesiac Wizard",
    origin: "☁️ Cloud 9 / 2G Brain Buffering",
    avatar: "clumsy",
    badgeEmoji: "🤪",
    tagline: "Forgets the score, trips on his shoelace, somehow wins the final",
    roastBio:
      "The undisputed king of brain lag. Will play a heroic 25-shot rally, win the point, and immediately ask 'Wait, who was serving?'. Has left his shoes, towel, and short-term memory on court multiple times. But when the match is on the line, his chaotic luck turns god-mode.",
    playstyle: "Chaotic Clumsy / Clutch Miracle Worker",
    specialMove:
      "🪄 The Amnesia Flick (Even he doesn't know where it's going, so neither does the opponent)",
    weakness: "Remembering court side, keeping track of score, or tying his shoelaces",
    vibeQuotes: {
      courtMood:
        "Wait... did we already start? Whose serve is it? Bro what's the score?!",
      dailyRoast: "I didn't trip, I was inspecting the court traction at floor level.",
      excuse: "My brain was buffering on 2G while my body was on 5G.",
    },
    funStats: [
      { label: "Brain Lag Duration", value: 99, color: "from-purple-400 to-violet-500" },
      { label: "Clutch Miracle Luck", value: 96, color: "from-amber-400 to-yellow-500" },
      { label: "Memory Retention", value: 18, color: "from-red-400 to-rose-500" },
      { label: "Chaotic Charm", value: 98, color: "from-emerald-400 to-teal-500" },
    ],
  },
};

export default function ProfilesPage() {
  const { players, pastTournaments, currentTournament, completedDays, dayTable } = useStore();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(FIXED_PLAYERS[0]?.id || "adarsh");
  const [activeMoodTab, setActiveMoodTab] = useState<"courtMood" | "dailyRoast" | "excuse">("courtMood");
  const [showSpeechBubble, setShowSpeechBubble] = useState(true);

  const [isViewer, setIsViewer] = useState(false);
  const [viewerSlug, setViewerSlugState] = useState<string | null>(null);
  const [cloudHistory, setCloudHistory] = useState<any | null>(null);
  const [cloudDayHonors, setCloudDayHonors] = useState<any | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);

  useEffect(() => {
    const viewer = isViewerMode() && !currentTournament;
    setIsViewer(viewer);
    setViewerSlugState(getViewerSlug());

    // Fetch cloud history & honors so spectators see real career stats across all 6 players
    const fetchCloudData = async () => {
      setCloudLoading(true);
      try {
        const backendUrl = getBackendUrl();
        const [resHist, resDays] = await Promise.all([
          fetch(`${backendUrl}/history?range=all`),
          fetch(`${backendUrl}/day-results`),
        ]);
        if (resHist.ok) {
          const hData = await resHist.json();
          setCloudHistory(hData);
        }
        if (resDays.ok) {
          const dData = await resDays.json();
          setCloudDayHonors(dData);
        }
      } catch (err) {
        console.warn("Failed to fetch cloud profile stats:", err);
      } finally {
        setCloudLoading(false);
      }
    };

    fetchCloudData();
  }, [currentTournament]);

  // Auto-recovery if tournaments were wiped
  useEffect(() => {
    if (pastTournaments.length === 0) {
      const recovered = recoverTournamentsFromSyncQueue();
      if (recovered.length > 0) {
        useStore.setState({ pastTournaments: recovered });
      }
    }
    if (!completedDays || completedDays.length === 0) {
      const recoveredDays = recoverCompletedDaysFromSyncQueue();
      if (recoveredDays.length > 0) {
        useStore.setState({ completedDays: recoveredDays });
      }
    }
  }, [pastTournaments.length, completedDays?.length]);

  // Combine all tournaments for stats (local store + recovered + cloud fallback)
  const allTourneys = useMemo(() => {
    let list = [...pastTournaments];
    if (list.length === 0) {
      const rec = recoverTournamentsFromSyncQueue();
      if (rec.length > 0) list = rec;
    }
    if (currentTournament) list.push(currentTournament);

    // If local has 0 tournaments (e.g. spectator device), populate from cloud history
    if (list.length === 0 && cloudHistory?.days && cloudHistory.days.length > 0) {
      const cloudTourneys: any[] = [];
      cloudHistory.days.forEach((day: any) => {
        (day.tournaments || []).forEach((ct: any) => {
          const mappedMatches = (ct.matches || []).map((m: any) => ({
            id: m.id,
            round: m.round,
            isFinal: !!m.isFinal,
            playerA: m.playerA,
            playerB: m.playerB,
            scoreA: m.scoreA,
            scoreB: m.scoreB,
            played: !!m.played,
            pointsAwarded: {
              [m.playerA]: m.pointsA ?? 0,
              [m.playerB]: m.pointsB ?? 0,
            },
          }));

          const finalMatch = mappedMatches.find((m: any) => m.isFinal);
          const rrMatches = mappedMatches.filter((m: any) => !m.isFinal);

          cloudTourneys.push({
            id: ct.tournamentId,
            shareSlug: ct.shareSlug,
            matches: rrMatches,
            final: finalMatch,
            dayPointsAwarded: {},
          });
        });
      });
      return cloudTourneys;
    }

    return list;
  }, [pastTournaments, currentTournament, cloudHistory]);

  // Overall career stats for all 6 players
  const playerStatsMap = useMemo(() => {
    const stats: {
      [id: string]: {
        matchesPlayed: number;
        wins: number;
        losses: number;
        tournamentsWon: number;
        woodenSpoons: number;
        totalPoints: number;
        pointDiff: number;
        h2h: { [opponentId: string]: { played: number; won: number; lost: number } };
      };
    } = {};

    FIXED_PLAYERS.forEach((p) => {
      stats[p.id] = {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        tournamentsWon: 0,
        woodenSpoons: 0,
        totalPoints: 0,
        pointDiff: 0,
        h2h: {},
      };
      FIXED_PLAYERS.forEach((opp) => {
        if (opp.id !== p.id) {
          stats[p.id].h2h[opp.id] = { played: 0, won: 0, lost: 0 };
        }
      });
    });

    allTourneys.forEach((t) => {
      // Tournament Winner (Champion)
      if (t.final && t.final.played && t.final.scoreA !== undefined && t.final.scoreB !== undefined) {
        const winnerId = t.final.scoreA > t.final.scoreB ? t.final.playerA : t.final.playerB;
        if (stats[winnerId]) {
          stats[winnerId].tournamentsWon += 1;
        }
      }

      // Wooden Spoon / Last place
      if (t.dayPointsAwarded) {
        const sorted = Object.entries(t.dayPointsAwarded).sort(([, a], [, b]) => (Number(a) || 0) - (Number(b) || 0));
        if (sorted.length > 0) {
          const lastId = sorted[0][0];
          if (stats[lastId]) {
            stats[lastId].woodenSpoons += 1;
          }
        }
      }

      // Matches
      const allMatches = [...(t.matches || []).filter((m: any) => m.played)];
      if (t.final && t.final.played) allMatches.push(t.final);

      allMatches.forEach((m: any) => {
        const { playerA, playerB, scoreA = 0, scoreB = 0 } = m;
        if (stats[playerA] && stats[playerB]) {
          stats[playerA].matchesPlayed += 1;
          stats[playerB].matchesPlayed += 1;
          stats[playerA].pointDiff += scoreA - scoreB;
          stats[playerB].pointDiff += scoreB - scoreA;

          if (scoreA > scoreB) {
            stats[playerA].wins += 1;
            stats[playerB].losses += 1;
            if (stats[playerA].h2h[playerB]) stats[playerA].h2h[playerB].won += 1;
            if (stats[playerB].h2h[playerA]) stats[playerB].h2h[playerA].lost += 1;
          } else if (scoreB > scoreA) {
            stats[playerB].wins += 1;
            stats[playerA].losses += 1;
            if (stats[playerB].h2h[playerA]) stats[playerB].h2h[playerA].won += 1;
            if (stats[playerA].h2h[playerB]) stats[playerA].h2h[playerB].lost += 1;
          }
          if (stats[playerA].h2h[playerB]) stats[playerA].h2h[playerB].played += 1;
          if (stats[playerB].h2h[playerA]) stats[playerB].h2h[playerA].played += 1;
        }
      });

      // Points
      FIXED_PLAYERS.forEach((p) => {
        if (t.dayPointsAwarded && t.dayPointsAwarded[p.id] !== undefined) {
          stats[p.id].totalPoints += t.dayPointsAwarded[p.id];
        } else {
          (t.matches || [])
            .filter((m: any) => m.played)
            .forEach((m: any) => {
              stats[p.id].totalPoints += m.pointsAwarded?.[p.id] || 0;
            });
          if (t.final?.played) {
            stats[p.id].totalPoints += t.final.pointsAwarded?.[p.id] || 0;
          }
        }
      });
    });

    // Add completed day spoon records if recorded
    if (completedDays && completedDays.length > 0) {
      completedDays.forEach((cd) => {
        if (cd.spoonPlayerId && stats[cd.spoonPlayerId]) {
          if (allTourneys.length === 0) stats[cd.spoonPlayerId].woodenSpoons += 1;
        }
        if (cd.topPlayerId && stats[cd.topPlayerId]) {
          if (allTourneys.length === 0) stats[cd.topPlayerId].tournamentsWon += 1;
        }
      });
    } else if (cloudDayHonors) {
      (cloudDayHonors.dayChampions || []).forEach((c: any) => {
        if (stats[c.playerId] && stats[c.playerId].tournamentsWon === 0) {
          stats[c.playerId].tournamentsWon = c.count;
        }
      });
      (cloudDayHonors.dayLastPlaces || []).forEach((s: any) => {
        if (stats[s.playerId] && stats[s.playerId].woodenSpoons === 0) {
          stats[s.playerId].woodenSpoons = s.count;
        }
      });
    }

    return stats;
  }, [allTourneys, completedDays, cloudDayHonors]);

  // Overall Standings Ranking
  const rankingList = useMemo(() => {
    return [...FIXED_PLAYERS]
      .map((p) => {
        const s = playerStatsMap[p.id] || { totalPoints: 0, wins: 0, matchesPlayed: 0 };
        return {
          id: p.id,
          name: p.name,
          points: s.totalPoints,
          wins: s.wins,
          winRate: s.matchesPlayed > 0 ? (s.wins / s.matchesPlayed) * 100 : 0,
        };
      })
      .sort((a, b) => b.points - a.points || b.wins - a.wins);
  }, [playerStatsMap]);

  const activeLore = PLAYER_LORES[selectedPlayerId] || PLAYER_LORES["gautam"];
  const activeStats = playerStatsMap[selectedPlayerId] || {
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    tournamentsWon: 0,
    woodenSpoons: 0,
    totalPoints: 0,
    pointDiff: 0,
    h2h: {},
  };

  const rankIndex = rankingList.findIndex((r) => r.id === selectedPlayerId);
  const currentRank = rankIndex !== -1 ? rankIndex + 1 : 1;
  const winRate =
    activeStats.matchesPlayed > 0
      ? Math.round((activeStats.wins / activeStats.matchesPlayed) * 100)
      : 0;

  // Compute Favorite Bunny (player beaten most) & Nemesis (player lost to most)
  const { bunny, nemesis } = useMemo<{
    bunny: { name: string; won: number; played: number } | null;
    nemesis: { name: string; lost: number; played: number } | null;
  }>(() => {
    let topBunny: { name: string; won: number; played: number } | null = null;
    let topNemesis: { name: string; lost: number; played: number } | null = null;

    Object.entries(activeStats.h2h || {}).forEach(([oppId, rec]) => {
      const opp = FIXED_PLAYERS.find((p) => p.id === oppId);
      const oppName = opp?.name || oppId;

      if (rec.won > 0) {
        if (!topBunny || rec.won > topBunny.won) {
          topBunny = { name: oppName, won: rec.won, played: rec.played };
        }
      }
      if (rec.lost > 0) {
        if (!topNemesis || rec.lost > topNemesis.lost) {
          topNemesis = { name: oppName, lost: rec.lost, played: rec.played };
        }
      }
    });

    return { bunny: topBunny, nemesis: topNemesis };
  }, [activeStats.h2h]);

  return (
    <div className="min-h-screen bg-[#F7F9FD] text-slate-900 pb-32">
      {/* Spectator Mode Banner */}
      {isViewer && (
        <div className="bg-purple-100/90 border-b border-purple-200/80 px-4 py-2 flex items-center justify-between text-xs sticky top-0 z-30 backdrop-blur-md">
          <span className="text-purple-900 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Spectator Mode · Squad Scouting
          </span>
          {viewerSlug && (
            <Link
              href={`/live/${viewerSlug}`}
              className="text-purple-900 bg-white border border-purple-200 px-3 py-1 rounded-full font-bold flex items-center gap-1 transition-all shadow-xs hover:bg-purple-50"
            >
              <span>🏸 Live Court</span>
            </Link>
          )}
        </div>
      )}

      {/* Top Header */}
      <div className="px-4 pt-6 pb-4 border-b border-slate-200/60 bg-[#F7F9FD]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏸</span>
              <h1 className="text-slate-900 font-black text-2xl tracking-tight">The 6 Legends</h1>
            </div>
            <p className="text-slate-500 text-xs mt-0.5 font-medium">
              Scouting reports, personality roasts &amp; career stats
            </p>
          </div>
          {isViewer && viewerSlug ? (
            <Link
              href={`/live/${viewerSlug}`}
              className="text-xs bg-slate-950 text-white font-bold px-3.5 py-1.5 rounded-full hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span>🏸 Stream</span>
            </Link>
          ) : (
            <Link
              href="/history"
              className="text-xs bg-white border border-slate-200/90 text-slate-700 font-bold px-3 py-1.5 rounded-full hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-xs"
            >
              <span>📊</span>
              <span>Logs</span>
            </Link>
          )}
        </div>
      </div>

      {/* Interactive Avatar Stage / Lineup */}
      <div className="px-4 pt-5 pb-2">
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Tap to Scout Player
          </p>
          <span className="text-[11px] font-bold text-slate-400">6 of 6 Active</span>
        </div>

        {/* Horizontal avatar carousel */}
        <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-none snap-x -mx-1 px-1">
          {FIXED_PLAYERS.map((player) => {
            const isSelected = player.id === selectedPlayerId;
            const lore = PLAYER_LORES[player.id];
            const pStats = playerStatsMap[player.id];

            return (
              <motion.button
                key={player.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSelectedPlayerId(player.id);
                  setShowSpeechBubble(true);
                }}
                className={`flex-shrink-0 snap-center flex flex-col items-center py-2.5 px-2 rounded-[22px] border transition-all duration-200 relative ${
                  isSelected
                    ? "bg-white border-2 border-slate-950 shadow-md shadow-slate-950/10 -translate-y-1"
                    : "bg-white/80 border border-slate-200/80 hover:border-slate-300 hover:bg-white text-slate-600 shadow-xs"
                }`}
                style={{ width: "72px" }}
              >
                {/* Crown / Spoon Badge on avatar */}
                {pStats?.tournamentsWon > 0 && (
                  <div className="absolute -top-1.5 -right-1 bg-amber-400 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs border border-white">
                    🏆
                  </div>
                )}

                <div className="w-12 h-12 relative flex items-center justify-center">
                  <AvatarSVG type={player.avatar} size={46} />
                </div>

                <span
                  className={`text-[11px] mt-1.5 truncate max-w-[62px] ${
                    isSelected ? "font-black text-slate-950" : "font-bold text-slate-600"
                  }`}
                >
                  {player.name}
                </span>

                <span className="text-[10px] mt-0.5">
                  {lore?.badgeEmoji || "🏸"}
                </span>

                {isSelected && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute -bottom-1 w-6 h-1 bg-slate-950 rounded-full"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 space-y-4">
        {/* Interactive Speech Bubble / "How Are You?" Dialogue Box */}
        <AnimatePresence mode="wait">
          {showSpeechBubble && (
            <motion.div
              key={selectedPlayerId + activeMoodTab}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative p-4 rounded-[28px] bg-gradient-to-br from-indigo-50/90 via-purple-50/60 to-white border border-indigo-100/90 shadow-sm overflow-hidden"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white border border-indigo-100 flex items-center justify-center flex-shrink-0 text-xl shadow-xs">
                  {activeLore.badgeEmoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900/80">
                      {activeLore.name} speaks:
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {activeMoodTab === "courtMood"
                        ? "🏸 Court Vibe"
                        : activeMoodTab === "dailyRoast"
                        ? "🍕 Daily Life"
                        : "😤 Excuse"}
                    </span>
                  </div>

                  <p className="text-slate-800 text-[13px] font-bold mt-1.5 leading-relaxed italic">
                    &ldquo;{activeLore.vibeQuotes[activeMoodTab]}&rdquo;
                  </p>
                </div>
              </div>

              {/* Mood selector buttons */}
              <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-indigo-100/60">
                <button
                  onClick={() => setActiveMoodTab("courtMood")}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black transition-all ${
                    activeMoodTab === "courtMood"
                      ? "bg-slate-950 text-white shadow-sm"
                      : "bg-white/80 hover:bg-white text-slate-600 border border-slate-200/60"
                  }`}
                >
                  🏸 On Court
                </button>
                <button
                  onClick={() => setActiveMoodTab("dailyRoast")}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black transition-all ${
                    activeMoodTab === "dailyRoast"
                      ? "bg-slate-950 text-white shadow-sm"
                      : "bg-white/80 hover:bg-white text-slate-600 border border-slate-200/60"
                  }`}
                >
                  🍕 Daily Roast
                </button>
                <button
                  onClick={() => setActiveMoodTab("excuse")}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black transition-all ${
                    activeMoodTab === "excuse"
                      ? "bg-slate-950 text-white shadow-sm"
                      : "bg-white/80 hover:bg-white text-slate-600 border border-slate-200/60"
                  }`}
                >
                  😤 Excuse
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected Player Profile Card */}
        <div className="p-5 rounded-[32px] bg-white border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.04)] space-y-5">
          {/* Card Header with Big Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-[24px] bg-gradient-to-tr from-slate-100 to-indigo-50/70 border border-slate-200/80 p-2 flex items-center justify-center flex-shrink-0 shadow-inner relative">
              <AvatarSVG type={activeLore.avatar} size={68} />
              <div className="absolute -bottom-1.5 -right-1.5 px-2.5 py-0.5 rounded-full bg-slate-950 border border-white text-[10px] font-black text-white shadow-sm">
                #{currentRank}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-slate-900 font-black text-2xl leading-none tracking-tight truncate">
                  {activeLore.name}
                </h2>
                <span className="text-lg">{activeLore.badgeEmoji}</span>
              </div>

              <p className="text-indigo-600 font-extrabold text-xs mt-1.5 truncate">
                {activeLore.title}
              </p>

              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200/60 text-[10px] font-bold text-slate-600">
                  {activeLore.origin}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-[10px] font-black text-amber-800">
                  🏆 {activeStats.tournamentsWon} Won
                </span>
              </div>
            </div>
          </div>

          {/* Roast Bio Box */}
          <div className="p-4 rounded-[22px] bg-amber-50/70 border border-amber-200/70 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                🔥 Scouting Dossier &amp; Roast
              </span>
              <span className="text-[10px] text-amber-700/60 italic font-mono">Confidential</span>
            </div>
            <p className="text-slate-700 text-xs leading-relaxed font-medium">
              {activeLore.roastBio}
            </p>
          </div>

          {/* Quick Playstyle & Kryptonite */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3.5 rounded-[22px] bg-indigo-50/60 border border-indigo-100/80">
              <p className="text-[10px] font-black text-indigo-700 uppercase tracking-wider mb-1">
                ⚡ Playstyle
              </p>
              <p className="text-slate-900 font-black text-xs leading-snug">{activeLore.playstyle}</p>
            </div>
            <div className="p-3.5 rounded-[22px] bg-rose-50/60 border border-rose-100/80">
              <p className="text-[10px] font-black text-rose-700 uppercase tracking-wider mb-1">
                🎯 Kryptonite
              </p>
              <p className="text-slate-700 font-semibold text-[11px] leading-snug">
                {activeLore.weakness}
              </p>
            </div>
          </div>

          {/* Signature Move Callout */}
          <div className="px-4 py-3 rounded-[22px] bg-gradient-to-r from-purple-50 via-pink-50 to-amber-50/50 border border-purple-100/80 flex items-center gap-3">
            <span className="text-xl flex-shrink-0">✨</span>
            <div className="min-w-0">
              <p className="text-[9px] uppercase font-black text-purple-700 tracking-wider">
                Signature Technique
              </p>
              <p className="text-xs font-black text-slate-900 truncate">{activeLore.specialMove}</p>
            </div>
          </div>

          {/* Career Stats Grid */}
          <div className="space-y-2 pt-1">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">
              Career History &amp; Standing
            </p>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-[20px] bg-amber-50/70 border border-amber-200/60 text-center">
                <p className="text-amber-900 font-black text-lg leading-tight">
                  {activeStats.tournamentsWon}
                </p>
                <p className="text-[10px] text-amber-700/80 font-bold mt-0.5">🏆 Titles Won</p>
              </div>

              <div className="p-3 rounded-[20px] bg-rose-50/70 border border-rose-200/60 text-center">
                <p className="text-rose-800 font-black text-lg leading-tight">
                  {activeStats.woodenSpoons}
                </p>
                <p className="text-[10px] text-rose-700/80 font-bold mt-0.5">🥄 Spoons</p>
              </div>

              <div className="p-3 rounded-[20px] bg-emerald-50/70 border border-emerald-200/60 text-center">
                <p className="text-emerald-800 font-black text-lg leading-tight">
                  {winRate}%
                </p>
                <p className="text-[10px] text-emerald-700/80 font-bold mt-0.5">Win Rate</p>
              </div>

              <div className="p-3 rounded-[20px] bg-indigo-50/70 border border-indigo-200/60 text-center">
                <p className="text-indigo-900 font-black text-lg leading-tight">
                  {activeStats.totalPoints}
                </p>
                <p className="text-[10px] text-indigo-700/80 font-bold mt-0.5">Total Points</p>
              </div>

              <div className="p-3 rounded-[20px] bg-slate-50 border border-slate-200/70 text-center">
                <p className="text-slate-900 font-black text-lg leading-tight">
                  {activeStats.matchesPlayed}
                </p>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">Matches</p>
              </div>

              <div className="p-3 rounded-[20px] bg-slate-950 text-white text-center shadow-xs">
                <p className="text-white font-black text-lg leading-tight">
                  #{currentRank}
                </p>
                <p className="text-[10px] text-slate-300 font-bold mt-0.5">Squad Rank</p>
              </div>
            </div>
          </div>

          {/* Funny Radar Attribute Bars */}
          <div className="space-y-2.5 pt-1">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">
              Scouting Attributes (Certified 100% Accurate)
            </p>

            <div className="space-y-2.5 p-3.5 rounded-[22px] bg-slate-50/80 border border-slate-200/70">
              {activeLore.funStats.map((stat, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-800">{stat.label}</span>
                    <span className="text-slate-500 font-mono text-[11px]">{stat.value}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200/80 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.value}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.1 }}
                      className={`h-full rounded-full bg-gradient-to-r ${stat.color}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rivalry Dossier (Bunny & Nemesis) */}
          <div className="space-y-2 pt-2 border-t border-slate-200/70">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">
              Rivalry &amp; Head-to-Head
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3.5 rounded-[22px] bg-emerald-50/70 border border-emerald-200/70">
                <p className="text-[9px] uppercase font-black text-emerald-800 tracking-wider">
                  🐰 Favorite Bunny
                </p>
                {bunny ? (
                  <div className="mt-1">
                    <p className="text-slate-900 font-black text-xs">{bunny.name}</p>
                    <p className="text-[10px] text-emerald-700 font-bold font-mono mt-0.5">
                      {bunny.won} wins ({bunny.played} played)
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-400 text-[10px] mt-1 italic font-medium">No victims recorded yet</p>
                )}
              </div>

              <div className="p-3.5 rounded-[22px] bg-rose-50/70 border border-rose-200/70">
                <p className="text-[9px] uppercase font-black text-rose-800 tracking-wider">
                  😈 Greatest Nemesis
                </p>
                {nemesis ? (
                  <div className="mt-1">
                    <p className="text-slate-900 font-black text-xs">{nemesis.name}</p>
                    <p className="text-[10px] text-rose-700 font-bold font-mono mt-0.5">
                      {nemesis.lost} losses ({nemesis.played} played)
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-400 text-[10px] mt-1 italic font-medium">Undefeated against all</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Squad Hall of Fame Quick Links */}
        <div className="p-4 rounded-[26px] bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👑</span>
            <div>
              <p className="text-xs font-black text-slate-900">Looking for Match Records?</p>
              <p className="text-[11px] text-slate-500 font-medium">Check game scores &amp; standings</p>
            </div>
          </div>
          <Link
            href="/history"
            className="px-4 py-2 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-black text-xs shadow-xs transition-all active:scale-95 flex items-center gap-1"
          >
            <span>View History</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
