-- Extend river_checkins to support the guide Journal:
--  * client_name + party_size — lets a check-in double as a trip log entry
--  * trip_id                   — optional back-link to a planned trip
--  * flow_at_log / temp_at_log — condition snapshot at save time (mirrors user_notes and trips)
--
-- Also allow conditions_rating to be NULL so "scouting" entries (no rod in
-- the water, just observing) can be logged without a fishing rating.

ALTER TABLE river_checkins
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS party_size  INTEGER,
  ADD COLUMN IF NOT EXISTS trip_id     UUID REFERENCES trips(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS flow_at_log NUMERIC,
  ADD COLUMN IF NOT EXISTS temp_at_log NUMERIC;

ALTER TABLE river_checkins
  ALTER COLUMN conditions_rating DROP NOT NULL;

CREATE INDEX IF NOT EXISTS river_checkins_user_fished_idx
  ON river_checkins(user_id, fished_at DESC);

CREATE INDEX IF NOT EXISTS river_checkins_trip_idx
  ON river_checkins(trip_id)
  WHERE trip_id IS NOT NULL;
