import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { pool, runMigration } from "./db/client";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Setup Socket.io for live score updates
const io = new Server(httpServer, {
  cors: {
    origin: "*", // allow frontend connection from localhost, Vercel preview, and production domains
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// ── Health endpoint (Render keep-alive & monitoring) ─────────────────────────
app.get("/health", async (_req, res) => {
  let dbStatus = "not_configured";
  if (process.env.DATABASE_URL) {
    try {
      await pool.query("SELECT 1");
      dbStatus = "connected";
    } catch (err: any) {
      dbStatus = `error: ${err.message}`;
    }
  }

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: dbStatus,
    version: "1.0.0",
  });
});

// ── Socket.io room subscriptions ─────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on("join:tournament", (slug: string) => {
    socket.join(`tournament:${slug}`);
    console.log(`📡 Socket ${socket.id} joined tournament room: ${slug}`);
  });

  socket.on("leave:tournament", (slug: string) => {
    socket.leave(`tournament:${slug}`);
    console.log(`📡 Socket ${socket.id} left tournament room: ${slug}`);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

export { io };

// ── Routes ───────────────────────────────────────────────────────────────────
import { playersRouter, seedFixedPlayers } from "./routes/players";
import { tournamentsRouter } from "./routes/tournaments";
import { dayTablesRouter } from "./routes/dayTables";
import { historyRouter } from "./routes/history";
import { leaderboardRouter, dayResultsRouter } from "./routes/leaderboard";

app.use("/players", playersRouter);
app.use("/tournaments", tournamentsRouter);
app.use("/day-tables", dayTablesRouter);
app.use("/history", historyRouter);
app.use("/leaderboard", leaderboardRouter);
app.use("/day-results", dayResultsRouter);

// ── Server listen & startup migration ────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "3001", 10);

httpServer.listen(PORT, async () => {
  console.log(`🏸 Badminton Backend running on port ${PORT}`);
  if (process.env.DATABASE_URL) {
    try {
      await runMigration();
      await seedFixedPlayers();
    } catch (err) {
      console.error("Migration error on startup:", err);
    }
  } else {
    console.log("ℹ️  DATABASE_URL not configured yet. Server running in standalone health-check mode.");
  }
});
