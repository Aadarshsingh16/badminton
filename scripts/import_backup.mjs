// scripts/import_backup.mjs — Import downloaded JSON backup into Firebase Firestore
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";

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
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/import_backup.mjs <path-to-backup.json>");
    process.exit(1);
  }

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
      await setDoc(
        tRef,
        {
          ...t,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      tourneyCount++;
    }
  }

  // 2. Completed Days
  const completedDays = Array.isArray(data.completedDays) ? data.completedDays : [];
  for (const cd of completedDays) {
    if (cd && cd.date) {
      const dRef = doc(db, "days", cd.date);
      await setDoc(
        dRef,
        {
          ...cd,
          closed: true,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      dayCount++;
    }
  }

  // 3. Day Table if present
  if (data.dayTable && data.dayTable.date) {
    const dRef = doc(db, "days", data.dayTable.date);
    await setDoc(
      dRef,
      {
        date: data.dayTable.date,
        totals: data.dayTable.totals || {},
        tournamentIds: data.dayTable.tournaments || [],
        closed: false,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    dayCount++;
  }

  console.log(`✅ Successfully uploaded to Firestore:`);
  console.log(`   - ${tourneyCount} tournaments`);
  console.log(`   - ${dayCount} days`);
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Migration error:", err);
  process.exit(1);
});

