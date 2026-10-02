import { Pool } from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("neon.tech"))
    ? { rejectUnauthorized: false }
    : undefined,
  max: 5, // conservative pool size for free-tier limits
});

export async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.warn("⚠️  DATABASE_URL is not set. Skipping migration.");
    return;
  }

  // Look for migration file in src or dist
  const candidates = [
    path.join(__dirname, "migrations/001_initial.sql"),
    path.join(__dirname, "../src/db/migrations/001_initial.sql"),
    path.join(process.cwd(), "src/db/migrations/001_initial.sql"),
    path.join(process.cwd(), "dist/db/migrations/001_initial.sql"),
  ];

  const migrationPath = candidates.find((p) => fs.existsSync(p));
  if (!migrationPath) {
    console.error("❌ Migration file 001_initial.sql not found in candidate paths:", candidates);
    return;
  }

  const sql = fs.readFileSync(migrationPath, "utf-8");
  await pool.query(sql);
  console.log("✅ Neon Postgres schema migration complete");
}
