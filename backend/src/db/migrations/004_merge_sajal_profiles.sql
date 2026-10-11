-- 004_merge_sajal_profiles.sql: Merge temporary/custom profiles of Sajal into permanent 'sajal' ID

DO $$
BEGIN
  -- 1. Ensure permanent 'sajal' player exists in players table
  INSERT INTO players (id, name, avatar_type, avatar_emoji, avatar_color)
  VALUES ('sajal', 'Sajal', 'custom', '🦁', '#6C63FF')
  ON CONFLICT (id) DO UPDATE SET
    name = 'Sajal',
    avatar_type = 'custom',
    avatar_emoji = COALESCE(players.avatar_emoji, '🦁'),
    avatar_color = COALESCE(players.avatar_color, '#6C63FF');

  -- 2. Update matches table (both player_a and player_b)
  UPDATE matches
  SET player_a = 'sajal'
  WHERE player_a IN ('custom-1791021029857', 'custom-1791025802127')
     OR player_a IN (SELECT id FROM players WHERE name ILIKE 'sajal' AND id != 'sajal');

  UPDATE matches
  SET player_b = 'sajal'
  WHERE player_b IN ('custom-1791021029857', 'custom-1791025802127')
     OR player_b IN (SELECT id FROM players WHERE name ILIKE 'sajal' AND id != 'sajal');

  -- 3. Update matches court_side JSONB if present
  UPDATE matches
  SET court_side = (
    court_side - 'custom-1791021029857' - 'custom-1791025802127'
    || jsonb_build_object(
         'sajal',
         COALESCE(court_side->'custom-1791021029857', court_side->'custom-1791025802127', court_side->'sajal')
       )
  )
  WHERE court_side IS NOT NULL
    AND (court_side ? 'custom-1791021029857' OR court_side ? 'custom-1791025802127');

  -- 4. Update tournaments player_ids array (TEXT[])
  UPDATE tournaments
  SET player_ids = ARRAY(
    SELECT DISTINCT CASE
      WHEN pid IN ('custom-1791021029857', 'custom-1791025802127') THEN 'sajal'
      WHEN pid IN (SELECT id FROM players WHERE name ILIKE 'sajal' AND id != 'sajal') THEN 'sajal'
      ELSE pid
    END
    FROM unnest(player_ids) AS pid
  )
  WHERE 'custom-1791021029857' = ANY(player_ids)
     OR 'custom-1791025802127' = ANY(player_ids)
     OR EXISTS (
       SELECT 1 FROM players p 
       WHERE p.name ILIKE 'sajal' AND p.id != 'sajal' AND p.id = ANY(tournaments.player_ids)
     );

  -- 5. Update day_tables totals JSONB
  UPDATE day_tables
  SET totals = (
    totals - 'custom-1791021029857' - 'custom-1791025802127'
    || jsonb_build_object(
         'sajal',
         COALESCE((totals->>'custom-1791021029857')::int, 0) +
         COALESCE((totals->>'custom-1791025802127')::int, 0) +
         COALESCE((totals->>'sajal')::int, 0)
       )
  )
  WHERE totals IS NOT NULL
    AND (totals ? 'custom-1791021029857' OR totals ? 'custom-1791025802127');

  -- 6. Update day_results
  UPDATE day_results
  SET top_player_id = 'sajal'
  WHERE top_player_id IN ('custom-1791021029857', 'custom-1791025802127')
     OR top_player_id IN (SELECT id FROM players WHERE name ILIKE 'sajal' AND id != 'sajal');

  UPDATE day_results
  SET bottom_player_id = 'sajal'
  WHERE bottom_player_id IN ('custom-1791021029857', 'custom-1791025802127')
     OR bottom_player_id IN (SELECT id FROM players WHERE name ILIKE 'sajal' AND id != 'sajal');

  -- 7. Remove the old custom player entries from players table
  DELETE FROM players
  WHERE (id IN ('custom-1791021029857', 'custom-1791025802127')
     OR (name ILIKE 'sajal' AND id != 'sajal'));

END $$;
