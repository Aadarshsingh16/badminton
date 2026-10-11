"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  useStore,
  FIXED_PLAYERS,
  recoverTournamentsFromSyncQueue,
  recoverCompletedDaysFromSyncQueue,
  normalizePlayerId,
  SAJAL_ALIASES,
  isSajalId,
} from "@/lib/store";
import { computeDayPoints } from "@/lib/ranking";
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

  sajal: {
    id: "sajal",
    name: "Sajal",
    title: "The Lionheart Striker",
    origin: "🦁 Wildcard Arena / 7th Squad Pillar",
    avatar: "custom",
    badgeEmoji: "🦁",
    tagline: "Came as a wild card, stayed as the 7th permanent lethal weapon",
    roastBio:
      "Arrived as a temporary custom player with different profile aliases, but played so aggressively the squad had no choice but to draft him as the permanent 7th. Smashes like an apex predator on the prowl. His drop shots are as deceptive as his sudden appearance on the permanent roster.",
    playstyle: "Apex Predator / Unpredictable Roar & Smash",
    specialMove: "🦁 The Lion's Pounce (Dives across the court out of nowhere to kill the rally)",
    weakness: "People asking which of his 2 previous profile IDs was the original",
    vibeQuotes: {
      courtMood: "I started as a guest, but now you guys can't get rid of me even if you try.",
      dailyRoast: "Check my win rate. Permanent squad member status was earned, not gifted.",
      excuse: "I was busy calculating my transition from custom wild card to franchise player.",
    },
    funStats: [
      { label: "Predator Instinct", value: 97, color: "from-amber-400 to-orange-500" },
      { label: "Wildcard Chaos", value: 95, color: "from-purple-400 to-indigo-500" },
      { label: "Squad Loyalty", value: 99, color: "from-emerald-400 to-teal-500" },
      { label: "Smash Ferocity", value: 93, color: "from-rose-400 to-red-500" },
    ],
  },
};

