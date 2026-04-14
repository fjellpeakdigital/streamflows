-- user_roster: guide-facing roster of rivers with per-river metadata.
-- Replaces the thin user_favorites table as the redesign progresses.

CREATE TABLE user_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  river_id UUID NOT NULL REFERENCES rivers(id) ON DELETE CASCADE,
  species TEXT[] NOT NULL DEFAULT '{}',
  optimal_flow_min_override NUMERIC,
  optimal_flow_max_override NUMERIC,
  access_notes TEXT,
  designation TEXT CHECK (designation IN ('primary', 'backup')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, river_id)
);

CREATE INDEX user_roster_user_id_idx ON user_roster(user_id);
CREATE INDEX user_roster_river_id_idx ON user_roster(river_id);

-- Keep updated_at fresh on every UPDATE
CREATE OR REPLACE FUNCTION user_roster_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_roster_updated_at
  BEFORE UPDATE ON user_roster
  FOR EACH ROW
  EXECUTE FUNCTION user_roster_set_updated_at();

-- RLS: users can only see and modify their own roster entries
ALTER TABLE user_roster ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roster"
  ON user_roster FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own roster"
  ON user_roster FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own roster"
  ON user_roster FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own roster"
  ON user_roster FOR DELETE
  USING (auth.uid() = user_id);
