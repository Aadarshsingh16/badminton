-- 002_flexible_ids.sql: Allow text/custom IDs for tournaments, matches, and players to seamlessly match client store IDs

DO $$ 
BEGIN
  -- matches table foreign keys
  ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_player_a_fkey;
  ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_player_b_fkey;
  ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_tournament_id_fkey;

  -- day_results table foreign keys
  ALTER TABLE day_results DROP CONSTRAINT IF EXISTS day_results_top_player_id_fkey;
  ALTER TABLE day_results DROP CONSTRAINT IF EXISTS day_results_bottom_player_id_fkey;

  -- Alter column types to TEXT
  ALTER TABLE matches ALTER COLUMN id TYPE TEXT USING id::text;
  ALTER TABLE matches ALTER COLUMN tournament_id TYPE TEXT USING tournament_id::text;
  ALTER TABLE matches ALTER COLUMN player_a TYPE TEXT USING player_a::text;
  ALTER TABLE matches ALTER COLUMN player_b TYPE TEXT USING player_b::text;

  ALTER TABLE tournaments ALTER COLUMN id TYPE TEXT USING id::text;
  ALTER TABLE tournaments ALTER COLUMN player_ids TYPE TEXT[] USING player_ids::text[];

  ALTER TABLE players ALTER COLUMN id TYPE TEXT USING id::text;

  ALTER TABLE day_results ALTER COLUMN top_player_id TYPE TEXT USING top_player_id::text;
  ALTER TABLE day_results ALTER COLUMN bottom_player_id TYPE TEXT USING bottom_player_id::text;

  -- Re-add tournament cascade foreign key
  ALTER TABLE matches ADD CONSTRAINT matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;
END $$;
