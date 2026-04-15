-- latest_conditions: one row per river, updated in-place by cron jobs.
-- Replaces the expensive "latest condition per river" aggregation that previously
-- scanned the full conditions table (100k+ rows) on every river list page load.

CREATE TABLE IF NOT EXISTS latest_conditions (
  river_id    UUID PRIMARY KEY REFERENCES rivers(id) ON DELETE CASCADE,
  timestamp   TIMESTAMPTZ NOT NULL,
  flow        DOUBLE PRECISION,
  temperature DOUBLE PRECISION,
  gage_height DOUBLE PRECISION,
  status      TEXT,
  trend       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill from existing conditions table
INSERT INTO latest_conditions (river_id, timestamp, flow, temperature, gage_height, status, trend)
SELECT DISTINCT ON (river_id)
  river_id, timestamp, flow, temperature, gage_height, status, trend
FROM conditions
ORDER BY river_id, timestamp DESC
ON CONFLICT (river_id) DO UPDATE SET
  timestamp   = EXCLUDED.timestamp,
  flow        = EXCLUDED.flow,
  temperature = EXCLUDED.temperature,
  gage_height = EXCLUDED.gage_height,
  status      = EXCLUDED.status,
  trend       = EXCLUDED.trend,
  updated_at  = NOW();
