# Phase 9 — Backend Setup Guide
> Read this before writing a single line of code for Phase 9.
> Follow every step in order. Each step tells you exactly what to click, what to copy, and what to paste.

---

## 0. Free-tier limits to confirm first

Before spending time on setup, open both pages and check current limits (free-tier terms change):

| Service | Check | URL |
|---|---|---|
| **Neon** | Storage cap, connection count, compute hours/month | https://neon.tech/pricing |
| **Render** | Free web service: does it still sleep after 15 min? Any hour caps? | https://render.com/pricing |

✅ Once confirmed, continue. The rest of this guide assumes current limits are still fine for a friend-group app.

---

## 1. Neon — Create the database (5 min)

### 1.1 Sign up
1. Go to → **https://neon.tech**
2. Sign up with GitHub (easiest — no new password to remember)
3. You'll land on the Neon console dashboard

### 1.2 Create a project
1. Click **"New Project"**
2. Name: `badminton`
3. Region: pick the one **closest to India** (currently: `AWS ap-southeast-1` Singapore or `AWS ap-south-1` Mumbai — check what's available)
4. Postgres version: leave as default (latest stable)
5. Click **"Create Project"**

### 1.3 Copy the connection string
1. Neon shows a **"Connection Details"** panel immediately after project creation
2. Select tab: **"Connection string"**
3. Make sure **"Pooled connection"** toggle is ON (important for serverless/sleep-wake scenarios)
4. Copy the full string — looks like:
   ```
   postgresql://badminton_owner:<password>@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
5. Save it somewhere safe — you'll paste it into Render later as `DATABASE_URL`

### 1.4 Note your database name
- Default is `neondb` — confirm in the connection string. You can rename it in the project settings if you prefer.

---

## 2. Render — Create the web service (10 min)

### 2.1 Sign up
1. Go to → **https://render.com**
2. Sign up with GitHub (same account as your frontend if you have one)

### 2.2 Create a Web Service
1. Dashboard → **"New +"** → **"Web Service"**
2. Connect your GitHub repo: `Aadarshsingh16/badminton`
3. **Root Directory:** `backend` ← critical, otherwise it tries to deploy your Next.js frontend
4. **Runtime:** `Node`
5. **Build Command:** `npm install && npm run build`
6. **Start Command:** `node dist/index.js`
7. **Instance Type:** Free
8. Click **"Create Web Service"** — Render will fail the first deploy because `backend/` doesn't exist yet; that's fine, we'll push the code next

### 2.3 Add Environment Variables
In your Render service → **"Environment"** tab → **"Add Environment Variable"**:

| Key | Value |
|---|---|
| `DATABASE_URL` | *(paste the Neon connection string from Step 1.3)* |
| `PORT` | `10000` *(Render's default, but set it explicitly)* |
| `SCOREKEEPER_PIN` | *(any secret string, e.g. `badminton2024` — share this only with yourself)* |
| `NODE_ENV` | `production` |

Click **"Save Changes"**.

---

## 3. Create the `backend/` project locally

Run these commands from `c:\projects\badminton`:

```powershell
# Create backend folder and init
mkdir backend
cd backend
npm init -y

# Install dependencies
npm install express socket.io pg cors dotenv nanoid
npm install --save-dev typescript ts-node-dev @types/express @types/node @types/pg @types/cors

# Init TypeScript config
npx tsc --init
```

Then open `backend/tsconfig.json` and set:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Add to `backend/package.json` scripts:
```json
"scripts": {
  "dev": "ts-node-dev --respawn src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

Create `backend/.env.example`:
```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
PORT=3001
SCOREKEEPER_PIN=your-secret-pin
NODE_ENV=development
```

Create `backend/.env` (gitignored):
```env
DATABASE_URL=<paste your Neon connection string here>
PORT=3001
SCOREKEEPER_PIN=badminton2024
NODE_ENV=development
```

Make sure `backend/.env` is in `.gitignore` (it already is if you use the root `.gitignore` which has `*.env`).

---

## 4. Create the database migration

Create `backend/src/db/migrations/001_initial.sql`:

```sql
-- Players
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  avatar_type TEXT NOT NULL,
  avatar_emoji TEXT,
  avatar_color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Day tables
CREATE TABLE IF NOT EXISTS day_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  closed BOOLEAN DEFAULT false,
  totals JSONB,
  closed_at TIMESTAMPTZ
);

-- Tournaments
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_slug TEXT UNIQUE NOT NULL,
  day_id UUID REFERENCES day_tables(id),
  player_ids UUID[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'final' | 'completed'
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Matches
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  round INT NOT NULL,
  is_final BOOLEAN DEFAULT false,
  player_a UUID REFERENCES players(id),
  player_b UUID REFERENCES players(id),
  court_side JSONB,
  score_a INT,
  score_b INT,
  points_a INT,
  points_b INT,
  played BOOLEAN DEFAULT false,
  played_at TIMESTAMPTZ
);

-- Day results (for leaderboard — Phase 13)
CREATE TABLE IF NOT EXISTS day_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_table_id UUID REFERENCES day_tables(id),
  date DATE NOT NULL,
  top_player_id UUID REFERENCES players(id),
  bottom_player_id UUID REFERENCES players(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tournaments_slug ON tournaments(share_slug);
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_day_tables_date ON day_tables(date);
```

Create `backend/src/db/client.ts`:
```typescript
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,  // conservative — Neon free tier has connection limits
});

export async function runMigration() {
  const fs = await import("fs");
  const path = await import("path");
  const sql = fs.readFileSync(
    path.join(__dirname, "migrations/001_initial.sql"),
    "utf-8"
  );
  await pool.query(sql);
  console.log("✅ Migration complete");
}
```

---

## 5. Create the Express entry point

Create `backend/src/index.ts`:
```typescript
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { pool, runMigration } from "./db/client";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

// ── Health endpoint (keep-alive target) ──────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  socket.on("join:tournament", (slug: string) => {
    socket.join(`tournament:${slug}`);
  });
  socket.on("leave:tournament", (slug: string) => {
    socket.leave(`tournament:${slug}`);
  });
});

// Export io so routes can broadcast
export { io };

// ── Routes (stub — implemented in Phase 10) ───────────────────────────────────
// app.use("/players", playersRouter);
// app.use("/tournaments", tournamentsRouter);
// app.use("/day-tables", dayTablesRouter);
// app.use("/history", historyRouter);
// app.use("/leaderboard", leaderboardRouter);

const PORT = parseInt(process.env.PORT ?? "3001", 10);

httpServer.listen(PORT, async () => {
  console.log(`🏸 Backend running on port ${PORT}`);
  try {
    await runMigration();
  } catch (err) {
    console.error("Migration error:", err);
  }
});
```

---

## 6. Verify locally

```powershell
cd backend
npm run dev
```

Expected output:
```
🏸 Backend running on port 3001
✅ Migration complete
```

Then test the health endpoint:
```powershell
curl http://localhost:3001/health
# {"status":"ok","timestamp":"..."}
```

If you see this — Phase 9 backend scaffold is working locally. ✅

---

## 7. Deploy to Render

```powershell
# From repo root
cd c:\projects\badminton
git add backend/
git commit -m "feat(phase-9): backend scaffold — Express + Socket.io + Neon schema + health endpoint"
git push
```

Render will automatically redeploy when it sees the push. Watch the deploy logs in the Render dashboard. First deploy takes ~3 min. Look for:
```
🏸 Backend running on port 10000
✅ Migration complete
```

Once deployed, test your live health endpoint:
```
https://your-app-name.onrender.com/health
```

---

## 8. Set up UptimeRobot (keep-alive)

1. Go to → **https://uptimerobot.com** → Sign up (free)
2. Click **"Add New Monitor"**
3. Monitor Type: **HTTP(s)**
4. Friendly Name: `Badminton Backend`
5. URL: `https://your-app-name.onrender.com/health`
6. Monitoring Interval: **5 minutes**
7. Click **"Create Monitor"**

That's it — your backend will no longer sleep during the day. ✅

---

## 9. Update `phases.md` and `review.md`

Once all the above is done, come back and:
1. Tick `[x] Phase 9` in `phases.md`
2. Append a Phase 9 review entry in `review.md` with what was built, any deviations, and any open issues

Then tell me — I'll proceed with **Phase 10: Core API**.

---

## Checklist summary

- [x] Neon account created, project `badminton` created, `DATABASE_URL` copied
- [x] Render account created, web service created pointing at `backend/` directory
- [x] Environment variables set in Render (`DATABASE_URL`, `PORT`, `SCOREKEEPER_PIN`, `NODE_ENV`)
- [x] `backend/` folder created locally with Express + Socket.io + TypeScript
- [x] `.env` file created locally (gitignored), `.env.example` committed
- [x] Migration SQL written (`001_initial.sql`)
- [x] Local `npm run dev` works + `/health` returns `{"status":"ok"}`
- [x] Pushed to GitHub, Render deploys successfully
- [x] Live `/health` endpoint on Render returns `{"status":"ok"}`
- [x] UptimeRobot monitor set up, pinging every 5 minutes
- [x] `phases.md` Phase 9 ticked, `review.md` Phase 9 entry appended
