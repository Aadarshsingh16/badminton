import { Router } from "express";
import { nanoid } from "nanoid";
import { pool } from "../db/client";
import { requireScorekeeper } from "../middleware/auth";
import { io } from "../index";
import { pointsForMatch, pointsForFinal, TournamentConfig, DEFAULT_CONFIG } from "../lib/scoring";

export const tournamentsRouter = Router();

// Helper to compute tournament standings table
export function computeTable(matches: any[], playerIds: string[], config: TournamentConfig = DEFAULT_CONFIG) {
  const stats: { [id: string]: { points: number; wins: number; matchesPlayed: number; pointDiff: number } } = {};
  const N = playerIds.length;

  for (const id of playerIds) {
    stats[id] = { points: 0, wins: 0, matchesPlayed: 0, pointDiff: 0 };
  }

  // Double elimination table computation
  if (config?.format === "double-elimination") {
    for (const m of matches) {
      const pA = m.playerA || m.player_a;
      const pB = m.playerB || m.player_b;
      const sA = m.scoreA ?? m.score_a;
      const sB = m.scoreB ?? m.score_b;
      if (!m.played || sA === null || sB === null || sA === undefined || sB === undefined) continue;

      if (!stats[pA]) stats[pA] = { points: 0, wins: 0, matchesPlayed: 0, pointDiff: 0 };
      if (!stats[pB]) stats[pB] = { points: 0, wins: 0, matchesPlayed: 0, pointDiff: 0 };

      stats[pA].matchesPlayed++;
      stats[pB].matchesPlayed++;
      stats[pA].pointDiff += sA - sB;
      stats[pB].pointDiff += sB - sA;
      if (sA > sB) stats[pA].wins++;
      if (sB > sA) stats[pB].wins++;
      stats[pA].points += sA > sB ? (config.winPoints ?? 2) : 0;
      stats[pB].points += sB > sA ? (config.winPoints ?? 2) : 0;
    }

    const rankMap: { [pid: string]: number } = {};
    const dayPointsMap: { [pid: string]: number } = {};

    const findM = (key: string) =>
      matches.find(
        (m) =>
          (m.id === `de-${key.toLowerCase()}` ||
            m.bracketRound === key ||
            m.bracket_round === key) &&
          m.played
      );

    const gf = findM("GF") || matches.find((m) => (m.isFinal || m.is_final) && m.played);
    const lf = findM("LF");
    const lr3 = findM("LR3");
    const p56 = findM("P56");
    const p78 = findM("P78");
    const lr1 = findM("LR1");

    const getW = (m: any) => {
      if (!m) return null;
      const pA = m.playerA || m.player_a;
      const pB = m.playerB || m.player_b;
      const sA = m.scoreA ?? m.score_a;
      const sB = m.scoreB ?? m.score_b;
      return sA > sB ? pA : pB;
    };
    const getL = (m: any) => {
      if (!m) return null;
      const pA = m.playerA || m.player_a;
      const pB = m.playerB || m.player_b;
      const sA = m.scoreA ?? m.score_a;
      const sB = m.scoreB ?? m.score_b;
      return sA > sB ? pB : pA;
    };

    const gfW = getW(gf);
    const gfL = getL(gf);
    const lfL = getL(lf);
    const lr3L = getL(lr3);
    const p56W = getW(p56);
    const p56L = getL(p56);
    const p78W = getW(p78);
    const p78L = getL(p78);
    const lr1L = getL(lr1);

    const gfMargin = gf ? Math.abs((gf.scoreA ?? gf.score_a) - (gf.scoreB ?? gf.score_b)) : 0;
    const gfPenalty = gfMargin >= (config.finalBonusMargin ?? DEFAULT_CONFIG.finalBonusMargin);

    const lfMargin = lf ? Math.abs((lf.scoreA ?? lf.score_a) - (lf.scoreB ?? lf.score_b)) : 0;
    const lfPenalty = lfMargin >= (config.bonusMargin ?? DEFAULT_CONFIG.bonusMargin);

    if (N === 8) {
      if (gfW) { rankMap[gfW] = 1; dayPointsMap[gfW] = 8; }
      if (gfL) { rankMap[gfL] = 2; dayPointsMap[gfL] = gfPenalty ? 6 : 7; }
      if (lfL) { rankMap[lfL] = 3; dayPointsMap[lfL] = lfPenalty ? 5 : 6; }
      if (lr3L) { rankMap[lr3L] = 4; dayPointsMap[lr3L] = 5; }
      if (p56W) { rankMap[p56W] = 5; dayPointsMap[p56W] = 4; }
      if (p56L) { rankMap[p56L] = 6; dayPointsMap[p56L] = 3; }
      if (p78W) { rankMap[p78W] = 7; dayPointsMap[p78W] = 2; }
      if (p78L) { rankMap[p78L] = 8; dayPointsMap[p78L] = 1; }
    } else if (N === 7) {
      if (gfW) { rankMap[gfW] = 1; dayPointsMap[gfW] = 7; }
      if (gfL) { rankMap[gfL] = 2; dayPointsMap[gfL] = gfPenalty ? 5 : 6; }
      if (lfL) { rankMap[lfL] = 3; dayPointsMap[lfL] = lfPenalty ? 4 : 5; }
      if (lr3L) { rankMap[lr3L] = 4; dayPointsMap[lr3L] = 4; }
      if (p56W) { rankMap[p56W] = 5; dayPointsMap[p56W] = 3; }
      if (p56L) { rankMap[p56L] = 6; dayPointsMap[p56L] = 2; }
      if (lr1L) { rankMap[lr1L] = 7; dayPointsMap[lr1L] = 1; }
    }

    const unassigned = playerIds.filter((pid) => rankMap[pid] === undefined);
    unassigned.sort((a, b) => {
      if (stats[b].wins !== stats[a].wins) return stats[b].wins - stats[a].wins;
      return stats[b].pointDiff - stats[a].pointDiff;
    });

    const usedRanks = new Set(Object.values(rankMap));
    const availableRanks: number[] = [];
    for (let r = 1; r <= N; r++) {
      if (!usedRanks.has(r)) availableRanks.push(r);
    }

    unassigned.forEach((pid, idx) => {
      const assignedRank = availableRanks[idx] ?? (N - idx);
      rankMap[pid] = assignedRank;
      dayPointsMap[pid] = Math.max(1, N - assignedRank + 1);
    });

    const rows = playerIds.map((pid) => ({
      playerId: pid,
      ...stats[pid],
      dayPoints: dayPointsMap[pid] ?? Math.max(1, N - (rankMap[pid] ?? N) + 1),
      rank: rankMap[pid] ?? N,
    }));

    rows.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return b.pointDiff - a.pointDiff;
    });

    return rows;
  }

  for (const m of matches) {
    if (!m.played || m.isFinal || m.round === -1 || m.scoreA === null || m.scoreB === null) continue;
    const { playerA, playerB, scoreA, scoreB, pointsA, pointsB } = m;

    if (!stats[playerA]) stats[playerA] = { points: 0, wins: 0, matchesPlayed: 0, pointDiff: 0 };
    if (!stats[playerB]) stats[playerB] = { points: 0, wins: 0, matchesPlayed: 0, pointDiff: 0 };

    stats[playerA].matchesPlayed++;
    stats[playerB].matchesPlayed++;
    stats[playerA].pointDiff += scoreA - scoreB;
    stats[playerB].pointDiff += scoreB - scoreA;
    if (scoreA > scoreB) stats[playerA].wins++;
    if (scoreB > scoreA) stats[playerB].wins++;

    stats[playerA].points += pointsA ?? 0;
    stats[playerB].points += pointsB ?? 0;
  }

  const rrRows = Object.entries(stats)
    .map(([playerId, s]) => ({ playerId, ...s }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.pointDiff - a.pointDiff);

  const finalMatch = matches.find((m) => (m.isFinal || m.round === -1) && m.played && m.scoreA !== null && m.scoreB !== null);

  if (finalMatch) {
    const isWinA = finalMatch.scoreA > finalMatch.scoreB;
    const winnerId = isWinA ? finalMatch.playerA : finalMatch.playerB;
    const loserId = isWinA ? finalMatch.playerB : finalMatch.playerA;

    const winScore = Math.max(finalMatch.scoreA, finalMatch.scoreB);
    const loseScore = Math.min(finalMatch.scoreA, finalMatch.scoreB);
    const margin = winScore - loseScore;
    const bonusMargin = config?.finalBonusMargin ?? DEFAULT_CONFIG.finalBonusMargin;
    const hasPenalty = margin >= bonusMargin;

    const dayPointsMap: { [id: string]: number } = {};
    dayPointsMap[winnerId] = N;
    dayPointsMap[loserId] = hasPenalty ? Math.max(1, N - 2) : Math.max(1, N - 1);

    const nonFinalists = rrRows.filter((r) => r.playerId !== winnerId && r.playerId !== loserId);
    nonFinalists.forEach((r, idx) => {
      dayPointsMap[r.playerId] = Math.max(1, N - 2 - idx);
    });

    if (stats[finalMatch.playerA]) {
      stats[finalMatch.playerA].matchesPlayed++;
      stats[finalMatch.playerA].pointDiff += finalMatch.scoreA - finalMatch.scoreB;
      if (finalMatch.scoreA > finalMatch.scoreB) stats[finalMatch.playerA].wins++;
    }
    if (stats[finalMatch.playerB]) {
      stats[finalMatch.playerB].matchesPlayed++;
      stats[finalMatch.playerB].pointDiff += finalMatch.scoreB - finalMatch.scoreA;
      if (finalMatch.scoreB > finalMatch.scoreA) stats[finalMatch.playerB].wins++;
    }

    const rows = Object.entries(stats).map(([playerId, s]) => ({
      playerId,
      ...s,
      dayPoints: dayPointsMap[playerId] ?? 0,
      rank: 0,
    }));

    rows.sort((a, b) => {
      const dayA = dayPointsMap[a.playerId] ?? 0;
      const dayB = dayPointsMap[b.playerId] ?? 0;
      if (dayB !== dayA) return dayB - dayA;

      const aIsFinalist = a.playerId === winnerId || a.playerId === loserId;
      const bIsFinalist = b.playerId === winnerId || b.playerId === loserId;
      if (aIsFinalist && !bIsFinalist) return -1;
      if (!aIsFinalist && bIsFinalist) return 1;

      if (b.points !== a.points) return b.points - a.points;
      return b.pointDiff - a.pointDiff;
    });

    rows.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return rows;
  }

  const hasPlayedMatches = matches.some((m) => m.played && m.scoreA !== null && m.scoreB !== null);

  return rrRows.map((r, idx) => ({
    ...r,
    rank: idx + 1,
    dayPoints: hasPlayedMatches ? Math.max(1, N - idx) : 0,
  }));
}

