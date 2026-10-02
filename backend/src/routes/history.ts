import { Router } from "express";
import { pool } from "../db/client";

export const historyRouter = Router();

// GET /history — filterable match history
historyRouter.get("/", async (req, res) => {
  const { range, from, to, playerId, scorePattern } = req.query as {
    range?: string;
    from?: string;
    to?: string;
    playerId?: string;
    scorePattern?: string;
  };

  try {
    let whereClauses: string[] = ["m.played = true"];
    let params: any[] = [];
    let pIdx = 1;

    // Date range filter
    if (from && to) {
      whereClauses.push(`d.date >= $${pIdx} AND d.date <= $${pIdx + 1}`);
      params.push(from, to);
      pIdx += 2;
    } else if (range === "day") {
      whereClauses.push(`d.date = CURRENT_DATE`);
    } else if (range === "week") {
      whereClauses.push(`d.date >= CURRENT_DATE - INTERVAL '7 days'`);
    } else if (range === "month") {
      whereClauses.push(`d.date >= CURRENT_DATE - INTERVAL '30 days'`);
    }

    // Player filter
    if (playerId) {
      whereClauses.push(`(m.player_a = $${pIdx} OR m.player_b = $${pIdx})`);
      params.push(playerId);
      pIdx++;
    }

    // Score pattern filter
    if (scorePattern) {
      if (scorePattern === "blowout" || scorePattern === "margin>=4") {
        whereClauses.push(`abs(m.score_a - m.score_b) >= 4`);
      } else if (scorePattern.includes("-")) {
        const [s1, s2] = scorePattern.split("-").map((s) => parseInt(s.trim(), 10));
        if (!isNaN(s1) && !isNaN(s2)) {
          whereClauses.push(`((m.score_a = $${pIdx} AND m.score_b = $${pIdx + 1}) OR (m.score_a = $${pIdx + 1} AND m.score_b = $${pIdx}))`);
          params.push(s1, s2);
          pIdx += 2;
        }
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `
      SELECT
        m.id,
        m.tournament_id AS "tournamentId",
        m.round,
        m.is_final AS "isFinal",
        m.player_a AS "playerA",
        m.player_b AS "playerB",
        pa.name AS "playerAName",
        pa.avatar_type AS "playerAAvatar",
        pa.avatar_emoji AS "playerAAvatarEmoji",
        pa.avatar_color AS "playerAAvatarColor",
        pb.name AS "playerBName",
        pb.avatar_type AS "playerBAvatar",
        pb.avatar_emoji AS "playerBAvatarEmoji",
        pb.avatar_color AS "playerBAvatarColor",
        m.score_a AS "scoreA",
        m.score_b AS "scoreB",
        m.points_a AS "pointsA",
        m.points_b AS "pointsB",
        m.played,
        m.played_at AS "playedAt",
        t.share_slug AS "shareSlug",
        d.date AS "date"
      FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      JOIN day_tables d ON t.day_id = d.id
      LEFT JOIN players pa ON m.player_a = pa.id
      LEFT JOIN players pb ON m.player_b = pb.id
      ${whereSql}
      ORDER BY d.date DESC, m.played_at DESC, m.round ASC
    `;

    const result = await pool.query(query, params);
    const rows = result.rows;

    // Group results by day -> tournament
    const daysMap: { [date: string]: { date: string; tournaments: { [tId: string]: { tournamentId: string; shareSlug: string; matches: any[] } } } } = {};

    let totalPoints = 0;
    const playerStats: { [id: string]: { name: string; points: number; matches: number; wins: number } } = {};

    for (const r of rows) {
      const dateStr = typeof r.date === "string" ? r.date : r.date.toISOString().split("T")[0];
      if (!daysMap[dateStr]) {
        daysMap[dateStr] = { date: dateStr, tournaments: {} };
      }

      if (!daysMap[dateStr].tournaments[r.tournamentId]) {
        daysMap[dateStr].tournaments[r.tournamentId] = {
          tournamentId: r.tournamentId,
          shareSlug: r.shareSlug,
          matches: [],
        };
      }

      daysMap[dateStr].tournaments[r.tournamentId].matches.push(r);

      // Tally summary stats for the filtered range
      totalPoints += (r.pointsA ?? 0) + (r.pointsB ?? 0);

      if (!playerStats[r.playerA]) {
        playerStats[r.playerA] = { name: r.playerAName ?? r.playerA, points: 0, matches: 0, wins: 0 };
      }
      if (!playerStats[r.playerB]) {
        playerStats[r.playerB] = { name: r.playerBName ?? r.playerB, points: 0, matches: 0, wins: 0 };
      }

      playerStats[r.playerA].matches++;
      playerStats[r.playerB].matches++;
      playerStats[r.playerA].points += r.pointsA ?? 0;
      playerStats[r.playerB].points += r.pointsB ?? 0;

      if (r.scoreA > r.scoreB) playerStats[r.playerA].wins++;
      if (r.scoreB > r.scoreA) playerStats[r.playerB].wins++;
    }

    const groupedDays = Object.values(daysMap).map((d) => ({
      date: d.date,
      tournaments: Object.values(d.tournaments),
    }));

    const miniLeaderboard = Object.entries(playerStats)
      .map(([playerId, s]) => ({ playerId, ...s }))
      .sort((a, b) => b.points - a.points);

    res.json({
      totalMatches: rows.length,
      totalPoints,
      days: groupedDays,
      miniLeaderboard,
    });
  } catch (err: any) {
    console.error("GET /history error:", err);
    res.status(500).json({ error: "Failed to fetch history", details: err.message });
  }
});
