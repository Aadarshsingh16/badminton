import { Pool } from "pg";
import { computeDayPoints, deriveTournamentTable } from "./lib/ranking";
import { Tournament, TournamentConfig, DEFAULT_CONFIG } from "./lib/types";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const tIds18 = ["pphuektzmvdq6x52", "3prxyal7mvdsckif"];
  const tIds11 = ["cvn6q9vimv3q3d9v", "jmvuh9gsmv3rfkru", "5h4w6113mv3sa2qu"];

  console.log("=== 18th October Tournaments ===");
  const totals18: Record<string, number> = {};
  for (const tid of tIds18) {
    const tRes = await pool.query("SELECT * FROM tournaments WHERE id = $1", [tid]);
    const mRes = await pool.query("SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round ASC", [tid]);
    const t = tRes.rows[0];
    const matches = mRes.rows.filter((m: any) => !m.is_final && m.round !== -1).map((m: any) => ({
      id: m.id,
      playerA: m.player_a,
      playerB: m.player_b,
      round: m.round,
      scoreA: m.score_a,
      scoreB: m.score_b,
      played: m.played,
      courtSide: m.court_side,
      pointsAwarded: { [m.player_a]: m.points_a ?? 0, [m.player_b]: m.points_b ?? 0 },
    }));
    const finalRow = mRes.rows.find((m: any) => m.is_final || m.round === -1);
    const final = finalRow ? {
      playerA: finalRow.player_a,
      playerB: finalRow.player_b,
      scoreA: finalRow.score_a,
      scoreB: finalRow.score_b,
      played: finalRow.played,
      courtSide: finalRow.court_side,
      pointsAwarded: { [finalRow.player_a]: finalRow.points_a ?? 0, [finalRow.player_b]: finalRow.points_b ?? 0 },
    } : null;

    const cfg: TournamentConfig = typeof t.config === "string" ? JSON.parse(t.config) : (t.config || DEFAULT_CONFIG);
    const tourney: Tournament = {
      id: t.id,
      shareSlug: t.share_slug,
      playerIds: t.player_ids,
      matches,
      final: final || undefined,
      config: cfg,
      isPractice: false,
      closed: true,
      createdAt: new Date(t.created_at).getTime(),
    };
    const dayPts = computeDayPoints(tourney);
    console.log(`Tournament ${tid}:`, dayPts);
    for (const [p, pts] of Object.entries(dayPts)) {
      totals18[p] = (totals18[p] || 0) + pts;
    }
  }
  console.log("18th October Day Totals:", totals18);

  console.log("\n=== 11th October Tournaments ===");
  const totals11: Record<string, number> = {};
  for (const tid of tIds11) {
    const tRes = await pool.query("SELECT * FROM tournaments WHERE id = $1", [tid]);
    const mRes = await pool.query("SELECT * FROM matches WHERE tournament_id = $1 ORDER BY round ASC", [tid]);
    const t = tRes.rows[0];
    const matches = mRes.rows.filter((m: any) => !m.is_final && m.round !== -1).map((m: any) => ({
      id: m.id,
      playerA: m.player_a,
      playerB: m.player_b,
      round: m.round,
      scoreA: m.score_a,
      scoreB: m.score_b,
      played: m.played,
      courtSide: m.court_side,
      pointsAwarded: { [m.player_a]: m.points_a ?? 0, [m.player_b]: m.points_b ?? 0 },
    }));
    const finalRow = mRes.rows.find((m: any) => m.is_final || m.round === -1);
    const final = finalRow ? {
      playerA: finalRow.player_a,
      playerB: finalRow.player_b,
      scoreA: finalRow.score_a,
      scoreB: finalRow.score_b,
      played: finalRow.played,
      courtSide: finalRow.court_side,
      pointsAwarded: { [finalRow.player_a]: finalRow.points_a ?? 0, [finalRow.player_b]: finalRow.points_b ?? 0 },
    } : null;

    const cfg: TournamentConfig = typeof t.config === "string" ? JSON.parse(t.config) : (t.config || DEFAULT_CONFIG);
    const tourney: Tournament = {
      id: t.id,
      shareSlug: t.share_slug,
      playerIds: t.player_ids,
      matches,
      final: final || undefined,
      config: cfg,
      isPractice: false,
      closed: true,
      createdAt: new Date(t.created_at).getTime(),
    };
    const dayPts = computeDayPoints(tourney);
    console.log(`Tournament ${tid}:`, dayPts);
    for (const [p, pts] of Object.entries(dayPts)) {
      totals11[p] = (totals11[p] || 0) + pts;
    }
  }
  console.log("11th October Day Totals:", totals11);

  process.exit(0);
}

main().catch(console.error);