// POST /tournaments — create a new tournament (scorekeeper only)
tournamentsRouter.post("/", requireScorekeeper, async (req, res) => {
  const { id: customId, shareSlug: customSlug, playerIds, matches, final, config, date: customDate } = req.body;

  if (!Array.isArray(playerIds) || playerIds.length < 2) {
    return res.status(400).json({ error: "playerIds must be an array of at least 2 players" });
  }

  const slug = customSlug || nanoid(8);
  const tourneyId = customId || nanoid(10);
  const tournamentConfig: TournamentConfig = { ...DEFAULT_CONFIG, ...(config ?? {}) };

  try {
    await pool.query("BEGIN");

    // Ensure day_table exists for the session date
    const todayStr = (customDate && /^\d{4}-\d{2}-\d{2}$/.test(customDate))
      ? customDate
      : new Date().toISOString().split("T")[0];
    const dayRes = await pool.query(
      `INSERT INTO day_tables (date) VALUES ($1)
       ON CONFLICT (date) DO UPDATE SET date = EXCLUDED.date
       RETURNING id`,
      [todayStr]
    );
    const dayId = dayRes.rows[0].id;

    // Clean up any previous active tournaments for this day:
    // If they have 0 played matches, they were cancelled/abandoned: DELETE them.
    // If they have played matches, mark them 'cancelled' (NEVER 'completed').
    const prevActiveRes = await pool.query(
      `SELECT t.id, COUNT(m.id) FILTER (WHERE m.played = true) as played_count
       FROM tournaments t
       LEFT JOIN matches m ON m.tournament_id = t.id
       WHERE t.day_id = $1 AND t.status = 'active' AND t.id != $2
       GROUP BY t.id`,
      [dayId, tourneyId]
    );

    for (const prev of prevActiveRes.rows) {
      if (parseInt(prev.played_count, 10) === 0) {
        await pool.query(`DELETE FROM matches WHERE tournament_id = $1`, [prev.id]);
        await pool.query(`DELETE FROM tournaments WHERE id = $1`, [prev.id]);
      } else {
        await pool.query(`UPDATE tournaments SET status = 'cancelled' WHERE id = $1`, [prev.id]);
      }
    }

    // Insert or update tournament
    const tourneyStatus = req.body.status || (req.body.closed ? "completed" : "active");
    const tourneyRes = await pool.query(
      `INSERT INTO tournaments (id, share_slug, day_id, player_ids, status, config, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         share_slug = $2,
         player_ids = $4,
         config = $6,
         status = CASE WHEN tournaments.status = 'completed' THEN 'completed' ELSE $5 END,
         completed_at = CASE WHEN tournaments.completed_at IS NOT NULL THEN tournaments.completed_at ELSE $7 END
       RETURNING id, share_slug, day_id, player_ids, status, config, created_at`,
      [tourneyId, slug, dayId, playerIds, tourneyStatus, JSON.stringify(tournamentConfig), tourneyStatus === "completed" ? new Date() : null]
    );
    const tournament = tourneyRes.rows[0];

    // Insert or update round-robin matches if provided
    const insertedMatches: any[] = [];
    if (Array.isArray(matches)) {
      for (const m of matches) {
        const matchId = m.id || nanoid(10);
        const scoreA = typeof m.scoreA === "number" ? m.scoreA : null;
        const scoreB = typeof m.scoreB === "number" ? m.scoreB : null;
        const played = !!m.played;
        const ptsA = typeof m.pointsA === "number" ? m.pointsA : (m.pointsAwarded && m.pointsAwarded[m.playerA]) ?? null;
        const ptsB = typeof m.pointsB === "number" ? m.pointsB : (m.pointsAwarded && m.pointsAwarded[m.playerB]) ?? null;

        const mRes = await pool.query(
          `INSERT INTO matches (id, tournament_id, round, is_final, player_a, player_b, court_side, score_a, score_b, points_a, points_b, played)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (tournament_id, id) DO UPDATE SET
             round = EXCLUDED.round,
             court_side = EXCLUDED.court_side,
             score_a = EXCLUDED.score_a,
             score_b = EXCLUDED.score_b,
             points_a = EXCLUDED.points_a,
             points_b = EXCLUDED.points_b,
             played = EXCLUDED.played
           RETURNING id, round, is_final, player_a AS "playerA", player_b AS "playerB", court_side AS "courtSide", score_a AS "scoreA", score_b AS "scoreB", points_a AS "pointsA", points_b AS "pointsB", played`,
          [matchId, tournament.id, m.round ?? 0, !!m.isFinal, m.playerA, m.playerB, JSON.stringify(m.courtSide ?? {}), scoreA, scoreB, ptsA, ptsB, played]
        );
        insertedMatches.push(mRes.rows[0]);
      }
    }

    // Insert final match if provided and not already included in tournament.matches (e.g. de-gf or de-gfr)
    const finalAlreadyInserted = insertedMatches.some(
      (m: any) =>
        m.id === final?.id ||
        m.id === `final-${tournament.id}` ||
        m.id === "de-gf" ||
        m.id === "de-gfr" ||
        (m.is_final && m.player_a === final?.playerA && m.player_b === final?.playerB)
    );
    if (!finalAlreadyInserted && final && final.playerA && final.playerB) {
      const finalId = final.id || `final-${tournament.id}`;
      const fScoreA = typeof final.scoreA === "number" ? final.scoreA : null;
      const fScoreB = typeof final.scoreB === "number" ? final.scoreB : null;
      const fPlayed = !!final.played;
      const fPtsA = typeof final.pointsA === "number" ? final.pointsA : (final.pointsAwarded && final.pointsAwarded[final.playerA]) ?? null;
      const fPtsB = typeof final.pointsB === "number" ? final.pointsB : (final.pointsAwarded && final.pointsAwarded[final.playerB]) ?? null;

      await pool.query(
        `INSERT INTO matches (id, tournament_id, round, is_final, player_a, player_b, court_side, score_a, score_b, points_a, points_b, played)
         VALUES ($1, $2, -1, true, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (tournament_id, id) DO UPDATE SET
           score_a = EXCLUDED.score_a,
           score_b = EXCLUDED.score_b,
           points_a = EXCLUDED.points_a,
           points_b = EXCLUDED.points_b,
           played = EXCLUDED.played`,
        [finalId, tournament.id, final.playerA, final.playerB, JSON.stringify(final.courtSide ?? {}), fScoreA, fScoreB, fPtsA, fPtsB, fPlayed]
      );
    }

    await pool.query("COMMIT");

    io.to(`day:${todayStr}`).emit("day:update", {
      type: "tournament:started",
      tournamentId: tournament.id,
      shareSlug: slug,
      date: todayStr,
    });

    io.emit("live:update", {
      type: "tournament:started",
      tournamentId: tournament.id,
      shareSlug: slug,
      date: todayStr,
    });

    res.status(201).json({
      ...tournament,
      shareSlug: slug,
      matches: insertedMatches,
      shareUrl: `/live/${todayStr}`,
    });
  } catch (err: any) {
    await pool.query("ROLLBACK");
    console.error("POST /tournaments error:", err);
    res.status(500).json({ error: "Failed to create tournament", details: err.message });
  }
});

