// scripts/import_backup.mjs — Import downloaded JSON backup into Firebase Firestore
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";

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

// Read .env.local
const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const [k, ...v] = line.split("=");
  if (k && v.length > 0) env[k.trim()] = v.join("=").trim();
});

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

async function run() {
  const filePath = process.argv[2] || "/Users/akshat12/Documents/badminton/badminton-backup-2026-10-31.json";
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(fullPath, "utf8");
  const data = JSON.parse(raw);

  console.log(`Connecting to Firebase project: ${firebaseConfig.projectId}...`);
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  let tourneyCount = 0;
  let dayCount = 0;

  // 1. Tournaments
  const tournaments = Array.isArray(data.tournaments) ? data.tournaments : [];
  for (const t of tournaments) {
    if (t && t.id) {
      const tRef = doc(db, "tournaments", t.id);
      const payload = cleanForFirestore({
        ...t,
        status: "completed",
        closed: true,
        updatedAt: Date.now(),
      });
      await setDoc(tRef, payload, { merge: true });
      tourneyCount++;
      console.log(`   🏆 Uploaded Tournament ${t.id} (${t.matches ? t.matches.length : 0} matches)`);
    }
  }

  // 2. Day Table / Session
  if (data.dayTable && data.dayTable.date) {
    const totals = data.dayTable.totals || {};
    const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a);
    const topPlayerId = sorted[0]?.[0] || null;
    const spoonPlayerId = sorted.length > 1 ? sorted[sorted.length - 1]?.[0] : null;

    const dRef = doc(db, "days", data.dayTable.date);
    const dayPayload = cleanForFirestore({
      date: data.dayTable.date,
      totals,
      tournamentIds: data.dayTable.tournaments || tournaments.map((t) => t.id),
      closed: true,
      topPlayerId,
      spoonPlayerId,
      updatedAt: Date.now(),
    });

    await setDoc(dRef, dayPayload, { merge: true });
    dayCount++;
    console.log(`   📅 Uploaded Day ${data.dayTable.date} (Top: ${topPlayerId}, Spoon: ${spoonPlayerId})`);
  }

  console.log(`\n==========================================================`);
  console.log(`✅ SUCCESSFULLY MIGRATED TO FIREBASE FIRESTORE:`);
  console.log(`   - ${tourneyCount} tournaments from today`);
  console.log(`   - ${dayCount} day table session`);
  console.log(`==========================================================`);
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Migration error:", err);
  process.exit(1);
});
