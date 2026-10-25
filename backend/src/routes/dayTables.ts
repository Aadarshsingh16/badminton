import { Router } from "express";
import { pool } from "../db/client";
import { requireScorekeeper } from "../middleware/auth";
import { io } from "../index";
import { computeTable } from "./tournaments";
import { TournamentConfig, DEFAULT_CONFIG } from "../lib/scoring";

export const dayTablesRouter = Router();

const SAJAL_ALIASES = new Set([
  "custom-1791717061642",
  "custom-1791630401707",
  "custom-1791021029857",
  "custom-1791025802127",
  "custom-1790938366909",
]);

function normalizePlayerId(id: string): string {
  if (id === "sajal" || SAJAL_ALIASES.has(id)) return "sajal";
  return id;
}

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
         FROM tournaments WHERE day_id = $1 AND status != 'cancelled' ORDER BY created_at ASC`,
        [day.id]
      );
    } else {
      tourneysRes = await pool.query(
        `SELECT id, share_slug AS "shareSlug", status, config, created_at AS "createdAt", completed_at AS "completedAt"
         FROM tournaments WHERE created_at::date::text = $1 AND status != 'cancelled' ORDER BY created_at ASC`,
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

    // Always recalculate day totals from live tournament standings to ensure backend is the true source of truth
    const calcTotals: Record<string, number> = {};
    let hasCompletedTournaments = false;

    if (tournamentsData.length > 0) {
      for (const t of tournamentsData) {
        const hasPlayed = (t.matches || []).some((m: any) => m.played) || (t.final && t.final.played);
        if (t.status === "completed" && t.status !== "cancelled" && hasPlayed && Array.isArray(t.standings)) {
          hasCompletedTournaments = true;
          for (const row of t.standings) {
            if (row.playerId) {
              const target = normalizePlayerId(row.playerId);
              calcTotals[target] = (calcTotals[target] || 0) + (row.dayPoints || 0);
            }
          }
        }
      }
    }

    // Merge calculated totals or fallback to saved totals:
    // Only use calculated totals if they have full tournament data. If database already has saved totals
    // that are more complete, preserve the saved totals so incomplete match data cannot corrupt the day table.
    const savedTotals = (day.totals && typeof day.totals === "object" && Object.keys(day.totals).length > 0)
      ? day.totals
      : (extraDayTotals || {});

    const totalSavedPoints = Object.values(savedTotals).reduce((sum: number, v: any) => sum + (Number(v) || 0), 0);
    const totalCalcPoints = Object.values(calcTotals).reduce((sum: number, v: any) => sum + (Number(v) || 0), 0);

    let rawTotals: Record<string, number> = {};
    if (totalSavedPoints > 0 && totalSavedPoints >= totalCalcPoints) {
      rawTotals = savedTotals;
    } else if (hasCompletedTournaments && totalCalcPoints > 0) {
      rawTotals = calcTotals;
    } else {
      rawTotals = savedTotals;
    }

    const mergedTotals: Record<string, number> = {};
    for (const [id, pts] of Object.entries(rawTotals)) {
      const target = normalizePlayerId(id);
      mergedTotals[target] = (mergedTotals[target] || 0) + (Number(pts) || 0);
    }

    // Self-healing: only update database totals if calculated totals are strictly greater
    if (hasCompletedTournaments && totalCalcPoints > totalSavedPoints) {
      const isDifferent = JSON.stringify(mergedTotals) !== JSON.stringify(day.totals || {});
      if (isDifferent) {
        if (day.id) {
          pool.query(`UPDATE day_tables SET totals = $1 WHERE id = $2`, [JSON.stringify(mergedTotals), day.id]).catch(() => {});
        } else if (targetDate) {
          pool.query(`UPDATE day_tables SET totals = $1 WHERE date::text = $2`, [JSON.stringify(mergedTotals), targetDate]).catch(() => {});
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

// POST /day-tables/sync — scorekeeper syncs calculated day totals
dayTablesRouter.post("/sync", requireScorekeeper, async (req, res) => {
  const { date, totals } = req.body;

  if (!date || !totals || typeof totals !== "object") {
    return res.status(400).json({ error: "date and totals object are required" });
  }

  try {
    const dayRes = await pool.query(
      `INSERT INTO day_tables (date, totals)
       VALUES ($1, $2)
       ON CONFLICT (date) DO UPDATE
       SET totals = $2
       RETURNING id, date, closed, totals`,
      [date, JSON.stringify(totals)]
    );

    io.to(`day:${date}`).emit("day:update", {
      type: "day:totals_updated",
      date,
      totals,
    });

    res.json(dayRes.rows[0]);
  } catch (err: any) {
    console.error("POST /day-tables/sync error:", err);
    res.status(500).json({ error: "Failed to sync day table", details: err.message });
  }
});

// POST /day-tables/sync-full-day — bulk upload authoritative day session (totals, completed tournaments, matches, players)
dayTablesRouter.post("/sync-full-day", requireScorekeeper, async (req, res) => {
  const { date, totals, tournaments, players } = req.body;

  if (!date || !totals || typeof totals !== "object") {
    return res.status(400).json({ error: "date and totals object are required" });
  }

  try {
    await pool.query("BEGIN");

    // 1. Upsert day_tables
    const dayRes = await pool.query(
      `INSERT INTO day_tables (date, totals)
       VALUES ($1, $2)
       ON CONFLICT (date) DO UPDATE
       SET totals = $2
       RETURNING id, date, closed, totals`,
      [date, JSON.stringify(totals)]
    );
    const dayId = dayRes.rows[0].id;

    // 2. Upsert players if provided
    if (Array.isArray(players) && players.length > 0) {
      for (const p of players) {
        if (!p.id || !p.name) continue;
        await pool.query(
          `INSERT INTO players (id, name, avatar_type, avatar_emoji, avatar_color)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             avatar_type = EXCLUDED.avatar_type,
             avatar_emoji = EXCLUDED.avatar_emoji,
             avatar_color = EXCLUDED.avatar_color`,
          [p.id, p.name, p.avatar || p.avatar_type || "clumsy", p.avatarEmoji || p.avatar_emoji || null, p.avatarColor || p.avatar_color || null]
        );
      }
    }

    // 3. Upsert each tournament and its matches
    if (Array.isArray(tournaments) && tournaments.length > 0) {
      for (const t of tournaments) {
        if (!t.id) continue;
        const pIds = t.playerIds || t.player_ids || [];
        const status = t.closed ? "completed" : (t.status || "active");
        const cfg = t.config || {};
        const shareSlug = t.shareSlug || t.share_slug || t.id.slice(0, 8);

        await pool.query(
          `INSERT INTO tournaments (id, share_slug, day_id, player_ids, status, config, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             share_slug = $2,
             player_ids = $4,
             config = $6,
             status = CASE WHEN tournaments.status = 'completed' THEN 'completed' ELSE $5 END,
             completed_at = CASE WHEN tournaments.completed_at IS NOT NULL THEN tournaments.completed_at ELSE $7 END`,
          [t.id, shareSlug, dayId, pIds, status, JSON.stringify(cfg), status === "completed" ? (t.completedAt || new Date()) : null]
        );

        // Upsert all tournament matches
        const allMatches = Array.isArray(t.matches) ? [...t.matches] : [];
        if (t.final && !allMatches.some((m) => m.id === t.final.id)) {
          allMatches.push(t.final);
        }

        for (const m of allMatches) {
          if (!m.id) continue;
          const scoreA = typeof m.scoreA === "number" ? m.scoreA : (typeof m.score_a === "number" ? m.score_a : null);
          const scoreB = typeof m.scoreB === "number" ? m.scoreB : (typeof m.score_b === "number" ? m.score_b : null);
          const played = !!m.played;
          const ptsA = typeof m.pointsA === "number" ? m.pointsA : (m.pointsAwarded && m.pointsAwarded[m.playerA || m.player_a]) ?? null;
          const ptsB = typeof m.pointsB === "number" ? m.pointsB : (m.pointsAwarded && m.pointsAwarded[m.playerB || m.player_b]) ?? null;

          await pool.query(
            `INSERT INTO matches (id, tournament_id, round, is_final, player_a, player_b, court_side, score_a, score_b, points_a, points_b, played, played_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (tournament_id, id) DO UPDATE SET
               round = EXCLUDED.round,
               is_final = EXCLUDED.is_final,
               player_a = EXCLUDED.player_a,
               player_b = EXCLUDED.player_b,
               court_side = EXCLUDED.court_side,
               score_a = EXCLUDED.score_a,
               score_b = EXCLUDED.score_b,
               points_a = EXCLUDED.points_a,
               points_b = EXCLUDED.points_b,
               played = EXCLUDED.played,
               played_at = EXCLUDED.played_at`,
            [
              m.id,
              t.id,
              m.round ?? (m.isFinal ? -1 : 0),
              !!m.isFinal,
              m.playerA || m.player_a,
              m.playerB || m.player_b,
              JSON.stringify(m.courtSide ?? {}),
              scoreA,
              scoreB,
              ptsA,
              ptsB,
              played,
              played ? (m.playedAt || new Date()) : null,
            ]
          );
        }
      }
    }

    await pool.query("COMMIT");

    io.to(`day:${date}`).emit("day:update", {
      type: "day:full_sync",
      date,
      totals,
    });

    io.emit("live:update", {
      type: "day:full_sync",
      date,
      totals,
    });

    res.json({ ok: true, message: "Day session fully synced", date, tournamentCount: tournaments?.length ?? 0 });
  } catch (err: any) {
    await pool.query("ROLLBACK");
    console.error("POST /day-tables/sync-full-day error:", err);
    res.status(500).json({ error: "Failed to sync full day session", details: err.message });
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
