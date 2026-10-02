-- 003_add_created_at_to_matches.sql: Ensure matches table has created_at column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE matches ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;