// GET /tournaments/:slug — fetch public tournament state for live view
tournamentsRouter.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    let tRes;
    if (slug === "active" || slug === "current") {
      tRes = await pool.query(
        `SELECT t.id, t.share_slug, t.day_id, t.player_ids, t.status, t.config, t.created_at, t.completed_at,
                COALESCE(d.date::text, t.created_at::date::text) AS "dayDate"
         FROM tournaments t
         LEFT JOIN day_tables d ON t.day_id = d.id
         WHERE t.status = 'active'
         ORDER BY t.created_at DESC LIMIT 1`
      );
      if (tRes.rowCount === 0) {
        tRes = await pool.query(
          `SELECT t.id, t.share_slug, t.day_id, t.player_ids, t.status, t.config, t.created_at, t.completed_at,
                  COALESCE(d.date::text, t.created_at::date::text) AS "dayDate"
           FROM tournaments t
           LEFT JOIN day_tables d ON t.day_id = d.id
           ORDER BY t.created_at DESC LIMIT 1`
        );
      }
    } else {
      tRes = await pool.query(
        `SELECT t.id, t.share_slug, t.day_id, t.player_ids, t.status, t.config, t.created_at, t.completed_at,
                COALESCE(d.date::text, t.created_at::date::text) AS "dayDate"
         FROM tournaments t
         LEFT JOIN day_tables d ON t.day_id = d.id
         WHERE t.share_slug = $1 OR t.id = $1`,
        [slug]
      );
    }

    if (tRes.rowCount === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    const rawT = tRes.rows[0];
    const tournament = { ...rawT, shareSlug: rawT.share_slug || rawT.shareSlug || rawT.id };

    // Fetch matches (ordered by round ASC, id ASC)
    const mRes = await pool.query(
      `SELECT id, round, is_final AS "isFinal", player_a AS "playerA", player_b AS "playerB",
              court_side AS "courtSide", score_a AS "scoreA", score_b AS "scoreB",
              points_a AS "pointsA", points_b AS "pointsB", played, played_at
       FROM matches WHERE tournament_id = $1 ORDER BY round ASC, id ASC`,
      [tournament.id]
    );

    // Fetch players
    const pRes = await pool.query(
      `SELECT id, name, avatar_type AS "avatar", avatar_emoji AS "avatarEmoji", avatar_color AS "avatarColor"
       FROM players WHERE id = ANY($1::text[])`,
      [tournament.player_ids]
    );

    const matches = mRes.rows;
    const tournamentConfig = typeof tournament.config === "string" ? JSON.parse(tournament.config) : (tournament.config || DEFAULT_CONFIG);
    const table = computeTable(matches, tournament.player_ids, tournamentConfig);

    // Return complete player objects for all tournament player_ids
    const foundPlayerIds = new Set(pRes.rows.map((p: any) => p.id));
    const players = [...pRes.rows];
    for (const pid of tournament.player_ids) {
      if (!foundPlayerIds.has(pid)) {
        players.push({
          id: pid,
          name: pid.charAt(0).toUpperCase() + pid.slice(1),
          avatar: "clumsy",
        });
      }
    }

    res.json({
      tournament,
      matches,
      players,
      standings: table,
    });
  } catch (err: any) {
    console.error("GET /tournaments/:slug error:", err);
    res.status(500).json({ error: "Failed to fetch tournament", details: err.message });
  }
});

