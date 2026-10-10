import { Router } from "express";
import { pool } from "../db/client";
import { requireScorekeeper } from "../middleware/auth";
import { io } from "../index";
import { computeTable } from "./tournaments";
import { TournamentConfig, DEFAULT_CONFIG } from "../lib/scoring";

export const dayTablesRouter = Router();

// GET /day-tables/:date — fetch cumulative day table, tournaments, matches, active tournament, and player roster
dayTablesRouter.get("/:date", async (req, res) => {
  const { date } = req.params;

  try {
    let targetDate = date;
    let dayRes;

    if (date === "current" || date === "today" || date === "latest") {
      dayRes = await pool.query(
        `SELECT id, date, closed, totals, closed_at FROM day_tables ORDER BY date DESC LIMIT 1`
      );
      if (dayRes.rows[0]) {
        targetDate = typeof dayRes.rows[0].date === "string" ? dayRes.rows[0].date : dayRes.rows[0].date.toISOString().split("T")[0];
      }
    } else {
      dayRes = await pool.query(
        `SELECT id, date, closed, totals, closed_at FROM day_tables WHERE date::text = $1`,
        [date]
      );
    }

    const day = dayRes?.rows[0] || { id: null, date: targetDate, closed: false, totals: {} };

    // Fetch tournaments belonging to this day or created on this date
    let tourneysRes;
    if (day.id) {
      tourneysRes = await pool.query(
        `SELECT id, share_slug AS "shareSlug", status, config, created_at AS "createdAt", completed_at AS "completedAt"
         FROM tournaments WHERE day_id = $1 ORDER BY created_at ASC`,
        [day.id]
      );
    } else {
      tourneysRes = await pool.query(
        `SELECT id, share_slug AS "shareSlug", status, config, created_at AS "createdAt", completed_at AS "completedAt"
         FROM tournaments WHERE created_at::date::text = $1 ORDER BY created_at ASC`,
        [targetDate]
      );
    }

    // Fallback: If no active tournament found in this day's tournaments, check if there is an active tournament globally!
    const hasActiveInDay = tourneysRes.rows.some((t: any) => t.status === "active");
    const tourneyRows = [...tourneysRes.rows];
    let extraDayTotals: Record<string, number> | null = null;

    if (!hasActiveInDay) {
      const actGlobalRes = await pool.query(
        `SELECT t.id, t.share_slug AS "shareSlug", t.day_id AS "dayId", t.status, t.config,
                t.created_at AS "createdAt", t.completed_at AS "completedAt", d.totals AS "dayTotals"
         FROM tournaments t
         LEFT JOIN day_tables d ON t.day_id = d.id
         WHERE t.status = 'active'
         ORDER BY t.created_at DESC LIMIT 1`
      );
      if (actGlobalRes.rowCount && actGlobalRes.rowCount > 0) {
        const globalRow = actGlobalRes.rows[0];
        if (!tourneyRows.some((t) => t.id === globalRow.id)) {
          tourneyRows.push(globalRow);
        }
        if (globalRow.dayTotals && typeof globalRow.dayTotals === "object") {
          extraDayTotals = globalRow.dayTotals;
        }
      }
    }

    const tournamentsData: any[] = [];
    const allPlayerIds = new Set<string>();

    for (const t of tourneyRows) {
      const mRes = await pool.query(
        `SELECT id, round, is_final AS "isFinal", player_a AS "playerA", player_b AS "playerB",
                court_side AS "courtSide", score_a AS "scoreA", score_b AS "scoreB",
                points_a AS "pointsA", points_b AS "pointsB", played, played_at AS "playedAt"
         FROM matches WHERE tournament_id = $1 ORDER BY round ASC, is_final ASC`,
        [t.id]
      );

      const tMatches = mRes.rows;
      tMatches.forEach((m: any) => {
        if (m.playerA) allPlayerIds.add(m.playerA);
        if (m.playerB) allPlayerIds.add(m.playerB);
      });

      const pIds = Array.from(new Set(tMatches.flatMap((m: any) => [m.playerA, m.playerB]))).filter(Boolean);
      const cfg: TournamentConfig = typeof t.config === "string" ? JSON.parse(t.config) : (t.config || DEFAULT_CONFIG);
      const standings = computeTable(tMatches, pIds, cfg);

      const finalMatch = tMatches.find((m: any) => m.isFinal || m.round === -1);
      const regularMatches = tMatches.filter((m: any) => !m.isFinal && m.round !== -1);

      tournamentsData.push({
        id: t.id,
        shareSlug: t.shareSlug,
        status: t.status,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        config: cfg,
        matches: regularMatches,
        final: finalMatch || null,
        standings,
      });
    }

    // Merge day totals
    let mergedTotals: Record<string, number> = { ...(extraDayTotals || {}), ...(day.totals || {}) };

    // Self-healing fallback: If mergedTotals has no points but tournaments have completed,
    // recalculate totals directly from completed tournament standings!
    const hasPoints = Object.values(mergedTotals).some((pts) => (pts as number) > 0);
    if (!hasPoints && tournamentsData.length > 0) {
      const calcTotals: Record<string, number> = {};
      for (const t of tournamentsData) {
        if (t.status === "completed" && Array.isArray(t.standings)) {
          for (const row of t.standings) {
            if (row.playerId) {
              calcTotals[row.playerId] = (calcTotals[row.playerId] || 0) + (row.dayPoints || 0);
            }
          }
        }
      }
      if (Object.values(calcTotals).some((pts) => pts > 0)) {
        mergedTotals = calcTotals;
        if (day.id) {
          pool.query(`UPDATE day_tables SET totals = $1 WHERE id = $2`, [JSON.stringify(calcTotals), day.id]).catch(() => {});
        } else if (targetDate) {
          pool.query(`UPDATE day_tables SET totals = $1 WHERE date::text = $2`, [JSON.stringify(calcTotals), targetDate]).catch(() => {});
        }
      }
    }

    // Include any players in day totals
    Object.keys(mergedTotals).forEach((id) => allPlayerIds.add(id));

    const playerIdsArr = Array.from(allPlayerIds);
    let players: any[] = [];
    if (playerIdsArr.length > 0) {
      const pRes = await pool.query(
        `SELECT id, name, avatar_type AS "avatar", avatar_emoji AS "avatarEmoji", avatar_color AS "avatarColor"
         FROM players WHERE id = ANY($1::text[])`,
        [playerIdsArr]
      );
      players = pRes.rows;
      const found = new Set(players.map((p) => p.id));
      for (const pid of playerIdsArr) {
        if (!found.has(pid)) {
          players.push({
            id: pid,
            name: pid.charAt(0).toUpperCase() + pid.slice(1),
            avatar: "clumsy",
          });
        }
      }
    }

    // Active tournament is the one with status = 'active' or the latest tournament
    const activeTournament = tournamentsData.find((t) => t.status === "active") || tournamentsData[tournamentsData.length - 1] || null;

    // Day standings sorted by total day points
    const dayStandings = Object.entries(mergedTotals).map(([playerId, totalPts]: any) => {
      const p = players.find((x) => x.id === playerId);
      return {
        playerId,
        name: p?.name || playerId,
        avatar: p?.avatar || "clumsy",
        avatarEmoji: p?.avatarEmoji,
        avatarColor: p?.avatarColor,
        points: totalPts,
      };
    }).sort((a, b) => (b.points as number) - (a.points as number));

    res.json({
      date: targetDate,
      closed: !!day.closed,
      totals: mergedTotals,
      activeTournament,
      tournaments: tournamentsData,
      players,
      dayStandings,
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

      // Delete existing day_results for this date to prevent duplicates
      await pool.query(`DELETE FROM day_results WHERE date = $1`, [date]);

      // Insert or update day_results
      await pool.query(
        `INSERT INTO day_results (day_table_id, date, top_player_id, bottom_player_id)
         VALUES ($1, $2, $3, $4)`,
        [day.id, date, topPlayerId, bottomPlayerId]
      );
    }

    await pool.query("COMMIT");

    io.to(`day:${date}`).emit("day:update", {
      type: "day:closed",
      date,
      totals,
    });

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

    io.to(`day:${date}`).emit("day:update", {
      type: "day:reset",
      date,
    });

    res.json({ success: true, deletedDate: date });
  } catch (err: any) {
    await pool.query("ROLLBACK");
    console.error("DELETE /day-tables/:date error:", err);
    res.status(500).json({ error: "Failed to delete day table", details: err.message });
  }
});
