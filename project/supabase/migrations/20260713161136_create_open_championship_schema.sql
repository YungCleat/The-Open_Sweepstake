/*
# Open Championship Pool - Database Schema

## Overview
Creates the schema for an Open Championship golf pool app. Participants build
teams of 6 golfers, one per country. Scores are cumulative to par, updated live.
Cut players receive +3 per day per player as a penalty.

## Tables

### golfers
- `id` (uuid, primary key)
- `name` (text, not null) - golfer's full name
- `country` (text, not null) - nationality / country represented
- `created_at` (timestamptz)

### teams
- `id` (uuid, primary key)
- `name` (text, not null) - participant team name
- `owner_name` (text) - optional participant's real name
- `created_at` (timestamptz)

### team_golfers
- `id` (uuid, primary key)
- `team_id` (uuid, foreign key to teams, cascade delete)
- `golfer_id` (uuid, foreign key to golfers, cascade delete)
- UNIQUE (team_id, golfer_id) - no duplicate picks

### scores
- `id` (uuid, primary key)
- `golfer_id` (uuid, foreign key to golfers, cascade delete)
- `round` (int, 1-4) - which round the score is for
- `score_to_par` (int) - strokes relative to par for this round (e.g. -2, 0, +3)
- `total_to_par` (int) - cumulative score to par after this round
- `cut` (boolean, default false) - whether this golfer was cut
- `updated_at` (timestamptz)
- UNIQUE (golfer_id, round)

## Security
- Single-tenant app (no sign-in). All tables allow anon + authenticated CRUD.
- RLS enabled on every table.
*/

CREATE TABLE IF NOT EXISTS golfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE golfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_golfers" ON golfers;
CREATE POLICY "anon_select_golfers" ON golfers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_golfers" ON golfers;
CREATE POLICY "anon_insert_golfers" ON golfers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_golfers" ON golfers;
CREATE POLICY "anon_update_golfers" ON golfers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_golfers" ON golfers;
CREATE POLICY "anon_delete_golfers" ON golfers FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_teams" ON teams;
CREATE POLICY "anon_select_teams" ON teams FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_teams" ON teams;
CREATE POLICY "anon_insert_teams" ON teams FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_teams" ON teams;
CREATE POLICY "anon_update_teams" ON teams FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_teams" ON teams;
CREATE POLICY "anon_delete_teams" ON teams FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS team_golfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  golfer_id uuid NOT NULL REFERENCES golfers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (team_id, golfer_id)
);

ALTER TABLE team_golfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_team_golfers" ON team_golfers;
CREATE POLICY "anon_select_team_golfers" ON team_golfers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_team_golfers" ON team_golfers;
CREATE POLICY "anon_insert_team_golfers" ON team_golfers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_team_golfers" ON team_golfers;
CREATE POLICY "anon_update_team_golfers" ON team_golfers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_team_golfers" ON team_golfers;
CREATE POLICY "anon_delete_team_golfers" ON team_golfers FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  golfer_id uuid NOT NULL REFERENCES golfers(id) ON DELETE CASCADE,
  round int NOT NULL,
  score_to_par int NOT NULL DEFAULT 0,
  total_to_par int NOT NULL DEFAULT 0,
  cut boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (golfer_id, round)
);

ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_scores" ON scores;
CREATE POLICY "anon_select_scores" ON scores FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_scores" ON scores;
CREATE POLICY "anon_insert_scores" ON scores FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_scores" ON scores;
CREATE POLICY "anon_update_scores" ON scores FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_scores" ON scores;
CREATE POLICY "anon_delete_scores" ON scores FOR DELETE
  TO anon, authenticated USING (true);