// PATCH /tournaments/:id/matches/:matchId — submit or edit a round-robin match score (scorekeeper only)
tournamentsRouter.patch("/:id/matches/:matchId", requireScorekeeper, async (req, res) => {
  const { id: tournamentId, matchId } = req.params;
  const { scoreA, scoreB } = req.body;

  if (typeof scoreA !== "number" || typeof scoreB !== "number") {
    return res.status(400).json({ error: "scoreA and scoreB must be numbers" });
  }

  try {
    // Get tournament config and associated day
    const tRes = await pool.query(
      `SELECT t.share_slug, t.config, COALESCE(d.date::text, t.created_at::date::text) AS day_date
       FROM tournaments t
       LEFT JOIN day_tables d ON t.day_id = d.id
       WHERE t.id = $1`,
      [tournamentId]
    );
    if (tRes.rowCount === 0) return res.status(404).json({ error: "Tournament not found" });

    const { share_slug, config, day_date } = tRes.rows[0];
    const tournamentConfig: TournamentConfig = { ...DEFAULT_CONFIG, ...(config ?? {}) };

    const winScore = Math.max(scoreA, scoreB);
    const loseScore = Math.min(scoreA, scoreB);
    const pts = pointsForMatch(winScore, loseScore, tournamentConfig);

    const ptsA = scoreA > scoreB ? pts : 0;
    const ptsB = scoreB > scoreA ? pts : 0;

    const mRes = await pool.query(
      `UPDATE matches
       SET score_a = $1, score_b = $2, points_a = $3, points_b = $4, played = true, played_at = now()
       WHERE id = $5 AND tournament_id = $6
       RETURNING id, round, is_final AS "isFinal", player_a AS "playerA", player_b AS "playerB",
                 court_side AS "courtSide", score_a AS "scoreA", score_b AS "scoreB",
                 points_a AS "pointsA", points_b AS "pointsB", played`,
      [scoreA, scoreB, ptsA, ptsB, matchId, tournamentId]
    );

    if (mRes.rowCount === 0) return res.status(404).json({ error: "Match not found" });

    const updatedMatch = mRes.rows[0];

    // Broadcast live update to room
    io.to(`tournament:${share_slug}`).emit("tournament:update", {
      type: "match:updated",
      match: updatedMatch,
      tournamentId,
    });

    if (day_date) {
      io.to(`day:${day_date}`).emit("day:update", {
        type: "match:updated",
        match: updatedMatch,
        tournamentId,
        date: day_date,
      });
    }

    // Global live update for all spectators
    io.emit("live:update", {
      type: "match:updated",
      match: updatedMatch,
      tournamentId,
      shareSlug: share_slug,
      date: day_date,
    });

    res.json(updatedMatch);
  } catch (err: any) {
    console.error("PATCH match score error:", err);
    res.status(500).json({ error: "Failed to update match score", details: err.message });
  }
});

