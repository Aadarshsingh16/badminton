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

  // Look for migration directory in candidates
  const dirCandidates = [
    path.join(__dirname, "migrations"),
    path.join(__dirname, "../src/db/migrations"),
    path.join(process.cwd(), "src/db/migrations"),
    path.join(process.cwd(), "dist/db/migrations"),
  ];

  const migrationsDir = dirCandidates.find((d) => fs.existsSync(d));
  if (!migrationsDir) {
    console.error("❌ Migration directory not found in candidate paths:", dirCandidates);
    return;
  }

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");
    try {
      await pool.query(sql);
      console.log(`✅ Migration applied: ${file}`);
    } catch (err: any) {
      console.error(`❌ Migration error on ${file}:`, err.message);
    }
  }
}
