-- 001_initial.sql — Badminton database initial schema

-- Enable pgcrypto if needed for UUIDs (Neon/Postgres 13+ supports gen_random_uuid natively)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
  totals JSONB DEFAULT '{}',
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

-- Day results (for leaderboard / history)
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
