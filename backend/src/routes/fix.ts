import { Router } from "express";
import { pool } from "../db/client";
import { v4 as uuidv4 } from "uuid";

const router = Router();

router.get("/fix-matches", async (req, res) => {
  try {
    const tRes = await pool.query("SELECT id FROM tournaments ORDER BY created_at DESC");
    let fixed = 0;
    
    for (const row of tRes.rows) {
      const tId = row.id;
      // Get all league matches for this tournament
      const mRes = await pool.query(
        "SELECT player_a, player_b FROM matches WHERE tournament_id = $1 AND is_final = false",
        [tId]
      );
      
      const playedPairs = mRes.rows.map(r => [r.player_a, r.player_b].sort().join("-"));
      
      // Get players in this tournament
      const players = Array.from(new Set(mRes.rows.flatMap(r => [r.player_a, r.player_b])));
      
      if (players.length === 4) {
        // Generate all possible 6 pairs
        const expectedPairs = [];
        for (let i = 0; i < players.length; i++) {
          for (let j = i + 1; j < players.length; j++) {
            expectedPairs.push([players[i], players[j]].sort().join("-"));
          }
        }
        
        for (const pair of expectedPairs) {
          if (!playedPairs.includes(pair)) {
            // Missing match!
            const [pA, pB] = pair.split("-");
            await pool.query(
              `INSERT INTO matches (id, tournament_id, round, is_final, player_a, player_b, score_a, score_b, points_a, points_b, played, played_at)
               VALUES ($1, $2, 0, false, $3, $4, 0, 0, 0, 0, true, now())`,
              [`fix-${uuidv4().slice(0,8)}`, tId, pA, pB]
            );
            fixed++;
          }
        }
      }
    }
    
    res.json({ message: "Discrepancy fix complete", matchesFixed: fixed });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
