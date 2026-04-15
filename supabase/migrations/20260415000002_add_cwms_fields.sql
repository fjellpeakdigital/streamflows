-- Add CWMS (Corps Water Management System) fields to the rivers table.
--
-- cwms_location_id: short CWMS location code (e.g. "TLD", "SMD", "FRN")
--   populated by /api/admin/populate-cwms-locations
--
-- cwms_office: USACE district code (e.g. "NAE", "NAB", "MVP")
--
-- cwms_location_kind: CWMS location kind — drives what data we fetch:
--   PROJECT        → USACE flood control dam; fetch pool elevation + release rate
--   STREAM_LOCATION → downstream gauge; fetch stage/flow as USGS backup
--   SITE           → co-located monitoring site; fetch flow as backup
--   STREAM_GAGE    → stream gauge
--
-- Reservoir operational data (populated hourly by /api/cron/fetch-cwms-data,
-- only for rivers whose cwms_location_kind = 'PROJECT'):
--   reservoir_pool_ft      — current pool elevation in feet NGVD
--   reservoir_release_cfs  — current outflow / release rate in CFS
--   reservoir_updated_at   — timestamp of last successful fetch

ALTER TABLE rivers ADD COLUMN IF NOT EXISTS cwms_location_id TEXT;
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS cwms_office TEXT;
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS cwms_location_kind TEXT;
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS reservoir_pool_ft DECIMAL(8, 2);
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS reservoir_release_cfs DECIMAL(10, 2);
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS reservoir_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_rivers_cwms_location ON rivers (cwms_location_id)
  WHERE cwms_location_id IS NOT NULL;
