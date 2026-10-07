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
      if (finalMatch.pointsA !== null) stats[finalMatch.playerA].points += finalMatch.pointsA;
    }
    if (stats[finalMatch.playerB]) {
      stats[finalMatch.playerB].matchesPlayed++;
      stats[finalMatch.playerB].pointDiff += finalMatch.scoreB - finalMatch.scoreA;
      if (finalMatch.scoreB > finalMatch.scoreA) stats[finalMatch.playerB].wins++;
      if (finalMatch.pointsB !== null) stats[finalMatch.playerB].points += finalMatch.pointsB;
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

  return rrRows.map((r, idx) => ({
    ...r,
    rank: idx + 1,
    dayPoints: Math.max(1, N - idx),
  }));
}

// POST /tournaments — create a new tournament (scorekeeper only)
tournamentsRouter.post("/", requireScorekeeper, async (req, res) => {
  const { id: customId, shareSlug: customSlug, playerIds, matches, final, config } = req.body;

  if (!Array.isArray(playerIds) || playerIds.length < 2) {
    return res.status(400).json({ error: "playerIds must be an array of at least 2 players" });
  }

  const slug = customSlug || nanoid(8);
  const tourneyId = customId || nanoid(10);
  const tournamentConfig: TournamentConfig = { ...DEFAULT_CONFIG, ...(config ?? {}) };

  try {
    await pool.query("BEGIN");

    // Ensure day_table exists for today
    const todayStr = new Date().toISOString().split("T")[0];
    const dayRes = await pool.query(
      `INSERT INTO day_tables (date) VALUES ($1)
       ON CONFLICT (date) DO UPDATE SET date = EXCLUDED.date
       RETURNING id`,
      [todayStr]
    );
    const dayId = dayRes.rows[0].id;

    // Insert or update tournament
    const tourneyRes = await pool.query(
      `INSERT INTO tournaments (id, share_slug, day_id, player_ids, status, config)
       VALUES ($1, $2, $3, $4, 'active', $5)
       ON CONFLICT (id) DO UPDATE SET share_slug = $2, player_ids = $4, config = $5
       RETURNING id, share_slug, day_id, player_ids, status, config, created_at`,
      [tourneyId, slug, dayId, playerIds, JSON.stringify(tournamentConfig)]
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
           ON CONFLICT (id) DO UPDATE SET
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

    // Insert final match if provided
    if (final && final.playerA && final.playerB) {
      const finalId = final.id || `final-${tournament.id}`;
      const fScoreA = typeof final.scoreA === "number" ? final.scoreA : null;
      const fScoreB = typeof final.scoreB === "number" ? final.scoreB : null;
      const fPlayed = !!final.played;
      const fPtsA = typeof final.pointsA === "number" ? final.pointsA : (final.pointsAwarded && final.pointsAwarded[final.playerA]) ?? null;
      const fPtsB = typeof final.pointsB === "number" ? final.pointsB : (final.pointsAwarded && final.pointsAwarded[final.playerB]) ?? null;

      await pool.query(
        `INSERT INTO matches (id, tournament_id, round, is_final, player_a, player_b, court_side, score_a, score_b, points_a, points_b, played)
         VALUES ($1, $2, -1, true, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
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

    res.status(201).json({
      ...tournament,
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
    const tRes = await pool.query(
      `SELECT t.id, t.share_slug, t.day_id, t.player_ids, t.status, t.config, t.created_at, t.completed_at,
              COALESCE(d.date::text, t.created_at::date::text) AS "dayDate"
       FROM tournaments t
       LEFT JOIN day_tables d ON t.day_id = d.id
       WHERE t.share_slug = $1 OR t.id = $1`,
      [slug]
    );

    if (tRes.rowCount === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    const tournament = tRes.rows[0];

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
    });

    if (day_date) {
      io.to(`day:${day_date}`).emit("day:update", {
        type: "match:updated",
        match: updatedMatch,
        tournamentId,
        date: day_date,
      });
    }

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
    const winnerIsA = scoreA > scoreB;

    const ptsA = pointsForFinal(winScore, loseScore, winnerIsA, tournamentConfig);
    const ptsB = pointsForFinal(winScore, loseScore, !winnerIsA, tournamentConfig);

    await pool.query("BEGIN");

    // Upsert final match
    const finalMatchId = `final-${tournamentId}`;
    const mRes = await pool.query(
      `INSERT INTO matches (id, tournament_id, round, is_final, player_a, player_b, score_a, score_b, points_a, points_b, played, played_at)
       VALUES ($1, $2, -1, true, $3, $4, $5, $6, $7, $8, true, now())
       ON CONFLICT (id) DO UPDATE SET score_a = $5, score_b = $6, points_a = $7, points_b = $8, played = true, played_at = now()
       RETURNING id, round, is_final AS "isFinal", player_a AS "playerA", player_b AS "playerB", score_a AS "scoreA", score_b AS "scoreB", points_a AS "pointsA", points_b AS "pointsB", played`,
      [finalMatchId, tournamentId, playerA, playerB, scoreA, scoreB, ptsA, ptsB]
    );

    // Mark tournament as completed
    await pool.query(
      `UPDATE tournaments SET status = 'completed', completed_at = now() WHERE id = $1`,
      [tournamentId]
    );

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
      });
    }

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
        const ptsQuery = await pool.query(
          `SELECT player_id, SUM(pts) as total_pts FROM (
             SELECT m.player_a AS player_id, SUM(m.points_a) AS pts
             FROM matches m
             JOIN tournaments t ON m.tournament_id = t.id
             WHERE t.day_id = $1 AND m.played = true
             GROUP BY m.player_a
             UNION ALL
             SELECT m.player_b AS player_id, SUM(m.points_b) AS pts
             FROM matches m
             JOIN tournaments t ON m.tournament_id = t.id
             WHERE t.day_id = $1 AND m.played = true
             GROUP BY m.player_b
           ) sub
           GROUP BY player_id`,
          [tourneyDayId]
        );
        const newTotals: Record<string, number> = {};
        for (const row of ptsQuery.rows) {
          if (row.player_id) {
            newTotals[row.player_id] = parseInt(row.total_pts, 10) || 0;
          }
        }
        await pool.query(
          "UPDATE day_tables SET totals = $1 WHERE id = $2",
          [JSON.stringify(newTotals), tourneyDayId]
        );
      }
    }

    await pool.query("COMMIT");
    res.json({ success: true, deletedId: tournamentId });
  } catch (err: any) {
    await pool.query("ROLLBACK");
    console.error("DELETE tournament error:", err);
    res.status(500).json({ error: "Failed to delete tournament", details: err.message });
  }
});