export default function ProfilesPage() {
  const { players, pastTournaments, currentTournament, completedDays, dayTable } = useStore();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(FIXED_PLAYERS[0]?.id || "adarsh");
  const [activeProfileTab, setActiveProfileTab] = useState<"dossier" | "vibes" | "stats">("dossier");
  const [activeMoodTab, setActiveMoodTab] = useState<"courtMood" | "dailyRoast" | "excuse">("courtMood");
  const [showSpeechBubble, setShowSpeechBubble] = useState(true);

  const [isViewer, setIsViewer] = useState(false);
  const [viewerSlug, setViewerSlugState] = useState<string | null>(null);
  const [cloudHistory, setCloudHistory] = useState<any | null>(null);
  const [cloudDayHonors, setCloudDayHonors] = useState<any | null>(null);
  const [cloudLeaderboard, setCloudLeaderboard] = useState<any[] | null>(null);
  const [shutoutModalType, setShutoutModalType] = useState<"delivered" | "received" | null>(null);
  const [selectedOpponentH2H, setSelectedOpponentH2H] = useState<string | null>(null);
  const [compareOpponentId, setCompareOpponentId] = useState<string>(
    FIXED_PLAYERS.find((p) => p.id !== (FIXED_PLAYERS[0]?.id || "adarsh"))?.id || "gautam"
  );

  useEffect(() => {
    if (compareOpponentId === selectedPlayerId) {
      const alt = FIXED_PLAYERS.find((p) => p.id !== selectedPlayerId);
      if (alt) setCompareOpponentId(alt.id);
    }
  }, [selectedPlayerId, compareOpponentId]);

  useEffect(() => {
    const viewer = isViewerMode() && !currentTournament;
    setIsViewer(viewer);
    setViewerSlugState(getViewerSlug());

    // Fetch cloud history, honors & leaderboard so spectators see real career stats across all players
    const fetchCloudData = async () => {
      setCloudLoading(true);
      try {
        const backendUrl = getBackendUrl();
        const [resHist, resDays, resLb] = await Promise.all([
          fetch(`${backendUrl}/history?range=all`),
          fetch(`${backendUrl}/day-results`),
          fetch(`${backendUrl}/leaderboard`),
        ]);
        if (resHist.ok) {
          const hData = await resHist.json();
          setCloudHistory(hData);
        }
        if (resDays.ok) {
          const dData = await resDays.json();
          setCloudDayHonors(dData);
        }
        if (resLb.ok) {
          const lbData = await resLb.json();
          setCloudLeaderboard(lbData);
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
            config: ct.config || {
              winScore: 5,
              bonusMargin: 4,
              finalBonusMargin: 4,
              winPoints: 2,
              bonusPoints: 1,
              finalWinScore: 6,
              finalWinBase: 2,
              finalWinBonus: 0,
              finalLoserPenalty: -1,
            },
          });
        });
      });
      return cloudTourneys;
    }

    return list;
  }, [pastTournaments, currentTournament, cloudHistory]);

  // Overall career stats for all squad players
  const playerStatsMap = useMemo(() => {
    const stats: {
      [id: string]: {
        matchesPlayed: number;
        wins: number;
        losses: number;
        dayWins: number;
        tournamentsWon: number;
        finalsPlayed: number;
        finalsWon: number;
        finalsLost: number;
        woodenSpoons: number;
        dayPointsTotal: number;
        leaguePoints: number;
        totalPoints: number;
        pointDiff: number;
        shutsDelivered: number;
        shutsReceived: number;
        clutchMatches: number;
        clutchWins: number;
        clutchLosses: number;
        longestWinStreak: number;
        currentStreak: { type: "W" | "L" | null; count: number };
        recentForm: ("W" | "L")[];
        h2h: {
          [opponentId: string]: {
            played: number;
            won: number;
            lost: number;
            finalsPlayed: number;
            finalsWon: number;
            finalsLost: number;
            shutsDelivered: number;
            shutsReceived: number;
            regularShutsDelivered: number;
            finalShutsDelivered: number;
            regularShutsReceived: number;
            finalShutsReceived: number;
            pointsFor: number;
            pointsAgainst: number;
          };
        };
      };
    } = {};

    const playerMatchLog: Record<string, { won: boolean; isFinal: boolean; diff: number; oppId: string }[]> = {};

    FIXED_PLAYERS.forEach((p) => {
      playerMatchLog[p.id] = [];
      stats[p.id] = {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        dayWins: 0,
        tournamentsWon: 0,
        finalsPlayed: 0,
        finalsWon: 0,
        finalsLost: 0,
        woodenSpoons: 0,
        dayPointsTotal: 0,
        leaguePoints: 0,
        totalPoints: 0,
        pointDiff: 0,
        shutsDelivered: 0,
        shutsReceived: 0,
        clutchMatches: 0,
        clutchWins: 0,
        clutchLosses: 0,
        longestWinStreak: 0,
        currentStreak: { type: null, count: 0 },
        recentForm: [],
        h2h: {},
      };
      FIXED_PLAYERS.forEach((opp) => {
        if (opp.id !== p.id) {
          stats[p.id].h2h[opp.id] = {
            played: 0,
            won: 0,
            lost: 0,
            finalsPlayed: 0,
            finalsWon: 0,
            finalsLost: 0,
            shutsDelivered: 0,
            shutsReceived: 0,
            regularShutsDelivered: 0,
            finalShutsDelivered: 0,
            regularShutsReceived: 0,
            finalShutsReceived: 0,
            pointsFor: 0,
            pointsAgainst: 0,
          };
        }
      });
    });

    allTourneys.forEach((t) => {
      // Tournament Winner (Champion)
      if (t.final && t.final.played && t.final.scoreA !== undefined && t.final.scoreB !== undefined) {
        const winnerId = normalizePlayerId(t.final.scoreA > t.final.scoreB ? t.final.playerA : t.final.playerB);
        if (stats[winnerId]) {
          stats[winnerId].tournamentsWon += 1;
        }
      }

      // Day Points (Tournament placement points: e.g. 5 for 1st, 4 for 2nd, etc.)
      const tPtsMap =
        t.dayPointsAwarded && Object.keys(t.dayPointsAwarded).length > 0
          ? t.dayPointsAwarded
          : computeDayPoints(t);

      if (tPtsMap) {
        FIXED_PLAYERS.forEach((p) => {
          let pts = tPtsMap[p.id] ?? 0;
          if (p.id === "sajal") {
            for (const alias of SAJAL_ALIASES) {
              if (tPtsMap[alias] !== undefined) pts += tPtsMap[alias];
            }
          }
          stats[p.id].dayPointsTotal += pts;
        });
      }

      // Matches (Round-Robin & Final)
      const allMatches = [...(t.matches || []).filter((m: any) => m.played)];
      if (t.final && t.final.played) allMatches.push(t.final);

      allMatches.forEach((m: any) => {
        const { playerA, playerB, scoreA = 0, scoreB = 0 } = m;
        const pA = normalizePlayerId(playerA);
        const pB = normalizePlayerId(playerB);
        if (pA === pB || !stats[pA] || !stats[pB]) return;

        stats[pA].matchesPlayed += 1;
        stats[pB].matchesPlayed += 1;
        stats[pA].pointDiff += scoreA - scoreB;
        stats[pB].pointDiff += scoreB - scoreA;

        if (!stats[pA].h2h[pB]) {
          stats[pA].h2h[pB] = {
            played: 0,
            won: 0,
            lost: 0,
            finalsPlayed: 0,
            finalsWon: 0,
            finalsLost: 0,
            shutsDelivered: 0,
            shutsReceived: 0,
            regularShutsDelivered: 0,
            finalShutsDelivered: 0,
            regularShutsReceived: 0,
            finalShutsReceived: 0,
            pointsFor: 0,
            pointsAgainst: 0,
          };
        }
        if (!stats[pB].h2h[pA]) {
          stats[pB].h2h[pA] = {
            played: 0,
            won: 0,
            lost: 0,
            finalsPlayed: 0,
            finalsWon: 0,
            finalsLost: 0,
            shutsDelivered: 0,
            shutsReceived: 0,
            regularShutsDelivered: 0,
            finalShutsDelivered: 0,
            regularShutsReceived: 0,
            finalShutsReceived: 0,
            pointsFor: 0,
            pointsAgainst: 0,
          };
        }

        stats[pA].h2h[pB].played += 1;
        stats[pB].h2h[pA].played += 1;
        stats[pA].h2h[pB].pointsFor += scoreA;
        stats[pA].h2h[pB].pointsAgainst += scoreB;
        stats[pB].h2h[pA].pointsFor += scoreB;
        stats[pB].h2h[pA].pointsAgainst += scoreA;

        const isFinalMatch = !!m.isFinal || m.round === -1;
        const diff = Math.abs(scoreA - scoreB);

        // Match Points (2 pts win, 3 pts shutout / bonus) — strictly for round-robin matches (not finals)
        if (!isFinalMatch) {
          const rrBonusMargin = t.config?.bonusMargin ?? 4;
          const rrWinPts = t.config?.winPoints ?? 2;
          const rrBonusPts = t.config?.bonusPoints ?? 1;

          const ptsA =
            scoreA > scoreB
              ? diff >= rrBonusMargin
                ? rrWinPts + rrBonusPts
                : rrWinPts
              : 0;
          const ptsB =
            scoreB > scoreA
              ? diff >= rrBonusMargin
                ? rrWinPts + rrBonusPts
                : rrWinPts
              : 0;

          stats[pA].leaguePoints += ptsA;
          stats[pB].leaguePoints += ptsB;
        }

        if (scoreA > scoreB) {
          playerMatchLog[pA]?.push({ won: true, isFinal: isFinalMatch, diff, oppId: pB });
          playerMatchLog[pB]?.push({ won: false, isFinal: isFinalMatch, diff, oppId: pA });
          stats[pA].wins += 1;
          stats[pB].losses += 1;
          stats[pA].h2h[pB].won += 1;
          stats[pB].h2h[pA].lost += 1;

          if (isFinalMatch) {
            stats[pA].finalsPlayed += 1;
            stats[pB].finalsPlayed += 1;
            stats[pA].finalsWon += 1;
            stats[pB].finalsLost += 1;
            stats[pA].h2h[pB].finalsPlayed += 1;
            stats[pB].h2h[pA].finalsPlayed += 1;
            stats[pA].h2h[pB].finalsWon += 1;
            stats[pB].h2h[pA].finalsLost += 1;
          }

          // Shutout Condition: Margin >= 4 (3 points earned in regular match or final blowout)
          const bonusMargin = isFinalMatch
            ? t.config?.finalBonusMargin ?? 4
            : t.config?.bonusMargin ?? 4;
          const isShutout = diff >= bonusMargin;

          if (isShutout) {
            stats[pA].shutsDelivered += 1;
            stats[pB].shutsReceived += 1;
            stats[pA].h2h[pB].shutsDelivered += 1;
            stats[pB].h2h[pA].shutsReceived += 1;
            if (isFinalMatch) {
              stats[pA].h2h[pB].finalShutsDelivered += 1;
              stats[pB].h2h[pA].finalShutsReceived += 1;
            } else {
              stats[pA].h2h[pB].regularShutsDelivered += 1;
              stats[pB].h2h[pA].regularShutsReceived += 1;
            }
          }
        } else if (scoreB > scoreA) {
          playerMatchLog[pB]?.push({ won: true, isFinal: isFinalMatch, diff, oppId: pA });
          playerMatchLog[pA]?.push({ won: false, isFinal: isFinalMatch, diff, oppId: pB });
          stats[pB].wins += 1;
          stats[pA].losses += 1;
          stats[pB].h2h[pA].won += 1;
          stats[pA].h2h[pB].lost += 1;

          if (isFinalMatch) {
            stats[pA].finalsPlayed += 1;
            stats[pB].finalsPlayed += 1;
            stats[pB].finalsWon += 1;
            stats[pA].finalsLost += 1;
            stats[pA].h2h[pB].finalsPlayed += 1;
            stats[pB].h2h[pA].finalsPlayed += 1;
            stats[pB].h2h[pA].finalsWon += 1;
            stats[pA].h2h[pB].finalsLost += 1;
          }

          const bonusMargin = isFinalMatch
            ? t.config?.finalBonusMargin ?? 4
            : t.config?.bonusMargin ?? 4;
          const isShutout = diff >= bonusMargin;

          if (isShutout) {
            stats[pB].shutsDelivered += 1;
            stats[pA].shutsReceived += 1;
            stats[pA].h2h[pB].shutsReceived += 1;
            stats[pB].h2h[pA].shutsDelivered += 1;
            if (isFinalMatch) {
              stats[pB].h2h[pA].finalShutsDelivered += 1;
              stats[pA].h2h[pB].finalShutsReceived += 1;
            } else {
              stats[pB].h2h[pA].regularShutsDelivered += 1;
              stats[pA].h2h[pB].regularShutsReceived += 1;
            }
          }
        }
      });
    });

    // Compute streaks, form & clutch rating for all players
    FIXED_PLAYERS.forEach((p) => {
      const log = playerMatchLog[p.id] || [];
      const clutchM = log.filter((m) => m.diff === 1);
      stats[p.id].clutchMatches = clutchM.length;
      stats[p.id].clutchWins = clutchM.filter((m) => m.won).length;
      stats[p.id].clutchLosses = clutchM.filter((m) => !m.won).length;
      stats[p.id].recentForm = log.slice(-5).map((m) => (m.won ? "W" : "L"));

      let maxW = 0;
      let currW = 0;
      for (const m of log) {
        if (m.won) {
          currW++;
          if (currW > maxW) maxW = currW;
        } else {
          currW = 0;
        }
      }
      stats[p.id].longestWinStreak = maxW;

      if (log.length === 0) {
        stats[p.id].currentStreak = { type: null, count: 0 };
      } else {
        const lastType = log[log.length - 1].won ? "W" : "L";
        let cnt = 0;
        for (let i = log.length - 1; i >= 0; i--) {
          if ((log[i].won ? "W" : "L") === lastType) cnt++;
          else break;
        }
        stats[p.id].currentStreak = { type: lastType, count: cnt };
      }
    });

    // Assign totalPoints = dayPointsTotal (Official Placement Metric)
    FIXED_PLAYERS.forEach((p) => {
      stats[p.id].totalPoints = stats[p.id].dayPointsTotal;
    });

    // Cloud Leaderboard Reconcile & Fallback
    if (cloudLeaderboard && cloudLeaderboard.length > 0) {
      cloudLeaderboard.forEach((entry: any) => {
        const normId = normalizePlayerId(entry.playerId);
        if (stats[normId]) {
          if (stats[normId].dayPointsTotal === 0 && (entry.dayPointsTotal || 0) > 0) {
            stats[normId].dayPointsTotal = entry.dayPointsTotal;
            stats[normId].totalPoints = entry.dayPointsTotal;
          }
          if (stats[normId].leaguePoints === 0 && (entry.leaguePoints || 0) > 0) {
            stats[normId].leaguePoints = entry.leaguePoints;
          }
          if (stats[normId].matchesPlayed === 0 && (entry.leagueMatchesPlayed || 0) > 0) {
            stats[normId].matchesPlayed =
              (entry.leagueMatchesPlayed || 0) + (entry.finalsPlayed || 0);
            stats[normId].wins = (entry.leagueWins || 0) + (entry.finalsWon || 0);
            stats[normId].losses = stats[normId].matchesPlayed - stats[normId].wins;
            stats[normId].tournamentsWon = entry.finalsWon || 0;
            stats[normId].finalsPlayed = entry.finalsPlayed || 0;
            stats[normId].finalsLost = Math.max(0, (entry.finalsPlayed || 0) - (entry.finalsWon || 0));
            stats[normId].shutsDelivered = entry.shutoutWins || 0;
            stats[normId].shutsReceived = entry.shutoutLosses || 0;
          }
        }
      });
    }

    // 1. Calculate Day Champions & Wooden Spoons from completedDays
    if (completedDays && completedDays.length > 0) {
      completedDays.forEach((cd) => {
        let spoonId = cd.spoonPlayerId ? normalizePlayerId(cd.spoonPlayerId) : undefined;
        let topId = cd.topPlayerId ? normalizePlayerId(cd.topPlayerId) : undefined;
        if ((!topId || !spoonId) && cd.totals) {
          const sorted = Object.entries(cd.totals).sort(([, a], [, b]) => b - a);
          if (!topId && sorted.length > 0) topId = normalizePlayerId(sorted[0][0]);
          if (!spoonId && sorted.length > 1) spoonId = normalizePlayerId(sorted[sorted.length - 1][0]);
        }
        if (spoonId && stats[spoonId]) {
          stats[spoonId].woodenSpoons += 1;
        }
        if (topId && stats[topId]) {
          stats[topId].dayWins += 1;
        }
      });
    }

    // 2. Fallback / Merge with cloudDayHonors
    if (cloudDayHonors?.dayLastPlaces && cloudDayHonors.dayLastPlaces.length > 0) {
      cloudDayHonors.dayLastPlaces.forEach((s: any) => {
        const spoonId = normalizePlayerId(s.playerId);
        if (stats[spoonId]) {
          stats[spoonId].woodenSpoons = Math.max(stats[spoonId].woodenSpoons, s.count || 0);
        }
      });
    }

    if (cloudDayHonors?.dayChampions && cloudDayHonors.dayChampions.length > 0) {
      cloudDayHonors.dayChampions.forEach((c: any) => {
        const champId = normalizePlayerId(c.playerId);
        if (stats[champId]) {
          stats[champId].dayWins = Math.max(stats[champId].dayWins, c.count || 0);
        }
      });
    }

    return stats;
  }, [allTourneys, completedDays, cloudDayHonors, cloudLeaderboard]);

  // Overall Standings Ranking (Ranked primarily by Day Points, tie-broken by wins & match points)
  const rankingList = useMemo(() => {
    return [...FIXED_PLAYERS]
      .map((p) => {
        const s = playerStatsMap[p.id] || {
          totalPoints: 0,
          dayPointsTotal: 0,
          leaguePoints: 0,
          wins: 0,
          matchesPlayed: 0,
        };
        return {
          id: p.id,
          name: p.name,
          points: s.dayPointsTotal,
          leaguePoints: s.leaguePoints,
          wins: s.wins,
          winRate: s.matchesPlayed > 0 ? (s.wins / s.matchesPlayed) * 100 : 0,
        };
      })
      .sort((a, b) => b.points - a.points || b.wins - a.wins || b.leaguePoints - a.leaguePoints);
  }, [playerStatsMap]);

  const activeLore = PLAYER_LORES[selectedPlayerId] || PLAYER_LORES["gautam"];
  const activeStats = playerStatsMap[selectedPlayerId] || {
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    dayWins: 0,
    tournamentsWon: 0,
    finalsPlayed: 0,
    finalsWon: 0,
    finalsLost: 0,
    woodenSpoons: 0,
    dayPointsTotal: 0,
    leaguePoints: 0,
    totalPoints: 0,
    pointDiff: 0,
    shutsDelivered: 0,
    shutsReceived: 0,
    clutchMatches: 0,
    clutchWins: 0,
    clutchLosses: 0,
    longestWinStreak: 0,
    currentStreak: { type: null, count: 0 },
    recentForm: [],
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

  // 1. Session Trend History (Day Points earned session by session)
  const playerSessionTrends = useMemo(() => {
    const list: { date: string; points: number; isTop: boolean; isSpoon: boolean }[] = [];
    const seenDates = new Set<string>();

    (completedDays || []).forEach((cd) => {
      if (cd.date && !seenDates.has(cd.date)) {
        seenDates.add(cd.date);
        let pts = 0;
        if (cd.totals) {
          pts = cd.totals[selectedPlayerId] ?? 0;
          if (selectedPlayerId === "sajal") {
            for (const alias of SAJAL_ALIASES) {
              if (cd.totals[alias] !== undefined) pts += cd.totals[alias];
            }
          }
        }
        const topId = normalizePlayerId(cd.topPlayerId || "");
        const spoonId = normalizePlayerId(cd.spoonPlayerId || "");
        list.push({
          date: cd.date,
          points: pts,
          isTop: topId === selectedPlayerId,
          isSpoon: spoonId === selectedPlayerId,
        });
      }
    });

    if (dayTable?.totals && Object.keys(dayTable.totals).length > 0) {
      const todayDate = dayTable.date || "Today";
      if (!seenDates.has(todayDate)) {
        let pts = dayTable.totals[selectedPlayerId] ?? 0;
        if (selectedPlayerId === "sajal") {
          for (const alias of SAJAL_ALIASES) {
            if (dayTable.totals[alias] !== undefined) pts += dayTable.totals[alias];
          }
        }
        const sorted = Object.entries(dayTable.totals).sort(([, a], [, b]) => b - a);
        const topId = sorted.length > 0 ? normalizePlayerId(sorted[0][0]) : null;
        const spoonId = sorted.length > 1 ? normalizePlayerId(sorted[sorted.length - 1][0]) : null;
        list.push({
          date: "Today",
          points: pts,
          isTop: topId === selectedPlayerId,
          isSpoon: spoonId === selectedPlayerId,
        });
      }
    }

    return list;
  }, [completedDays, dayTable, selectedPlayerId]);

  // 2. Player Skill Pentagon / Radar Attributes (Certified Court Specs out of 99)
  const playerRadarStats = useMemo(() => {
    const avgPts = activeStats.matchesPlayed > 0 ? activeStats.leaguePoints / activeStats.matchesPlayed : 0;
    const offense = Math.min(99, Math.max(45, Math.round(avgPts * 30 + activeStats.shutsDelivered * 3)));

    const defense = Math.min(
      99,
      Math.max(40, Math.round(82 - activeStats.shutsReceived * 6 + (activeStats.pointDiff > 0 ? 8 : -8)))
    );

    const finalsWr = activeStats.finalsPlayed > 0 ? (activeStats.tournamentsWon / activeStats.finalsPlayed) * 100 : winRate;
    const tightWr = activeStats.clutchMatches > 0 ? (activeStats.clutchWins / activeStats.clutchMatches) * 100 : winRate;
    const clutch = Math.min(99, Math.max(40, Math.round(finalsWr * 0.6 + tightWr * 0.4)));

    const streakBonus = Math.min(25, activeStats.longestWinStreak * 5);
    const consistency = Math.min(99, Math.max(45, Math.round(winRate * 0.7 + streakBonus)));

    const maxMatchesSquad = Math.max(1, ...Object.values(playerStatsMap).map((s) => s.matchesPlayed));
    const stamina = Math.min(99, Math.max(50, Math.round((activeStats.matchesPlayed / maxMatchesSquad) * 95)));

    const overallRating = Math.round((offense + defense + clutch + consistency + stamina) / 5);

    const cx = 140;
    const cy = 130;
    const radius = 75;
    const axes = [
      { key: "offense", label: "Offense", emoji: "⚡", value: offense },
      { key: "consistency", label: "Consistency", emoji: "🎯", value: consistency },
      { key: "stamina", label: "Stamina", emoji: "🔋", value: stamina },
      { key: "defense", label: "Defense", emoji: "🛡️", value: defense },
      { key: "clutch", label: "Clutch", emoji: "💓", value: clutch },
    ];

    const angleStep = (2 * Math.PI) / 5;
    const startAngle = -Math.PI / 2;

    const dataPoints = axes.map((axis, i) => {
      const angle = startAngle + i * angleStep;
      const r = (axis.value / 100) * radius;
      return {
        ...axis,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        labelX: cx + (radius + 20) * Math.cos(angle),
        labelY: cy + (radius + 14) * Math.sin(angle),
      };
    });

    const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

    const gridPolygons = [0.25, 0.5, 0.75, 1.0].map((frac) => {
      return axes
        .map((_, i) => {
          const angle = startAngle + i * angleStep;
          const r = frac * radius;
          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
        })
        .join(" ");
    });

    return {
      axes: dataPoints,
      overallRating,
      polygonPoints,
      gridPolygons,
      cx,
      cy,
      radius,
    };
  }, [activeStats, winRate, playerStatsMap]);

  // 3. Head-to-Head Comparison "Tale of the Tape"
  const compareOpponent = useMemo(() => {
    const opp = FIXED_PLAYERS.find((p) => p.id === compareOpponentId) || FIXED_PLAYERS[1];
    const oppLore = PLAYER_LORES[opp.id] || PLAYER_LORES["adarsh"];
    const oppStats = playerStatsMap[opp.id] || {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      dayWins: 0,
      tournamentsWon: 0,
      finalsPlayed: 0,
      finalsLost: 0,
      dayPointsTotal: 0,
      leaguePoints: 0,
      shutsDelivered: 0,
      shutsReceived: 0,
    };
    const oppRankIndex = rankingList.findIndex((r) => r.id === opp.id);
    const oppRank = oppRankIndex !== -1 ? oppRankIndex + 1 : 2;
    const oppWinRate = oppStats.matchesPlayed > 0 ? Math.round((oppStats.wins / oppStats.matchesPlayed) * 100) : 0;

    const h2hRecord = activeStats.h2h?.[opp.id] || {
      played: 0,
      won: 0,
      lost: 0,
      finalsPlayed: 0,
      finalsWon: 0,
      finalsLost: 0,
      shutsDelivered: 0,
      shutsReceived: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    };

    return {
      opp,
      oppLore,
      oppStats,
      oppRank,
      oppWinRate,
      h2hRecord,
    };
  }, [compareOpponentId, playerStatsMap, rankingList, activeStats.h2h]);

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
      <div className="px-5 pt-6 pb-3 border-b border-slate-200/60 bg-[#F7F9FD]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏸</span>
              <h1 className="text-slate-900 font-black text-2xl tracking-tight">The 6 Legends</h1>
            </div>
            <p className="text-slate-500 text-xs mt-0.5 font-medium">
              Scouting dossiers, personality roasts &amp; career stats
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

      {/* Interactive Avatar Carousel / Player Picker */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Select Player
          </p>
          <span className="text-[11px] font-bold text-slate-400">
            {FIXED_PLAYERS.length} Squad Athletes
          </span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x -mx-1 px-1">
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
                className={`flex-shrink-0 snap-center flex flex-col items-center py-2.5 px-2 rounded-[22px] transition-all duration-200 relative ${
                  isSelected
                    ? "bg-slate-950 text-white shadow-md shadow-slate-950/15 -translate-y-1 ring-2 ring-slate-950"
                    : "bg-white border border-slate-200/80 hover:border-slate-300 text-slate-700 shadow-xs"
                }`}
                style={{ width: "72px" }}
              >
                {/* Crown / Trophy / Spoon Badge on avatar */}
                {pStats?.dayWins > 0 ? (
                  <div className="absolute -top-1.5 -right-1 bg-amber-400 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs border border-white">
                    👑
                  </div>
                ) : pStats?.tournamentsWon > 0 ? (
                  <div className="absolute -top-1.5 -right-1 bg-amber-400 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs border border-white">
                    🏆
                  </div>
                ) : pStats?.woodenSpoons > 0 ? (
                  <div className="absolute -top-1.5 -right-1 bg-rose-400 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs border border-white">
                    🥄
                  </div>
                ) : null}

                <div className="w-12 h-12 relative flex items-center justify-center">
                  <AvatarSVG type={player.avatar} size={46} />
                </div>

                <span
                  className={`text-[11px] mt-1.5 truncate max-w-[62px] ${
                    isSelected ? "font-black text-white" : "font-bold text-slate-700"
                  }`}
                >
                  {player.name}
                </span>

                <span className="text-[10px] mt-0.5">
                  {lore?.badgeEmoji || "🏸"}
                </span>

                {isSelected && (
                  <motion.div
                    layoutId="active-player-dot"
                    className="w-1.5 h-1.5 bg-white rounded-full mt-1"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-5 space-y-4 mt-1">
        {/* Hero Player Card */}
        <div className="rounded-[32px] p-5 bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-white border border-indigo-100/90 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden">
          {/* Ambient blur */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-purple-200/30 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start gap-4">
            {/* Big Avatar with Rank Pill */}
            <div className="w-20 h-20 rounded-[26px] bg-white border border-indigo-100/90 p-2 flex items-center justify-center flex-shrink-0 shadow-sm relative">
              <AvatarSVG type={activeLore.avatar} size={64} />
              <div className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-slate-950 text-white text-[10px] font-black shadow-xs">
                #{currentRank}
              </div>
            </div>

            {/* Identity Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-slate-900 font-black text-2xl tracking-tight leading-none truncate">
                  {activeLore.name}
                </h2>
                <span className="text-lg">{activeLore.badgeEmoji}</span>
              </div>

              <p className="text-indigo-600 font-extrabold text-xs mt-1 truncate">
                {activeLore.title}
              </p>

              {/* Origin, Day Champ, Trophy & Win Rate Chips */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/90 border border-slate-200/80 text-[10px] font-bold text-slate-600 shadow-xs">
                  {activeLore.origin}
                </span>
                {activeStats.dayWins > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-[10px] font-black text-amber-950 shadow-xs">
                    👑 {activeStats.dayWins} Day Champ
                  </span>
                )}
                {activeStats.tournamentsWon > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100/80 border border-amber-300/80 text-[10px] font-black text-amber-900 shadow-xs">
                    🏆 {activeStats.tournamentsWon} Finals
                  </span>
                )}
                {activeStats.woodenSpoons > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100/80 border border-rose-300/80 text-[10px] font-black text-rose-900 shadow-xs">
                    🥄 {activeStats.woodenSpoons} Spoons
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100/80 border border-indigo-200/70 text-[10px] font-black text-indigo-800 shadow-xs">
                  📈 {winRate}% WR
                </span>
              </div>
            </div>
          </div>

          {/* Full Player Tagline Quote - Never Truncated */}
          <div className="mt-3.5 pt-3 border-t border-indigo-100/70">
            <p className="text-xs font-semibold text-slate-700 italic leading-relaxed">
              &ldquo;{activeLore.tagline}&rdquo;
            </p>
          </div>
        </div>

        {/* Section Segmented Pill Switcher */}
        <div className="flex gap-1.5 p-1 bg-white rounded-full border border-slate-200/80 shadow-xs">
          <button
            onClick={() => setActiveProfileTab("dossier")}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeProfileTab === "dossier"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>🔥</span>
            <span>Dossier</span>
          </button>
          <button
            onClick={() => setActiveProfileTab("vibes")}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeProfileTab === "vibes"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>💬</span>
            <span>Vibes</span>
          </button>
          <button
            onClick={() => setActiveProfileTab("stats")}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeProfileTab === "stats"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>📊</span>
            <span>Stats &amp; H2H</span>
          </button>
        </div>

        {/* Dynamic Tab Content with Smooth Transitions */}
        <AnimatePresence mode="wait">
          {activeProfileTab === "dossier" && (
            <motion.div
              key="dossier-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3.5"
            >
              {/* Scouting Dossier & Roast Card */}
              <div className="rounded-[28px] bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60">
                    <span>🔥</span>
                    <span>Scouting Dossier &amp; Roast</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono italic">Confidential</span>
                </div>
                <p className="text-slate-700 text-sm leading-relaxed font-normal">
                  {activeLore.roastBio}
                </p>
              </div>

              {/* Playstyle & Kryptonite Bento Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[24px] bg-indigo-50/70 border border-indigo-100/90 p-4 space-y-1.5">
                  <p className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                    ⚡ Playstyle
                  </p>
                  <p className="text-slate-900 font-black text-xs leading-snug">
                    {activeLore.playstyle}
                  </p>
                </div>
                <div className="rounded-[24px] bg-rose-50/70 border border-rose-100/90 p-4 space-y-1.5">
                  <p className="text-[10px] font-black text-rose-700 uppercase tracking-wider">
                    🎯 Kryptonite
                  </p>
                  <p className="text-slate-700 font-semibold text-xs leading-snug">
                    {activeLore.weakness}
                  </p>
                </div>
              </div>

              {/* Signature Technique Highlight */}
              <div className="rounded-[24px] bg-gradient-to-r from-purple-50 via-pink-50 to-amber-50/50 border border-purple-100/80 p-4 flex items-center gap-3.5 shadow-xs">
                <div className="w-10 h-10 rounded-2xl bg-white border border-purple-100 flex items-center justify-center flex-shrink-0 text-lg shadow-xs">
                  ✨
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] uppercase font-black text-purple-700 tracking-wider">
                    Signature Technique
                  </p>
                  <p className="text-xs font-black text-slate-900 mt-0.5 truncate">
                    {activeLore.specialMove}
                  </p>
                </div>
              </div>

              {/* Court Skill Radar / Pentagon Attributes Card */}
              <div className="rounded-[28px] bg-white border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🕸️</span>
                      <h3 className="text-slate-900 font-black text-sm">Court Skill Radar</h3>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      5-axis attribute radar calibrated from official match performance
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/70 text-indigo-900 font-black text-xs font-mono shadow-2xs">
                    <span className="text-[10px] text-indigo-500 font-bold uppercase">OVR</span>
                    <span className="text-sm font-black text-indigo-700">{playerRadarStats.overallRating}</span>
                  </div>
                </div>

                {/* SVG Pentagon Visualization & Stat Bars */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                  <div className="w-[280px] h-[260px] flex items-center justify-center relative shrink-0">
                    <svg viewBox="0 0 280 260" className="w-full h-full overflow-visible">
                      <defs>
                        <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
                        </radialGradient>
                      </defs>

                      {/* Concentric Grid Pentagons */}
                      {playerRadarStats.gridPolygons.map((pts, idx) => (
                        <polygon
                          key={idx}
                          points={pts}
                          fill="none"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray={idx < 3 ? "2 2" : undefined}
                        />
                      ))}

                      {/* Axis Spoke Lines */}
                      {playerRadarStats.axes.map((axis, idx) => {
                        const angle = -Math.PI / 2 + idx * ((2 * Math.PI) / 5);
                        return (
                          <line
                            key={idx}
                            x1={playerRadarStats.cx}
                            y1={playerRadarStats.cy}
                            x2={playerRadarStats.cx + playerRadarStats.radius * Math.cos(angle)}
                            y2={playerRadarStats.cy + playerRadarStats.radius * Math.sin(angle)}
                            stroke="#e2e8f0"
                            strokeWidth="1"
                          />
                        );
                      })}

                      {/* Player Data Polygon */}
                      <polygon
                        points={playerRadarStats.polygonPoints}
                        fill="url(#radar-glow)"
                        stroke="#6366f1"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />

                      {/* Vertex Dots */}
                      {playerRadarStats.axes.map((pt, idx) => (
                        <circle
                          key={idx}
                          cx={pt.x}
                          cy={pt.y}
                          r="4"
                          fill="#4f46e5"
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                      ))}

                      {/* Vertex Labels */}
                      {playerRadarStats.axes.map((pt, idx) => (
                        <g key={`lbl-${idx}`} transform={`translate(${pt.labelX}, ${pt.labelY})`}>
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="fill-slate-800"
                            style={{ fontSize: "10px", fontWeight: 800 }}
                          >
                            {pt.emoji} {pt.label}
                          </text>
                          <text
                            y="11"
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="fill-indigo-600 font-mono"
                            style={{ fontSize: "9px", fontWeight: 900 }}
                          >
                            {pt.value}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>

                  {/* Attribute Progress Bars */}
                  <div className="w-full space-y-2">
                    {playerRadarStats.axes.map((stat, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center justify-between text-xs"
                      >
                        <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                          <span>{stat.emoji}</span>
                          <span>{stat.label}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600"
                              style={{ width: `${stat.value}%` }}
                            />
                          </div>
                          <span className="font-mono font-black text-slate-900 text-xs w-6 text-right">
                            {stat.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeProfileTab === "vibes" && (
            <motion.div
              key="vibes-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3.5"
            >
              {/* Interactive Speech Bubble Card */}
              <div className="rounded-[30px] bg-white border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{activeLore.badgeEmoji}</span>
                    <span className="text-xs font-black text-slate-900">
                      {activeLore.name} on the record:
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono font-medium">
                    {activeMoodTab === "courtMood"
                      ? "🏸 Court Vibe"
                      : activeMoodTab === "dailyRoast"
                      ? "🍕 Daily Life"
                      : "😤 Excuse"}
                  </span>
                </div>

                {/* Mood Switcher Pills */}
                <div className="flex gap-1.5 p-1 bg-slate-100/80 rounded-full">
                  <button
                    onClick={() => setActiveMoodTab("courtMood")}
                    className={`flex-1 py-1.5 px-2 rounded-full text-[11px] font-black transition-all ${
                      activeMoodTab === "courtMood"
                        ? "bg-slate-950 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    🏸 On Court
                  </button>
                  <button
                    onClick={() => setActiveMoodTab("dailyRoast")}
                    className={`flex-1 py-1.5 px-2 rounded-full text-[11px] font-black transition-all ${
                      activeMoodTab === "dailyRoast"
                        ? "bg-slate-950 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    🍕 Daily Roast
                  </button>
                  <button
                    onClick={() => setActiveMoodTab("excuse")}
                    className={`flex-1 py-1.5 px-2 rounded-full text-[11px] font-black transition-all ${
                      activeMoodTab === "excuse"
                        ? "bg-slate-950 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    😤 Excuse
                  </button>
                </div>

                {/* The Speech Bubble */}
                <div className="relative p-5 rounded-[26px] bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-white border border-indigo-100/90 shadow-inner">
                  <span className="text-2xl text-indigo-300 font-serif leading-none select-none block -mb-1">
                    “
                  </span>
                  <p className="text-slate-800 text-sm font-bold leading-relaxed italic">
                    {activeLore.vibeQuotes[activeMoodTab]}
                  </p>
                  <p className="text-right text-[10px] text-slate-400 font-mono mt-2">
                    — {activeLore.name},{" "}
                    {activeMoodTab === "courtMood"
                      ? "Courtside"
                      : activeMoodTab === "dailyRoast"
                      ? "Daily Reality"
                      : "Post-Match"}
                  </p>
                </div>
              </div>

              {/* Certified Scouting Attributes */}
              <div className="rounded-[28px] bg-white border border-slate-200/80 p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">
                    Scouting Attributes (100% Certified)
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono">Radar Spec</span>
                </div>

                <div className="space-y-3">
                  {activeLore.funStats.map((stat, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-800">{stat.label}</span>
                        <span className="text-slate-500 font-mono text-[11px]">{stat.value}%</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
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
            </motion.div>
          )}

          {activeProfileTab === "stats" && (
            <motion.div
              key="stats-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3.5"
            >
              {/* Career Performance Grid Card */}
              <div className="rounded-[30px] bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">
                      Career Performance Record
                    </p>
                    <p className="text-slate-900 font-extrabold text-xs mt-0.5">
                      Tournament &amp; Match Standings
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-full font-bold">
                    Squad Rank #{currentRank}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Card 1: 👑 Day Champions */}
                  <div className="p-3.5 rounded-[22px] bg-gradient-to-br from-amber-100/90 via-amber-50 to-white border border-amber-300 text-center shadow-2xs relative overflow-hidden">
                    <span className="absolute top-1.5 right-1.5 text-xs">👑</span>
                    <p className="text-amber-950 font-black text-2xl leading-tight font-mono">
                      {activeStats.dayWins}
                    </p>
                    <p className="text-[10px] text-amber-900 font-black mt-0.5">👑 Day Champ</p>
                    <p className="text-[9px] text-amber-700/80">Daily 1st Place</p>
                  </div>

                  {/* Card 2: 🏆 Titles Won */}
                  <div className="p-3.5 rounded-[22px] bg-amber-50/70 border border-amber-200/60 text-center">
                    <p className="text-amber-900 font-black text-2xl leading-tight font-mono">
                      {activeStats.tournamentsWon}
                    </p>
                    <p className="text-[10px] text-amber-800 font-bold mt-0.5">🏆 Titles Won</p>
                    <p className="text-[9px] text-amber-700/70">Finals Champion</p>
                  </div>

                  {/* Card 3: 🥄 Day Spoons */}
                  <div className="p-3.5 rounded-[22px] bg-rose-50/70 border border-rose-200/60 text-center">
                    <p className="text-rose-800 font-black text-2xl leading-tight font-mono">
                      {activeStats.woodenSpoons}
                    </p>
                    <p className="text-[10px] text-rose-800 font-bold mt-0.5">🥄 Day Spoons</p>
                    <p className="text-[9px] text-rose-600/70">Official Day Last</p>
                  </div>

                  {/* Card 4: 📈 Win Rate */}
                  <div className="p-3.5 rounded-[22px] bg-emerald-50/70 border border-emerald-200/60 text-center">
                    <p className="text-emerald-800 font-black text-2xl leading-tight font-mono">
                      {winRate}%
                    </p>
                    <p className="text-[10px] text-emerald-800 font-bold mt-0.5">📈 Win Rate</p>
                    <p className="text-[9px] text-emerald-600/70">
                      {activeStats.wins}W - {activeStats.losses}L
                    </p>
                  </div>

                  {/* Card 5: ⭐ Day Points */}
                  <div className="p-3.5 rounded-[22px] bg-indigo-50/70 border border-indigo-200/60 text-center">
                    <p className="text-indigo-900 font-black text-2xl leading-tight font-mono">
                      {activeStats.dayPointsTotal}
                    </p>
                    <p className="text-[10px] text-indigo-800 font-bold mt-0.5">⭐ Day Points</p>
                    <p className="text-[9px] text-indigo-600/70">Official Placement Pts</p>
                  </div>

                  {/* Card 6: 🎯 Match Points */}
                  <div className="p-3.5 rounded-[22px] bg-blue-50/70 border border-blue-200/60 text-center">
                    <p className="text-blue-900 font-black text-2xl leading-tight font-mono">
                      {activeStats.leaguePoints}
                    </p>
                    <p className="text-[10px] text-blue-800 font-bold mt-0.5">🎯 Match Points</p>
                    <p className="text-[9px] text-blue-600/70">2-3 Pts Game Score</p>
                  </div>

                  {/* Card 7: 🏸 Total Matches */}
                  <div className="p-3.5 rounded-[22px] bg-slate-50 border border-slate-200/70 text-center">
                    <p className="text-slate-900 font-black text-2xl leading-tight font-mono">
                      {activeStats.matchesPlayed}
                    </p>
                    <p className="text-[10px] text-slate-700 font-bold mt-0.5">🏸 Total Matches</p>
                    <p className="text-[9px] text-slate-500">
                      Diff: {activeStats.pointDiff >= 0 ? `+${activeStats.pointDiff}` : activeStats.pointDiff}
                    </p>
                  </div>

                  {/* Card 8: ⚡ Shutout Ratio */}
                  <div className="p-3.5 rounded-[22px] bg-purple-50/70 border border-purple-200/60 text-center">
                    <p className="text-purple-900 font-black text-2xl leading-tight font-mono">
                      {activeStats.shutsDelivered} : {activeStats.shutsReceived}
                    </p>
                    <p className="text-[10px] text-purple-800 font-bold mt-0.5">⚡ Shutouts</p>
                    <p className="text-[9px] text-purple-600/70">Delivered : Conceded</p>
                  </div>
                </div>
              </div>

              {/* Historical Session Trend Sparkline Card */}
              <div className="rounded-[30px] bg-white border border-slate-200/80 p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">📈</span>
                      <h3 className="text-slate-900 font-black text-xs">Session-by-Session Trajectory</h3>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Day Points earned across each court meet
                    </p>
                  </div>
                  {playerSessionTrends.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        Peak: {Math.max(0, ...playerSessionTrends.map((s) => s.points))} pts
                      </span>
                    </div>
                  )}
                </div>

                {playerSessionTrends.length >= 2 ? (
                  <div className="space-y-3">
                    <div className="w-full h-28 relative">
                      <svg viewBox="0 0 320 90" className="w-full h-full overflow-visible">
                        <defs>
                          <linearGradient id="trend-gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Baseline Guides */}
                        <line x1="20" y1="70" x2="300" y2="70" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                        <line x1="20" y1="20" x2="300" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />

                        {(() => {
                          const maxPts = Math.max(1, ...playerSessionTrends.map((s) => s.points));
                          const n = playerSessionTrends.length;
                          const coords = playerSessionTrends.map((s, idx) => {
                            const x = 20 + (idx / (n - 1)) * 280;
                            const y = 70 - (s.points / maxPts) * 50;
                            return { ...s, x, y };
                          });

                          const pathData = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "");
                          const areaData = `${pathData} L ${coords[coords.length - 1].x} 70 L ${coords[0].x} 70 Z`;

                          return (
                            <>
                              {/* Area fill */}
                              <path d={areaData} fill="url(#trend-gradient)" />

                              {/* Stroke line */}
                              <path
                                d={pathData}
                                fill="none"
                                stroke="#6366f1"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />

                              {/* Data nodes */}
                              {coords.map((pt, i) => (
                                <g key={i}>
                                  <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={pt.isTop || pt.isSpoon ? "5" : "3.5"}
                                    fill={pt.isTop ? "#f59e0b" : pt.isSpoon ? "#f43f5e" : "#4f46e5"}
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                  />
                                  {/* Value bubble above */}
                                  <text
                                    x={pt.x}
                                    y={pt.y - 7}
                                    textAnchor="middle"
                                    className="fill-slate-700 font-mono"
                                    style={{ fontSize: "8px", fontWeight: 800 }}
                                  >
                                    {pt.points}
                                  </text>
                                  {/* Session date label below */}
                                  <text
                                    x={pt.x}
                                    y="84"
                                    textAnchor="middle"
                                    className="fill-slate-400 font-mono"
                                    style={{ fontSize: "7px", fontWeight: 700 }}
                                  >
                                    {pt.date.length > 5 ? pt.date.slice(-5) : pt.date}
                                  </text>
                                </g>
                              ))}
                            </>
                          );
                        })()}
                      </svg>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span className="flex items-center gap-1 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Crown Meet
                      </span>
                      <span className="flex items-center gap-1 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Spoon Meet
                      </span>
                      <span className="font-mono font-bold text-slate-700">
                        {playerSessionTrends.length} Completed Sessions
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 text-center">
                    <p className="text-xs font-bold text-slate-600">
                      {playerSessionTrends.length === 1
                        ? `Session record: ${playerSessionTrends[0].points} Day Points earned`
                        : "Session trajectory will populate as daily tables are completed"}
                    </p>
                  </div>
                )}
              </div>

              {/* Finals & Clutch Performance Hub */}
              <div className="rounded-[30px] bg-white border border-slate-200/80 p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">
                      Clutch &amp; Finals Intelligence
                    </p>
                    <p className="text-slate-900 font-extrabold text-xs mt-0.5">
                      Pressure Index &amp; Momentum
                    </p>
                  </div>
                  <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                    Clutch Factor
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Card 1: Finals Record */}
                  <div className="p-3.5 rounded-[22px] bg-gradient-to-br from-amber-500/10 via-amber-50/50 to-white border border-amber-200/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-full">
                        🏆 Finals Record
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-800">
                        {activeStats.finalsPlayed > 0
                          ? `${Math.round((activeStats.tournamentsWon / activeStats.finalsPlayed) * 100)}% WR`
                          : "0%"}
                      </span>
                    </div>
                    <div className="my-2">
                      <p className="text-2xl font-black text-slate-900 font-mono">
                        {activeStats.tournamentsWon}W - {activeStats.finalsLost}L
                      </p>
                      <p className="text-[11px] font-bold text-amber-950 mt-0.5">
                        {activeStats.finalsPlayed} Championship Finals
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {activeStats.finalsPlayed === 0
                        ? "Has not reached a final yet"
                        : activeStats.tournamentsWon > 0 && activeStats.finalsLost === 0
                        ? "🔥 Undefeated in Championship Finals"
                        : activeStats.finalsLost > activeStats.tournamentsWon
                        ? `💔 ${activeStats.finalsLost} Heartbreak Runner-up finishes`
                        : "🏆 Proven Finals Champion"}
                    </p>
                  </div>

                  {/* Card 2: 1-Point Deciders (Cardiac Rating) */}
                  <div className="p-3.5 rounded-[22px] bg-gradient-to-br from-rose-500/10 via-rose-50/50 to-white border border-rose-200/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-900 bg-rose-100/80 px-2 py-0.5 rounded-full">
                        💓 1-Pt Thrillers
                      </span>
                      <span className="text-xs font-mono font-bold text-rose-800">
                        {activeStats.clutchMatches > 0
                          ? `${Math.round((activeStats.clutchWins / activeStats.clutchMatches) * 100)}% WR`
                          : "0%"}
                      </span>
                    </div>
                    <div className="my-2">
                      <p className="text-2xl font-black text-slate-900 font-mono">
                        {activeStats.clutchWins}W - {activeStats.clutchLosses}L
                      </p>
                      <p className="text-[11px] font-bold text-rose-950 mt-0.5">
                        {activeStats.clutchMatches} Matches Decided by 1 Pt
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {activeStats.clutchMatches === 0
                        ? "No 1-point thriller games played"
                        : activeStats.clutchWins >= activeStats.clutchLosses
                        ? "🧊 Ice in the veins in pressure cookers"
                        : "⚠️ Tendency to slip in 5-4 / 6-5 nailbiters"}
                    </p>
                  </div>

                  {/* Card 3: Form & Momentum Pulse */}
                  <div className="p-3.5 rounded-[22px] bg-gradient-to-br from-emerald-500/10 via-emerald-50/50 to-white border border-emerald-200/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                        🔥 Momentum Pulse
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-800">
                        {activeStats.currentStreak?.count > 0
                          ? activeStats.currentStreak.type === "W"
                            ? `🔥 ${activeStats.currentStreak.count}W Streak`
                            : `❄️ ${activeStats.currentStreak.count}L Streak`
                          : "Neutral"}
                      </span>
                    </div>
                    <div className="my-2">
                      <div className="flex items-center gap-1.5">
                        {activeStats.recentForm && activeStats.recentForm.length > 0 ? (
                          activeStats.recentForm.map((res, i) => (
                            <span
                              key={i}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-2xs ${
                                res === "W"
                                  ? "bg-emerald-600 text-white"
                                  : "bg-rose-500 text-white"
                              }`}
                            >
                              {res}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">No recent matches</span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-emerald-950 mt-1">
                        Last 5 Matches (Recent → Older)
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">
                      🚀 Career-Best: {activeStats.longestWinStreak} Consecutive Wins
                    </p>
                  </div>
                </div>
              </div>

              {/* Rivalry & Head-to-Head Matrix Hub */}
              <div className="rounded-[30px] bg-white border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">
                      Rivalry Matrix &amp; Final Face-Offs
                    </p>
                    <p className="text-slate-900 font-extrabold text-xs mt-0.5">
                      Complete Head-to-Head Squad Table
                    </p>
                  </div>
                  <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2.5 py-0.5 rounded-full font-bold">
                    Tap Row for Matchup
                  </span>
                </div>

                {/* Bunny & Nemesis Highlights */}
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
                      <p className="text-slate-400 text-[10px] mt-1 italic font-medium">
                        No victims recorded
                      </p>
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
                      <p className="text-slate-400 text-[10px] mt-1 italic font-medium">
                        Undefeated against all
                      </p>
                    )}
                  </div>
                </div>

                {/* Comprehensive Table Container */}
                <div className="overflow-x-auto no-scrollbar rounded-2xl border border-slate-200/80">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <th className="py-2.5 pl-3 pr-2">Opponent</th>
                        <th className="py-2.5 px-2 text-center">Record</th>
                        <th className="py-2.5 px-2 text-center">🏆 Finals</th>
                        <th className="py-2.5 px-2 text-center">⚡/🛡️ Shutouts</th>
                        <th className="py-2.5 px-2 text-center">Diff</th>
                        <th className="py-2.5 pr-3 pl-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {FIXED_PLAYERS.filter((p) => p.id !== selectedPlayerId).map((opp) => {
                        const rec = activeStats.h2h?.[opp.id] || {
                          played: 0,
                          won: 0,
                          lost: 0,
                          finalsPlayed: 0,
                          finalsWon: 0,
                          finalsLost: 0,
                          shutsDelivered: 0,
                          shutsReceived: 0,
                          pointsFor: 0,
                          pointsAgainst: 0,
                        };
                        const oppWr = rec.played > 0 ? Math.round((rec.won / rec.played) * 100) : 0;
                        const netMargin = rec.pointsFor - rec.pointsAgainst;
                        const isExpanded = selectedOpponentH2H === opp.id;

                        // Relationship Status Tag
                        const isBunny = rec.played >= 2 && oppWr >= 65;
                        const isNemesis = rec.played >= 2 && oppWr <= 35;

                        return (
                          <React.Fragment key={opp.id}>
                            <tr
                              onClick={() => setSelectedOpponentH2H(isExpanded ? null : opp.id)}
                              className={`cursor-pointer transition-colors ${
                                isExpanded
                                  ? "bg-indigo-50/70"
                                  : "hover:bg-slate-50/80"
                              }`}
                            >
                              {/* Opponent */}
                              <td className="py-2.5 pl-3 pr-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center shadow-xs shrink-0">
                                    <AvatarSVG type={opp.avatar} size={18} />
                                  </span>
                                  <span className="font-extrabold text-xs text-slate-900 truncate">
                                    {opp.name}
                                  </span>
                                </div>
                              </td>

                              {/* Overall Record */}
                              <td className="py-2.5 px-2 text-center font-mono">
                                {rec.played > 0 ? (
                                  <div>
                                    <span className="font-black text-emerald-700">{rec.won}W</span>
                                    <span className="text-slate-300 mx-0.5">-</span>
                                    <span className="font-black text-rose-600">{rec.lost}L</span>
                                    <span className="text-[10px] text-slate-400 block">{oppWr}%</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-medium">0 - 0</span>
                                )}
                              </td>

                              {/* Final Face-Offs */}
                              <td className="py-2.5 px-2 text-center">
                                {rec.finalsPlayed > 0 ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-100/90 text-amber-900 border border-amber-300/80 text-[10px] font-black shadow-2xs font-mono">
                                    <span>🏆</span>
                                    <span>{rec.finalsWon}W - {rec.finalsLost}L</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-mono text-[11px]">—</span>
                                )}
                              </td>

                              {/* Shutouts Delivered vs Received */}
                              <td className="py-2.5 px-2 text-center">
                                {rec.shutsDelivered > 0 || rec.shutsReceived > 0 ? (
                                  <div className="flex items-center justify-center gap-1 font-mono text-[10px]">
                                    {rec.shutsDelivered > 0 && (
                                      <span
                                        title={`${rec.shutsDelivered} blowouts delivered`}
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-bold"
                                      >
                                        <span>⚡</span>
                                        <span>{rec.shutsDelivered}</span>
                                      </span>
                                    )}
                                    {rec.shutsReceived > 0 && (
                                      <span
                                        title={`${rec.shutsReceived} blowouts conceded`}
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-900 border border-rose-200 font-bold"
                                      >
                                        <span>🛡️</span>
                                        <span>{rec.shutsReceived}</span>
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-[11px]">—</span>
                                )}
                              </td>

                              {/* Net Margin */}
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-[11px]">
                                {rec.played > 0 ? (
                                  <span className={netMargin > 0 ? "text-emerald-700" : netMargin < 0 ? "text-rose-600" : "text-slate-400"}>
                                    {netMargin > 0 ? `+${netMargin}` : netMargin}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">0</span>
                                )}
                              </td>

                              {/* Dynamic Relationship Tag */}
                              <td className="py-2.5 pr-3 pl-2 text-right">
                                {isBunny ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 text-[9px] font-black">
                                    🐰 Bunny
                                  </span>
                                ) : isNemesis ? (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-100/80 text-rose-800 text-[9px] font-black">
                                    😈 Nemesis
                                  </span>
                                ) : rec.played > 0 ? (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-bold">
                                    ⚔️ Rival
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">Unplayed</span>
                                )}
                              </td>
                            </tr>

                            {/* Expandable Drill-Down Row */}
                            {isExpanded && (
                              <tr className="bg-indigo-50/40">
                                <td colSpan={6} className="p-3">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
                                    <div className="p-2 rounded-xl bg-white border border-indigo-100 shadow-2xs">
                                      <span className="text-[9px] uppercase font-bold text-slate-400 block">
                                        Total Head-to-Head
                                      </span>
                                      <span className="font-black text-slate-800 font-mono">
                                        {rec.played} Matches ({oppWr}% Win)
                                      </span>
                                    </div>
                                    <div className="p-2 rounded-xl bg-white border border-indigo-100 shadow-2xs">
                                      <span className="text-[9px] uppercase font-bold text-slate-400 block">
                                        Championship Finals
                                      </span>
                                      <span className="font-black text-amber-700 font-mono">
                                        {rec.finalsPlayed > 0 ? `${rec.finalsWon}W - ${rec.finalsLost}L in Finals` : "Never met in Finals"}
                                      </span>
                                    </div>
                                    <div className="p-2 rounded-xl bg-white border border-indigo-100 shadow-2xs">
                                      <span className="text-[9px] uppercase font-bold text-slate-400 block">
                                        Points Aggregate
                                      </span>
                                      <span className="font-black text-slate-800 font-mono">
                                        {rec.pointsFor} - {rec.pointsAgainst}
                                      </span>
                                    </div>
                                    <div className="p-2 rounded-xl bg-white border border-indigo-100 shadow-2xs">
                                      <span className="text-[9px] uppercase font-bold text-slate-400 block">
                                        Blowout Margin
                                      </span>
                                      <span className="font-black text-indigo-700 font-mono">
                                        {rec.shutsDelivered} delivered / {rec.shutsReceived} conceded
                                      </span>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dedicated Shutout Intelligence Dossier */}
              <div className="rounded-[28px] bg-white border border-slate-200/80 p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">⚡</span>
                      <h3 className="text-slate-900 font-black text-sm">Shutout Intelligence</h3>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      3-pt bonus wins (margin ≥4) &amp; Championship final blowouts
                    </p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60 font-mono">
                    Margin ≥ 4
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Card 1: Shuts Delivered (Shutting) */}
                  <button
                    onClick={() => setShutoutModalType("delivered")}
                    className="text-left rounded-[24px] bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-transparent border border-amber-200/80 hover:border-amber-400/90 p-4 transition-all active:scale-[0.98] shadow-xs hover:shadow-md group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                          <span>⚡</span>
                          <span>Shutting</span>
                        </span>
                        <span className="text-xs text-amber-600 font-bold group-hover:translate-x-0.5 transition-transform">
                          →
                        </span>
                      </div>
                      <p className="text-3xl font-black text-slate-900 font-mono mt-2.5 tracking-tight">
                        {activeStats.shutsDelivered}
                      </p>
                      <p className="text-xs font-black text-amber-950 mt-1">
                        Shuts Delivered
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">
                        Times {activeLore.name} handed out a blowout
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-amber-200/50 flex items-center justify-between text-[10px] font-bold text-amber-800">
                      <span>Breakdown</span>
                      <span className="underline">View who shut →</span>
                    </div>
                  </button>

                  {/* Card 2: Times Shut Out (Shutted) */}
                  <button
                    onClick={() => setShutoutModalType("received")}
                    className="text-left rounded-[24px] bg-gradient-to-br from-rose-500/10 via-rose-400/5 to-transparent border border-rose-200/80 hover:border-rose-400/90 p-4 transition-all active:scale-[0.98] shadow-xs hover:shadow-md group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded-full">
                          <span>🛡️</span>
                          <span>Shutted</span>
                        </span>
                        <span className="text-xs text-rose-600 font-bold group-hover:translate-x-0.5 transition-transform">
                          →
                        </span>
                      </div>
                      <p className="text-3xl font-black text-slate-900 font-mono mt-2.5 tracking-tight">
                        {activeStats.shutsReceived}
                      </p>
                      <p className="text-xs font-black text-rose-950 mt-1">
                        Times Shut Out
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">
                        Blowout losses conceded to squad
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-rose-200/50 flex items-center justify-between text-[10px] font-bold text-rose-800">
                      <span>Breakdown</span>
                      <span className="underline">View who shut →</span>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Squad Hall of Fame Quick Link */}
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

      {/* Interactive Shutout Drill-Down Modal */}
      <AnimatePresence>
        {shutoutModalType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setShutoutModalType(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              transition={{ type: "spring", duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[32px] p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">
                    {shutoutModalType === "delivered" ? "⚡" : "🛡️"}
                  </span>
                  <div>
                    <h3 className="text-slate-900 font-black text-base leading-tight">
                      {shutoutModalType === "delivered"
                        ? `Shuts Delivered by ${activeLore.name}`
                        : `Times ${activeLore.name} Was Shut Out`}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {shutoutModalType === "delivered"
                        ? `${activeStats.shutsDelivered} total clean blowouts delivered against opponents`
                        : `${activeStats.shutsReceived} total blowout losses suffered from opponents`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShutoutModalType(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Opponents List */}
              <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
                {FIXED_PLAYERS.filter((p) => p.id !== selectedPlayerId)
                  .map((opp) => {
                    const rec = activeStats.h2h?.[opp.id] || {
                      played: 0,
                      won: 0,
                      lost: 0,
                      shutsDelivered: 0,
                      shutsReceived: 0,
                      regularShutsDelivered: 0,
                      finalShutsDelivered: 0,
                      regularShutsReceived: 0,
                      finalShutsReceived: 0,
                    };
                    const count =
                      shutoutModalType === "delivered"
                        ? rec.shutsDelivered
                        : rec.shutsReceived;
                    const regularCount =
                      shutoutModalType === "delivered"
                        ? rec.regularShutsDelivered
                        : rec.regularShutsReceived;
                    const finalCount =
                      shutoutModalType === "delivered"
                        ? rec.finalShutsDelivered
                        : rec.finalShutsReceived;

                    return { opp, count, regularCount, finalCount, rec };
                  })
                  .sort((a, b) => b.count - a.count || b.rec.played - a.rec.played)
                  .map(({ opp, count, regularCount, finalCount, rec }) => (
                    <div
                      key={opp.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        count > 0
                          ? shutoutModalType === "delivered"
                            ? "bg-amber-50/50 border-amber-200/70"
                            : "bg-rose-50/50 border-rose-200/70"
                          : "bg-slate-50/60 border-slate-200/60 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shadow-xs">
                            <AvatarSVG type={opp.avatar} size={22} />
                          </span>
                          <div>
                            <p className="font-extrabold text-xs text-slate-900 leading-tight">
                              {shutoutModalType === "delivered"
                                ? `vs ${opp.name}`
                                : `by ${opp.name}`}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {rec.played} total matches played ({rec.won}W - {rec.lost}L)
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black font-mono shadow-2xs ${
                              count > 0
                                ? shutoutModalType === "delivered"
                                  ? "bg-amber-100 text-amber-900 border border-amber-300/80"
                                  : "bg-rose-100 text-rose-900 border border-rose-300/80"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                          >
                            <span>{shutoutModalType === "delivered" ? "⚡" : "🛡️"}</span>
                            <span>
                              {count} {count === 1 ? "shut" : "shuts"}
                            </span>
                          </span>
                        </div>
                      </div>

                      {count > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-medium text-slate-600">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1">
                              <span className="font-bold text-slate-800">{regularCount}</span>{" "}
                              regular (3 pts)
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <span className="font-bold text-slate-800">{finalCount}</span>{" "}
                              final blowout (≥4)
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-400">
                            {shutoutModalType === "delivered" && activeStats.shutsDelivered > 0
                              ? `${Math.round((count / activeStats.shutsDelivered) * 100)}% of total`
                              : shutoutModalType === "received" && activeStats.shutsReceived > 0
                              ? `${Math.round((count / activeStats.shutsReceived) * 100)}% of total`
                              : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              {/* Footer explaining condition */}
              <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-normal">
                <p>
                  <span className="font-bold text-slate-600">Rule definition:</span> A shutout
                  occurs when a player wins by margin ≥4 earning 3 points in a match, or wins
                  the Championship Final by margin ≥4.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
