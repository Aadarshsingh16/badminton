import { pool } from "./backend/src/db/client";

async function run() {
  const tRes = await pool.query("SELECT id FROM tournaments ORDER BY created_at DESC LIMIT 2");
  if (tRes.rowCount < 2) return;
  const t2Id = tRes.rows[0].id; // The most recent is T2
  
  const mRes = await pool.query("SELECT * FROM matches WHERE tournament_id = $1 AND is_final = false", [t2Id]);
  
  console.log("T2 Matches:");
  for (const m of mRes.rows) {
    console.log(`${m.player_a} vs ${m.player_b}: played=${m.played}`);
  }

  process.exit(0);
}
run();
