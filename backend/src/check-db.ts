import { Pool } from 'pg';

import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const res = await pool.query("SELECT * FROM day_tables ORDER BY date DESC");
  console.log("DAY TABLES:");
  console.table(res.rows);
  pool.end();
}
check();
