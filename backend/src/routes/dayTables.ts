import { Router } from "express";
import { pool } from "../db/client";
import { requireScorekeeper } from "../middleware/auth";

export const dayTablesRouter = Router();

// GET /day-tables/:date — fetch cumulative day table
dayTablesRouter.get("/:date", async (req, res) => {
  const { date } = req.params;

  try {
    const dayRes = await pool.query(
      `SELECT id, date, closed, totals, closed_at FROM day_tables WHERE date::text = $1`,
      [date]
    );

    if (dayRes.rowCount === 0) {
      return res.json({ date, closed: false, tournaments: [], totals: {} });
    }

    const day = dayRes.rows[0];

    // Fetch tournaments belonging to this day
    const tourneysRes = await pool.query(
      `SELECT id, share_slug, status, created_at, completed_at FROM tournaments WHERE day_id = $1 ORDER BY created_at ASC`,
      [day.id]
    );

    res.json({
      ...day,
      tournaments: tourneysRes.rows,
    });
  } catch (err: any) {
    console.error("GET /day-tables/:date error:", err);
    res.status(500).json({ error: "Failed to fetch day table", details: err.message });
  }
});

// POST /day-tables/close — close a day and record Day Champion and Last Place in day_results
dayTablesRouter.post("/close", requireScorekeeper, async (req, res) => {
  const { date, totals } = req.body;

  if (!date || !totals || typeof totals !== "object") {
    return res.status(400).json({ error: "date and totals object are required" });
  }

  try {
    await pool.query("BEGIN");

    // Upsert day_tables
    const dayRes = await pool.query(
      `INSERT INTO day_tables (date, closed, totals, closed_at)
       VALUES ($1, true, $2, now())
       ON CONFLICT (date) DO UPDATE
       SET closed = true, totals = $2, closed_at = now()
       RETURNING id, date, closed, totals, closed_at`,
      [date, JSON.stringify(totals)]
    );
    const day = dayRes.rows[0];

    // Determine top player and bottom player from totals
    const entries = Object.entries(totals as { [id: string]: number }).sort(([, a], [, b]) => b - a);

    if (entries.length >= 2) {
      const topPlayerId = entries[0][0];
      const bottomPlayerId = entries[entries.length - 1][0];

      // Insert or update day_results
      await pool.query(
        `INSERT INTO day_results (day_table_id, date, top_player_id, bottom_player_id)
         VALUES ($1, $2, $3, $4)`,
        [day.id, date, topPlayerId, bottomPlayerId]
      );
    }

    await pool.query("COMMIT");

    res.json(day);
  } catch (err: any) {
    await pool.query("ROLLBACK");
    console.error("POST /day-tables/close error:", err);
    res.status(500).json({ error: "Failed to close day table", details: err.message });
  }
});

// DELETE /day-tables/:date — reset or delete a day table, all associated tournaments, matches, and day results (scorekeeper only)
dayTablesRouter.delete("/:date", requireScorekeeper, async (req, res) => {
  const { date } = req.params;

  try {
    await pool.query("BEGIN");

    // Find the day table for this date
    const dayRes = await pool.query(
      `SELECT id FROM day_tables WHERE date::text = $1`,
      [date]
    );

    const dayId = dayRes.rows[0]?.id;

    if (dayId) {
      // 1. Delete day results
      await pool.query(
        `DELETE FROM day_results WHERE day_table_id = $1 OR date::text = $2`,
        [dayId, date]
      );

      // 2. Delete matches belonging to tournaments in this day
      await pool.query(
        `DELETE FROM matches WHERE tournament_id IN (SELECT id FROM tournaments WHERE day_id = $1)`,
        [dayId]
      );

      // 3. Delete tournaments belonging to this day
      await pool.query(
        `DELETE FROM tournaments WHERE day_id = $1`,
        [dayId]
      );

      // 4. Delete the day table record itself
      await pool.query(
        `DELETE FROM day_tables WHERE id = $1`,
        [dayId]
      );
    } else {
      // Clean up any orphaned day results by date
      await pool.query(
        `DELETE FROM day_results WHERE date::text = $1`,
        [date]
      );
    }

    await pool.query("COMMIT");
    res.json({ success: true, deletedDate: date });
  } catch (err: any) {
    await pool.query("ROLLBACK");
    console.error("DELETE /day-tables/:date error:", err);
    res.status(500).json({ error: "Failed to delete day table", details: err.message });
  }
});
