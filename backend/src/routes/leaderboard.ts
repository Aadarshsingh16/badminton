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
      WITH date_filtered_days AS (
        SELECT id, date, totals FROM day_tables d WHERE 1=1 ${dateFilter}
      ),
      day_points AS (
        SELECT p.id as player_id, SUM((d.totals->>p.id)::int) as day_points_total
        FROM players p
        CROSS JOIN date_filtered_days d
        WHERE (d.totals->>p.id) IS NOT NULL
        GROUP BY p.id
      ),
      league_stats AS (
        SELECT
          p.id as player_id,
          COUNT(m.id) as league_matches_played,
          SUM(CASE WHEN (m.player_a = p.id AND m.score_a > m.score_b) OR (m.player_b = p.id AND m.score_b > m.score_a) THEN 1 ELSE 0 END) as league_wins,
          SUM(CASE WHEN m.player_a = p.id THEN m.points_a ELSE m.points_b END) as league_points,
          SUM(CASE WHEN m.player_a = p.id THEN (m.score_a - m.score_b) ELSE (m.score_b - m.score_a) END) as league_point_diff,
          SUM(CASE WHEN (m.player_a = p.id AND m.score_b = 0) OR (m.player_b = p.id AND m.score_a = 0) THEN 1 ELSE 0 END) as shutout_wins,
          SUM(CASE WHEN (m.player_a = p.id AND m.score_a = 0) OR (m.player_b = p.id AND m.score_b = 0) THEN 1 ELSE 0 END) as shutout_losses,
          MAX(CASE WHEN (m.player_a = p.id AND m.score_a > m.score_b) THEN (m.score_a - m.score_b) WHEN (m.player_b = p.id AND m.score_b > m.score_a) THEN (m.score_b - m.score_a) ELSE 0 END) as highest_win_margin
        FROM players p
        JOIN matches m ON (m.player_a = p.id OR m.player_b = p.id) AND m.played = true AND (m.is_final = false AND m.round != -1)
        JOIN tournaments t ON m.tournament_id = t.id
        JOIN date_filtered_days d ON t.day_id = d.id
        GROUP BY p.id
      ),
      final_stats AS (
        SELECT
          p.id as player_id,
          COUNT(m.id) as finals_played,
          SUM(CASE WHEN (m.player_a = p.id AND m.score_a > m.score_b) OR (m.player_b = p.id AND m.score_b > m.score_a) THEN 1 ELSE 0 END) as finals_won
        FROM players p
        JOIN matches m ON (m.player_a = p.id OR m.player_b = p.id) AND m.played = true AND (m.is_final = true OR m.round = -1)
        JOIN tournaments t ON m.tournament_id = t.id
        JOIN date_filtered_days d ON t.day_id = d.id
        GROUP BY p.id
      )
      SELECT
        p.id AS "playerId",
        p.name,
        p.avatar_type AS "avatar",
        p.avatar_emoji AS "avatarEmoji",
        p.avatar_color AS "avatarColor",
        COALESCE(dp.day_points_total, 0)::int AS "dayPointsTotal",
        COALESCE(ls.league_matches_played, 0)::int AS "leagueMatchesPlayed",
        COALESCE(ls.league_wins, 0)::int AS "leagueWins",
        COALESCE(ls.league_points, 0)::int AS "leaguePoints",
        COALESCE(ls.league_point_diff, 0)::int AS "leaguePointDiff",
        COALESCE(ls.shutout_wins, 0)::int AS "shutoutWins",
        COALESCE(ls.shutout_losses, 0)::int AS "shutoutLosses",
        COALESCE(ls.highest_win_margin, 0)::int AS "highestWinMargin",
        COALESCE(fs.finals_played, 0)::int AS "finalsPlayed",
        COALESCE(fs.finals_won, 0)::int AS "finalsWon",
        CASE WHEN COALESCE(ls.league_matches_played, 0) > 0 THEN ROUND((COALESCE(ls.league_wins, 0)::numeric / ls.league_matches_played::numeric) * 100, 1) ELSE 0 END AS "leagueWinRate"
      FROM players p
      LEFT JOIN day_points dp ON p.id = dp.player_id
      LEFT JOIN league_stats ls ON p.id = ls.player_id
      LEFT JOIN final_stats fs ON p.id = fs.player_id
      WHERE COALESCE(ls.league_matches_played, 0) > 0 OR COALESCE(dp.day_points_total, 0) > 0 OR COALESCE(fs.finals_played, 0) > 0
    `;

    const result = await pool.query(query, params);
    let rows = result.rows;

    // Sorting
    if (sortBy === "matches") {
      rows.sort((a, b) => b.leagueMatchesPlayed - a.leagueMatchesPlayed || b.dayPointsTotal - a.dayPointsTotal);
    } else if (sortBy === "wins") {
      rows.sort((a, b) => b.leagueWins - a.leagueWins || b.dayPointsTotal - a.dayPointsTotal);
    } else {
      // Default: points
      rows.sort((a, b) => b.dayPointsTotal - a.dayPointsTotal || b.leaguePoints - a.leaguePoints || b.leaguePointDiff - a.leaguePointDiff);
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

