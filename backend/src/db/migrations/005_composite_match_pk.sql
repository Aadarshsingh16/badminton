-- 005_composite_match_pk.sql: Make (tournament_id, id) the composite primary key for matches
-- so that different tournaments can use standard bracket match IDs (de-uq-1, de-lf, etc.) without collision.

DO $$ 
BEGIN
  -- Drop single-column primary key constraint on matches if it exists
  ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_pkey;
  
  -- Ensure tournament_id is NOT NULL
  ALTER TABLE matches ALTER COLUMN tournament_id SET NOT NULL;

  -- Add composite primary key on (tournament_id, id)
  ALTER TABLE matches ADD PRIMARY KEY (tournament_id, id);
END $$;
