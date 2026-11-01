// scripts/migrate_neon_to_firebase.mjs — Automated migration from Neon PostgreSQL to Firebase Firestore
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import pg from "pg";
import fs from "fs";

// Helper to remove any undefined fields before writing to Firestore
function cleanForFirestore(obj) {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanForFirestore);
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const cleaned = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        cleaned[k] = cleanForFirestore(v);
      }
    }
    return cleaned;
  }
  return obj;
}

// 1. Read Firebase config from .env.local
const envLocalContent = fs.readFileSync(".env.local", "utf8");
const envLocal = {};
envLocalContent.split("\n").forEach((line) => {
  const [k, ...v] = line.split("=");
  if (k && v.length > 0) envLocal[k.trim()] = v.join("=").trim();
});

const firebaseConfig = {
  apiKey: envLocal.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: envLocal.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: envLocal.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: envLocal.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envLocal.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: envLocal.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 2. Read Neon DATABASE_URL
let dbUrl = "postgresql://neondb_owner:npg_9xfnkYduo2LJ@ep-square-hall-b3fkgg2r-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
if (fs.existsSync("backend/.env")) {
  const backendEnv = fs.readFileSync("backend/.env", "utf8");
  backendEnv.split("\n").forEach((line) => {
    const [k, ...v] = line.split("=");
    if (k?.trim() === "DATABASE_URL" && v.length > 0) {
      dbUrl = v.join("=").trim();
    }
  });
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  console.log("==========================================================");
  console.log("🏸 BADMINTON NEON -> FIREBASE FIRESTORE MIGRATION SCRIPT");
  console.log("==========================================================");
  console.log(`📡 Connecting to Neon database...`);
  console.log(`🔥 Connecting to Firebase project: ${firebaseConfig.projectId}...`);

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // Test Neon connection
  try {
    await pool.query("SELECT 1");
    console.log("✅ Neon connection verified successfully!");
  } catch (err) {
    console.error("❌ Could not connect to Neon:", err.message);
    process.exit(1);
  }

  // 1. Migrate Players
  console.log("\n1️⃣  Migrating Players...");
  const playersRes = await pool.query("SELECT * FROM players");
  for (const p of playersRes.rows) {
    const pRef = doc(db, "players", p.id);
    const data = cleanForFirestore({
      id: p.id,
      name: p.name,
      avatar: p.avatar_type || "custom",
      avatarEmoji: p.avatar_emoji || null,
      avatarColor: p.avatar_color || null,
      createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
    });
    await setDoc(pRef, data, { merge: true });
  }
  console.log(`✅ Migrated ${playersRes.rowCount} players.`);

  // 2. Fetch Day Tables & Day Results
  console.log("\n2️⃣  Migrating Day Tables & Honors...");
  const daysRes = await pool.query(
    "SELECT id, date::text AS date_str, closed, totals, closed_at FROM day_tables ORDER BY date ASC"
  );
  const resultsRes = await pool.query(
    "SELECT id, date::text AS date_str, top_player_id, bottom_player_id FROM day_results"
  );
  const resultsByDate = {};
  for (const r of resultsRes.rows) {
    resultsByDate[r.date_str] = r;
  }

  const dayIdToDate = {};
  for (const d of daysRes.rows) {
    // Exclude empty abandoned day tables like 2026-10-23
    if (!d.totals || Object.keys(d.totals).length === 0) {
      console.log(`   ⏩ Skipping empty day table ${d.date_str}`);
      continue;
    }

    const dStr = d.date_str;
    dayIdToDate[d.id] = dStr;

    const honor = resultsByDate[dStr];
    const dRef = doc(db, "days", dStr);
    const dayData = cleanForFirestore({
      date: dStr,
      totals: d.totals || {},
      closed: !!d.closed,
      closedAt: d.closed_at ? new Date(d.closed_at).getTime() : null,
      topPlayerId: honor?.top_player_id || null,
      spoonPlayerId: honor?.bottom_player_id || null,
      tournamentIds: [], // will be populated below
      updatedAt: Date.now(),
    });
    await setDoc(dRef, dayData, { merge: true });
  }
  console.log(`✅ Migrated valid day tables.`);

  // 3. Migrate Tournaments & Matches
  console.log("\n3️⃣  Migrating Tournaments & Matches...");
  const tourneysRes = await pool.query(
    "SELECT id, share_slug, day_id, player_ids, status, config, created_at, completed_at FROM tournaments ORDER BY created_at ASC"
  );
  const dayTourneyMap = {};

  for (const t of tourneysRes.rows) {
    const mRes = await pool.query(
      `SELECT id, round, is_final, player_a, player_b, court_side,
              score_a, score_b, points_a, points_b, played, played_at
       FROM matches WHERE tournament_id = $1 ORDER BY round ASC, is_final ASC`,
      [t.id]
    );

    const matches = [];
    let finalMatch = null;

    for (const m of mRes.rows) {
      const courtSide = m.court_side || {};
      const matchObj = {
        id: m.id,
        round: m.round ?? 0,
        isFinal: !!m.is_final,
        playerA: m.player_a,
        playerB: m.player_b,
        courtSide,
        scoreA: m.score_a ?? null,
        scoreB: m.score_b ?? null,
        pointsAwarded: {
          [m.player_a]: m.points_a ?? 0,
          [m.player_b]: m.points_b ?? 0,
        },
        played: !!m.played,
        playedAt: m.played_at ? new Date(m.played_at).getTime() : null,
      };

      if (m.is_final) {
        finalMatch = matchObj;
      } else {
        matches.push(matchObj);
      }
    }

    const tDate = t.day_id && dayIdToDate[t.day_id]
      ? dayIdToDate[t.day_id]
      : (t.created_at ? new Date(t.created_at).toISOString().split("T")[0] : null);

    if (tDate) {
      if (!dayTourneyMap[tDate]) dayTourneyMap[tDate] = [];
      dayTourneyMap[tDate].push(t.id);
    }

    const tRef = doc(db, "tournaments", t.id);
    const tourneyPayload = cleanForFirestore({
      id: t.id,
      shareSlug: t.share_slug || t.id,
      date: tDate,
      playerIds: t.player_ids || [],
      matches,
      final: finalMatch,
      config: t.config || {},
      status: t.status || "completed",
      closed: t.status === "completed" || t.status === "final" || true,
      createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
      completedAt: t.completed_at ? new Date(t.completed_at).getTime() : null,
      updatedAt: Date.now(),
    });

    await setDoc(tRef, tourneyPayload, { merge: true });
  }
  console.log(`✅ Migrated ${tourneysRes.rowCount} tournaments with their matches.`);

  // 4. Update Days with tournamentIds
  console.log("\n4️⃣  Linking Tournaments to Days...");
  for (const [dateStr, tIds] of Object.entries(dayTourneyMap)) {
    const dRef = doc(db, "days", dateStr);
    await setDoc(dRef, { tournamentIds: tIds, updatedAt: Date.now() }, { merge: true });
    console.log(`   📅 Day ${dateStr} linked with ${tIds.length} tournament(s): [${tIds.join(", ")}]`);
  }
  console.log(`✅ Linked tournaments to all day tables.`);

  console.log("\n==========================================================");
  console.log("🎉 NEON -> FIREBASE MIGRATION FINISHED SUCCESSFULLY!");
  console.log("==========================================================");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
