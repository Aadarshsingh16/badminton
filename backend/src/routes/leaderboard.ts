import { Router } from "express";
import { pool } from "../db/client";
import { requireScorekeeper } from "../middleware/auth";

export const leaderboardRouter = Router();

// GET /leaderboard — overall ranking sortable by points or matches
leaderboardRouter.get("/", async (req, res) => {
  const { range, from, to, sortBy } = req.query as {
    range?: string;
    from?: string;
    to?: string;
    sortBy?: "points" | "matches" | "wins";
  };

  try {
    let dateFilter = "";
    const params: any[] = [];

    if (from && to) {
      dateFilter = "AND d.date >= $1 AND d.date <= $2";
      params.push(from, to);
    } else if (range === "day") {
      dateFilter = "AND d.date = CURRENT_DATE";
    } else if (range === "week") {
      dateFilter = "AND d.date >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (range === "month") {
      dateFilter = "AND d.date >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const query = `
      WITH player_matches AS (
        SELECT
          p.id AS player_id,
          p.name,
          p.avatar_type AS "avatar",
          p.avatar_emoji AS "avatarEmoji",
          p.avatar_color AS "avatarColor",
          COUNT(m.id) AS matches_played,
          SUM(CASE WHEN (m.player_a = p.id AND m.score_a > m.score_b) OR (m.player_b = p.id AND m.score_b > m.score_a) THEN 1 ELSE 0 END) AS wins,
          SUM(CASE WHEN m.player_a = p.id THEN m.points_a ELSE m.points_b END) AS total_points,
          SUM(CASE WHEN m.player_a = p.id THEN (m.score_a - m.score_b) ELSE (m.score_b - m.score_a) END) AS point_diff
        FROM players p
        JOIN matches m ON (m.player_a = p.id OR m.player_b = p.id) AND m.played = true
        JOIN tournaments t ON m.tournament_id = t.id
        JOIN day_tables d ON t.day_id = d.id
        WHERE 1=1 ${dateFilter}
        GROUP BY p.id, p.name, p.avatar_type, p.avatar_emoji, p.avatar_color
      )
      SELECT
        player_id AS "playerId",
        name,
        avatar,
        "avatarEmoji",
        "avatarColor",
        COALESCE(matches_played, 0)::int AS "matchesPlayed",
        COALESCE(wins, 0)::int AS "wins",
        COALESCE(total_points, 0)::int AS "totalPoints",
        COALESCE(point_diff, 0)::int AS "pointDiff",
        CASE WHEN matches_played > 0 THEN ROUND((wins::numeric / matches_played::numeric) * 100, 1) ELSE 0 END AS "winRate"
      FROM player_matches
    `;

    const result = await pool.query(query, params);
    let rows = result.rows;

    // Sorting
    if (sortBy === "matches") {
      rows.sort((a, b) => b.matchesPlayed - a.matchesPlayed || b.totalPoints - a.totalPoints);
    } else if (sortBy === "wins") {
      rows.sort((a, b) => b.wins - a.wins || b.totalPoints - a.totalPoints);
    } else {
      // Default: points
      rows.sort((a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins || b.pointDiff - a.pointDiff);
    }

    res.json(rows);
  } catch (err: any) {
    console.error("GET /leaderboard error:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard", details: err.message });
  }
});

// GET /day-results — all-time Day Champions and Last-Place counts
export const dayResultsRouter = Router();

dayResultsRouter.get("/", async (_req, res) => {
  try {
    const historyQuery = `
      SELECT
        dr.id,
        dr.date,
        dr.top_player_id AS "topPlayerId",
        tp.name AS "topPlayerName",
        tp.avatar_type AS "topPlayerAvatar",
        tp.avatar_emoji AS "topPlayerAvatarEmoji",
        tp.avatar_color AS "topPlayerAvatarColor",
        dr.bottom_player_id AS "bottomPlayerId",
        bp.name AS "bottomPlayerName",
        bp.avatar_type AS "bottomPlayerAvatar",
        bp.avatar_emoji AS "bottomPlayerAvatarEmoji",
        bp.avatar_color AS "bottomPlayerAvatarColor"
      FROM day_results dr
      LEFT JOIN players tp ON dr.top_player_id = tp.id
      LEFT JOIN players bp ON dr.bottom_player_id = bp.id
      ORDER BY dr.date DESC
    `;

    const result = await pool.query(historyQuery);
    const history = result.rows;

    // Tally Day Champions & Last-Place counts
    const championsMap: { [id: string]: { playerId: string; name: string; avatar: string; emoji?: string; color?: string; count: number } } = {};
    const lastPlaceMap: { [id: string]: { playerId: string; name: string; avatar: string; emoji?: string; color?: string; count: number } } = {};

    for (const row of history) {
      if (row.topPlayerId) {
        if (!championsMap[row.topPlayerId]) {
          championsMap[row.topPlayerId] = {
            playerId: row.topPlayerId,
            name: row.topPlayerName,
            avatar: row.topPlayerAvatar,
            emoji: row.topPlayerAvatarEmoji,
            color: row.topPlayerAvatarColor,
            count: 0,
          };
        }
        championsMap[row.topPlayerId].count++;
      }

      if (row.bottomPlayerId) {
        if (!lastPlaceMap[row.bottomPlayerId]) {
          lastPlaceMap[row.bottomPlayerId] = {
            playerId: row.bottomPlayerId,
            name: row.bottomPlayerName,
            avatar: row.bottomPlayerAvatar,
            emoji: row.bottomPlayerAvatarEmoji,
            color: row.bottomPlayerAvatarColor,
            count: 0,
          };
        }
        lastPlaceMap[row.bottomPlayerId].count++;
      }
    }

    const dayChampions = Object.values(championsMap).sort((a, b) => b.count - a.count);
    const dayLastPlaces = Object.values(lastPlaceMap).sort((a, b) => b.count - a.count);

    res.json({
      dayChampions,
      dayLastPlaces,
      history,
    });
  } catch (err: any) {
    console.error("GET /day-results error:", err);
    res.status(500).json({ error: "Failed to fetch day results", details: err.message });
  }
});

// DELETE /day-results/:date — delete day honors record for a date or ID (scorekeeper only)
dayResultsRouter.delete("/:date", requireScorekeeper, async (req, res) => {
  const { date } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM day_results WHERE date::text = $1 OR id::text = $1`,
      [date]
    );
    res.json({ success: true, deletedDate: date, rowCount: result.rowCount });
  } catch (err: any) {
    console.error("DELETE /day-results/:date error:", err);
    res.status(500).json({ error: "Failed to delete day result", details: err.message });
  }
});

