import { Router } from "express";
import { nanoid } from "nanoid";
import { pool } from "../db/client";
import { requireScorekeeper } from "../middleware/auth";
import { io } from "../index";
import { pointsForMatch, pointsForFinal, TournamentConfig, DEFAULT_CONFIG } from "../lib/scoring";

export const tournamentsRouter = Router();

// Helper to compute tournament standings table
function computeTable(matches: any[], playerIds: string[]) {
  const stats: { [id: string]: { points: number; wins: number; matchesPlayed: number; pointDiff: number } } = {};

  for (const id of playerIds) {
    stats[id] = { points: 0, wins: 0, matchesPlayed: 0, pointDiff: 0 };
  }

  for (const m of matches) {
    if (!m.played || m.scoreA === null || m.scoreB === null) continue;
    const { playerA, playerB, scoreA, scoreB, pointsA, pointsB, isFinal } = m;

    if (!stats[playerA]) stats[playerA] = { points: 0, wins: 0, matchesPlayed: 0, pointDiff: 0 };
    if (!stats[playerB]) stats[playerB] = { points: 0, wins: 0, matchesPlayed: 0, pointDiff: 0 };

    if (!isFinal) {
      stats[playerA].matchesPlayed++;
      stats[playerB].matchesPlayed++;
      stats[playerA].pointDiff += scoreA - scoreB;
      stats[playerB].pointDiff += scoreB - scoreA;
      if (scoreA > scoreB) stats[playerA].wins++;
      if (scoreB > scoreA) stats[playerB].wins++;
    }

    stats[playerA].points += pointsA ?? 0;
    stats[playerB].points += pointsB ?? 0;
  }

  return Object.entries(stats)
    .map(([playerId, s]) => ({ playerId, ...s }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.pointDiff - a.pointDiff);
}

// POST /tournaments — create a new tournament (scorekeeper only)
tournamentsRouter.post("/", requireScorekeeper, async (req, res) => {
  const { id: customId, shareSlug: customSlug, playerIds, matches, config } = req.body;

  if (!Array.isArray(playerIds) || playerIds.length < 3) {
    return res.status(400).json({ error: "playerIds must be an array of at least 3 players" });
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

    // Insert tournament
    const tourneyRes = await pool.query(
      `INSERT INTO tournaments (id, share_slug, day_id, player_ids, status, config)
       VALUES ($1, $2, $3, $4, 'active', $5)
       ON CONFLICT (id) DO UPDATE SET player_ids = $4, config = $5
       RETURNING id, share_slug, day_id, player_ids, status, config, created_at`,
      [tourneyId, slug, dayId, playerIds, JSON.stringify(tournamentConfig)]
    );
    const tournament = tourneyRes.rows[0];

    // Insert matches if provided
    const insertedMatches: any[] = [];
    if (Array.isArray(matches)) {
      for (const m of matches) {
        const matchId = m.id || nanoid(10);
        const mRes = await pool.query(
          `INSERT INTO matches (id, tournament_id, round, is_final, player_a, player_b, court_side, played)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false)
           ON CONFLICT (id) DO UPDATE SET round = $3, court_side = $7
           RETURNING id, round, is_final, player_a AS "playerA", player_b AS "playerB", court_side AS "courtSide", played`,
          [matchId, tournament.id, m.round ?? 0, !!m.isFinal, m.playerA, m.playerB, JSON.stringify(m.courtSide ?? {})]
        );
        insertedMatches.push(mRes.rows[0]);
      }
    }

    await pool.query("COMMIT");

    res.status(201).json({
      ...tournament,
      matches: insertedMatches,
      shareUrl: `/live/${slug}`,
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
      `SELECT id, share_slug, day_id, player_ids, status, config, created_at, completed_at
       FROM tournaments WHERE share_slug = $1`,
      [slug]
    );

    if (tRes.rowCount === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    const tournament = tRes.rows[0];

    // Fetch matches
    const mRes = await pool.query(
      `SELECT id, round, is_final AS "isFinal", player_a AS "playerA", player_b AS "playerB",
              court_side AS "courtSide", score_a AS "scoreA", score_b AS "scoreB",
              points_a AS "pointsA", points_b AS "pointsB", played, played_at
       FROM matches WHERE tournament_id = $1 ORDER BY round ASC, created_at ASC`,
      [tournament.id]
    );

    // Fetch players
    const pRes = await pool.query(
      `SELECT id, name, avatar_type AS "avatar", avatar_emoji AS "avatarEmoji", avatar_color AS "avatarColor"
       FROM players WHERE id = ANY($1::uuid[])`,
      [tournament.player_ids]
    );

    const matches = mRes.rows;
    const table = computeTable(matches, tournament.player_ids);

    res.json({
      tournament,
      matches,
      players: pRes.rows,
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
    // Get tournament config
    const tRes = await pool.query("SELECT share_slug, config FROM tournaments WHERE id = $1", [tournamentId]);
    if (tRes.rowCount === 0) return res.status(404).json({ error: "Tournament not found" });

    const { share_slug, config } = tRes.rows[0];
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
    const tRes = await pool.query("SELECT share_slug, config, day_id FROM tournaments WHERE id = $1", [tournamentId]);
    if (tRes.rowCount === 0) return res.status(404).json({ error: "Tournament not found" });

    const { share_slug, config, day_id } = tRes.rows[0];
    const tournamentConfig: TournamentConfig = { ...DEFAULT_CONFIG, ...(config ?? {}) };

    const winScore = Math.max(scoreA, scoreB);
    const loseScore = Math.min(scoreA, scoreB);
    const winnerIsA = scoreA > scoreB;

    const ptsA = pointsForFinal(winScore, loseScore, winnerIsA, tournamentConfig);
    const ptsB = pointsForFinal(winScore, loseScore, !winnerIsA, tournamentConfig);

    await pool.query("BEGIN");

    // Upsert final match
    const mRes = await pool.query(
      `INSERT INTO matches (tournament_id, round, is_final, player_a, player_b, score_a, score_b, points_a, points_b, played, played_at)
       VALUES ($1, -1, true, $2, $3, $4, $5, $6, $7, true, now())
       ON CONFLICT (id) DO UPDATE SET score_a = $4, score_b = $5, points_a = $6, points_b = $7, played = true
       RETURNING id, round, is_final AS "isFinal", player_a AS "playerA", player_b AS "playerB", score_a AS "scoreA", score_b AS "scoreB", points_a AS "pointsA", points_b AS "pointsB", played`,
      [tournamentId, playerA, playerB, scoreA, scoreB, ptsA, ptsB]
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

    // Delete matches belonging to tournament
    await pool.query("DELETE FROM matches WHERE tournament_id = $1", [tournamentId]);

    // Delete tournament
    const result = await pool.query("DELETE FROM tournaments WHERE id = $1 RETURNING id", [tournamentId]);

    if (result.rowCount === 0) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ error: "Tournament not found" });
    }

    await pool.query("COMMIT");
    res.json({ success: true, deletedId: tournamentId });
  } catch (err: any) {
    await pool.query("ROLLBACK");
    console.error("DELETE tournament error:", err);
    res.status(500).json({ error: "Failed to delete tournament", details: err.message });
  }
});

