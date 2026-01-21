-- Enable Row Level Security on all tables
ALTER TABLE rivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE river_species ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;

-- Rivers policies (public read)
CREATE POLICY "Rivers are viewable by everyone"
  ON rivers FOR SELECT
  USING (true);

CREATE POLICY "Rivers are insertable by service role"
  ON rivers FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Rivers are updatable by service role"
  ON rivers FOR UPDATE
  USING (auth.jwt()->>'role' = 'service_role');

-- River species policies (public read)
CREATE POLICY "River species are viewable by everyone"
  ON river_species FOR SELECT
  USING (true);

CREATE POLICY "River species are insertable by service role"
  ON river_species FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Conditions policies (public read)
CREATE POLICY "Conditions are viewable by everyone"
  ON conditions FOR SELECT
  USING (true);

CREATE POLICY "Conditions are insertable by service role"
  ON conditions FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Conditions are updatable by service role"
  ON conditions FOR UPDATE
  USING (auth.jwt()->>'role' = 'service_role');

-- User favorites policies (users can manage their own)
CREATE POLICY "Users can view their own favorites"
  ON user_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites"
  ON user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON user_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- User notes policies (users can manage their own)
CREATE POLICY "Users can view their own notes"
  ON user_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes"
  ON user_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON user_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON user_notes FOR DELETE
  USING (auth.uid() = user_id);

-- User alerts policies (users can manage their own)
CREATE POLICY "Users can view their own alerts"
  ON user_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alerts"
  ON user_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts"
  ON user_alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts"
  ON user_alerts FOR DELETE
  USING (auth.uid() = user_id);