// PATCH /tournaments/:id/final — submit final match score and complete tournament (scorekeeper only)
tournamentsRouter.patch("/:id/final", requireScorekeeper, async (req, res) => {
  const { id: tournamentId } = req.params;
  const { scoreA, scoreB, playerA, playerB } = req.body;

  if (typeof scoreA !== "number" || typeof scoreB !== "number") {
    return res.status(400).json({ error: "scoreA and scoreB must be numbers" });
  }

  try {
    const tRes = await pool.query(
      `SELECT t.share_slug, t.config, COALESCE(d.date::text, t.created_at::date::text) AS day_date, t.player_ids
       FROM tournaments t
       LEFT JOIN day_tables d ON t.day_id = d.id
       WHERE t.id = $1`,
      [tournamentId]
    );
    if (tRes.rowCount === 0) return res.status(404).json({ error: "Tournament not found" });

    const { share_slug, config, day_date, player_ids } = tRes.rows[0];
    const tournamentConfig: TournamentConfig = { ...DEFAULT_CONFIG, ...(config ?? {}) };

    const winScore = Math.max(scoreA, scoreB);
    const loseScore = Math.min(scoreA, scoreB);
    const winnerIsA = scoreA > scoreB;

    const N = Array.isArray(player_ids) ? player_ids.length : 0;
    const margin = winScore - loseScore;
    const bonusMargin = tournamentConfig.finalBonusMargin ?? 4;
    const winnerPoints = N;
    const loserPoints = margin >= bonusMargin ? Math.max(1, N - 2) : Math.max(1, N - 1);

    const ptsA = winnerIsA ? winnerPoints : loserPoints;
    const ptsB = winnerIsA ? loserPoints : winnerPoints;

    await pool.query("BEGIN");

    // Upsert final match: check if a final match already exists for this tournament (e.g. de-gf or de-gfr in Double Elimination)
    const existingFinalRes = await pool.query(
      `SELECT id FROM matches WHERE tournament_id = $1 AND (is_final = true OR id = 'de-gf' OR id = 'de-gfr') ORDER BY played_at DESC NULLS LAST LIMIT 1`,
      [tournamentId]
    );
    const finalMatchId = existingFinalRes.rows[0]?.id || `final-${tournamentId}`;
    const mRes = await pool.query(
      `INSERT INTO matches (id, tournament_id, round, is_final, player_a, player_b, score_a, score_b, points_a, points_b, played, played_at)
       VALUES ($1, $2, -1, true, $3, $4, $5, $6, $7, $8, true, now())
       ON CONFLICT (tournament_id, id) DO UPDATE SET score_a = $5, score_b = $6, points_a = $7, points_b = $8, played = true, played_at = now()
       RETURNING id, round, is_final AS "isFinal", player_a AS "playerA", player_b AS "playerB", score_a AS "scoreA", score_b AS "scoreB", points_a AS "pointsA", points_b AS "pointsB", played`,
      [finalMatchId, tournamentId, playerA, playerB, scoreA, scoreB, ptsA, ptsB]
    );

    // Mark tournament as completed
    await pool.query(
      `UPDATE tournaments SET status = 'completed', completed_at = now() WHERE id = $1`,
      [tournamentId]
    );

    // Recompute clean cumulative day totals across all tournaments for this day
    let updatedTotals: Record<string, number> = {};
    const tourneyDayRes = await pool.query(
      `SELECT t.day_id, COALESCE(d.date::text, t.created_at::date::text) as session_date
       FROM tournaments t LEFT JOIN day_tables d ON t.day_id = d.id WHERE t.id = $1`,
      [tournamentId]
    );
    const dayId = tourneyDayRes.rows[0]?.day_id;
    const sessionDate = tourneyDayRes.rows[0]?.session_date;

    if (dayId || sessionDate) {
      const tourneysInDay = await pool.query(
        `SELECT t.id, t.config, t.player_ids
         FROM tournaments t
         WHERE (t.day_id = $1 OR t.created_at::date::text = $2) AND t.status = 'completed'`,
        [dayId || null, sessionDate || null]
      );

      for (const tRow of tourneysInDay.rows) {
        const matchesRes = await pool.query(
          `SELECT id, round, is_final AS "isFinal", player_a AS "playerA", player_b AS "playerB", court_side, score_a AS "scoreA", score_b AS "scoreB", points_a AS "pointsA", points_b AS "pointsB", played
           FROM matches WHERE tournament_id = $1`,
          [tRow.id]
        );
        const tCfg = typeof tRow.config === "string" ? JSON.parse(tRow.config) : (tRow.config || DEFAULT_CONFIG);
        const tStandings = computeTable(matchesRes.rows, tRow.player_ids || [], tCfg);
        for (const row of tStandings) {
          if (row.playerId) {
            updatedTotals[row.playerId] = (updatedTotals[row.playerId] || 0) + (row.dayPoints || 0);
          }
        }
      }

      if (Object.keys(updatedTotals).length > 0) {
        if (dayId) {
          await pool.query(
            `UPDATE day_tables SET totals = $1 WHERE id = $2`,
            [JSON.stringify(updatedTotals), dayId]
          );
        }
        if (sessionDate) {
          await pool.query(
            `UPDATE day_tables SET totals = $1 WHERE date::text = $2`,
            [JSON.stringify(updatedTotals), sessionDate]
          );
        }
      }
    }

    await pool.query("COMMIT");

    const finalMatch = mRes.rows[0];

    // Broadcast final completion to room
    io.to(`tournament:${share_slug}`).emit("tournament:update", {
      type: "final:completed",
      final: finalMatch,
      status: "completed",
    });

    if (day_date) {
      io.to(`day:${day_date}`).emit("day:update", {
        type: "final:completed",
        final: finalMatch,
        tournamentId,
        date: day_date,
        totals: updatedTotals,
      });
    }

    // Global live update for all spectators
    io.emit("live:update", {
      type: "final:completed",
      final: finalMatch,
      status: "completed",
      tournamentId,
      shareSlug: share_slug,
      totals: updatedTotals,
      date: day_date,
    });

    res.json({
      tournamentId,
      status: "completed",
      final: finalMatch,
    });
  } catch (err: any) {
    await pool.query("ROLLBACK");
    console.error("PATCH final score error:", err);
    res.status(500).json({ error: "Failed to record final match", details: err.message });
  }
});

