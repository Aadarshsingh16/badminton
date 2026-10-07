import { pool } from "./backend/src/db/client";

async function run() {
  const t2 = await pool.query("SELECT * FROM tournaments ORDER BY created_at DESC LIMIT 2");
  console.log("Recent Tournaments:");
  console.dir(t2.rows, { depth: null });
  
  const m2 = await pool.query("SELECT * FROM matches WHERE tournament_id = $1", [t2.rows[0].id]);
  console.log("\nMatches in the latest tournament:");
  console.dir(m2.rows, { depth: null });
  
  process.exit(0);
}
run();
