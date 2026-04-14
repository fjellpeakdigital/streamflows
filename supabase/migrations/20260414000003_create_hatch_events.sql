CREATE TABLE hatch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  river_id UUID NOT NULL REFERENCES rivers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  insect TEXT NOT NULL,
  start_month INTEGER NOT NULL CHECK (start_month BETWEEN 1 AND 12),
  start_day INTEGER NOT NULL CHECK (start_day BETWEEN 1 AND 31),
  end_month INTEGER NOT NULL CHECK (end_month BETWEEN 1 AND 12),
  end_day INTEGER NOT NULL CHECK (end_day BETWEEN 1 AND 31),
  peak_start_month INTEGER CHECK (peak_start_month BETWEEN 1 AND 12),
  peak_start_day INTEGER CHECK (peak_start_day BETWEEN 1 AND 31),
  peak_end_month INTEGER CHECK (peak_end_month BETWEEN 1 AND 12),
  peak_end_day INTEGER CHECK (peak_end_day BETWEEN 1 AND 31),
  notes TEXT,
  temp_trigger NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX hatch_events_river_id_idx ON hatch_events(river_id);
CREATE INDEX hatch_events_user_id_idx ON hatch_events(user_id);

ALTER TABLE hatch_events ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read seed rows
CREATE POLICY "Seed hatches are viewable by everyone"
  ON hatch_events FOR SELECT
  USING (user_id IS NULL);

-- Users can read their own rows
CREATE POLICY "Users can view their own hatches"
  ON hatch_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own hatches"
  ON hatch_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hatches"
  ON hatch_events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own hatches"
  ON hatch_events FOR DELETE
  USING (auth.uid() = user_id);

-- Seed rows are inserted by the service role (bypasses RLS)
