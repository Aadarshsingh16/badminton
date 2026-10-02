import { Router } from "express";
import { pool } from "../db/client";
import { requireScorekeeper } from "../middleware/auth";

export const playersRouter = Router();

// GET /players — public
playersRouter.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, avatar_type AS \"avatar\", avatar_emoji AS \"avatarEmoji\", avatar_color AS \"avatarColor\", created_at FROM players ORDER BY created_at ASC"
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error("GET /players error:", err);
    res.status(500).json({ error: "Failed to fetch players", details: err.message });
  }
});

// POST /players — scorekeeper only
playersRouter.post("/", requireScorekeeper, async (req, res) => {
  const { id, name, avatar, avatarEmoji, avatarColor } = req.body;

  if (!name || !avatar) {
    return res.status(400).json({ error: "Missing required player fields: name, avatar" });
  }

  try {
    // If id is provided and looks like a UUID, use it; otherwise let gen_random_uuid() generate it
    let query: string;
    let params: any[];

    const isUuid = id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (isUuid) {
      query = `
        INSERT INTO players (id, name, avatar_type, avatar_emoji, avatar_color)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET name = $2, avatar_type = $3, avatar_emoji = $4, avatar_color = $5
        RETURNING id, name, avatar_type AS "avatar", avatar_emoji AS "avatarEmoji", avatar_color AS "avatarColor", created_at
      `;
      params = [id, name, avatar, avatarEmoji ?? null, avatarColor ?? null];
    } else {
      query = `
        INSERT INTO players (name, avatar_type, avatar_emoji, avatar_color)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, avatar_type AS "avatar", avatar_emoji AS "avatarEmoji", avatar_color AS "avatarColor", created_at
      `;
      params = [name, avatar, avatarEmoji ?? null, avatarColor ?? null];
    }

    const result = await pool.query(query, params);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error("POST /players error:", err);
    res.status(500).json({ error: "Failed to create player", details: err.message });
  }
});