// DELETE /tournaments/:id — delete a tournament and its matches (scorekeeper only)
tournamentsRouter.delete("/:id", requireScorekeeper, async (req, res) => {
  const { id: tournamentId } = req.params;

  try {
    await pool.query("BEGIN");

    // Look up day_id before deleting
    const tQuery = await pool.query("SELECT day_id FROM tournaments WHERE id = $1", [tournamentId]);
    const tourneyDayId = tQuery.rows[0]?.day_id;

    // Delete matches belonging to tournament
    await pool.query("DELETE FROM matches WHERE tournament_id = $1", [tournamentId]);

    // Delete tournament
    const result = await pool.query("DELETE FROM tournaments WHERE id = $1 RETURNING id", [tournamentId]);

    if (result.rowCount === 0) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ error: "Tournament not found" });
    }

    // If no more tournaments exist for this day, reset day_tables totals and remove day_results
    if (tourneyDayId) {
      const remaining = await pool.query(
        "SELECT id FROM tournaments WHERE day_id = $1",
        [tourneyDayId]
      );

      if (remaining.rowCount === 0) {
        await pool.query(
          "UPDATE day_tables SET totals = '{}', closed = false, closed_at = null WHERE id = $1",
          [tourneyDayId]
        );
        await pool.query(
          "DELETE FROM day_results WHERE day_table_id = $1",
          [tourneyDayId]
        );
      } else {
        const tourneysInDay = await pool.query(
          `SELECT t.id, t.config, t.player_ids
           FROM tournaments t
           WHERE t.day_id = $1 AND t.status = 'completed'`,
          [tourneyDayId]
        );
        const newTotals: Record<string, number> = {};
        for (const tRow of tourneysInDay.rows) {
          const matchesRes = await pool.query(
            `SELECT id, round, is_final AS "isFinal", player_a AS "playerA", player_b AS "playerB", court_side, score_a AS "scoreA", score_b AS "scoreB", points_a AS "pointsA", points_b AS "pointsB", played
             FROM matches WHERE tournament_id = $1`,
            [tRow.id]
          );
          const tCfg = typeof tRow.config === "string" ? JSON.parse(tRow.config) : (tRow.config || DEFAULT_CONFIG);
          const tStandings = computeTable(matchesRes.rows, tRow.player_ids || [], tCfg);
          for (const row of tStandings) {
            if (row.playerId) {
              newTotals[row.playerId] = (newTotals[row.playerId] || 0) + (row.dayPoints || 0);
            }
          }
        }
        await pool.query(
          "UPDATE day_tables SET totals = $1 WHERE id = $2",
          [JSON.stringify(newTotals), tourneyDayId]
        );
      }
    }

    let dayDate: string | undefined;
    if (tourneyDayId) {
      const dayDateRes = await pool.query("SELECT date::text FROM day_tables WHERE id = $1", [tourneyDayId]);
      dayDate = dayDateRes.rows[0]?.date;
    }

    await pool.query("COMMIT");

    if (dayDate) {
      io.to(`day:${dayDate}`).emit("day:update", {
        type: "tournament:deleted",
        tournamentId,
        date: dayDate,
      });
    }

    io.emit("live:update", {
      type: "tournament:deleted",
      tournamentId,
      date: dayDate,
    });

    res.json({ success: true, deletedId: tournamentId });
  } catch (err: any) {
    await pool.query("ROLLBACK");
    console.error("DELETE tournament error:", err);
    res.status(500).json({ error: "Failed to delete tournament", details: err.message });
  }
});

