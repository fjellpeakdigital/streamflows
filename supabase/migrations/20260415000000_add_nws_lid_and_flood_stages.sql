-- Add NWS Location ID (LID) and flood stage thresholds to the rivers table.
--
-- nws_lid: the 5-character NWS Location Identifier, populated from the NOAA
--   HADS cross-reference file (hads.ncep.noaa.gov/USGS/ALL_USGS-HADS_SITES.txt)
--   via /api/admin/populate-nws-lids.
--
-- Flood stage thresholds are fetched from the NOAA NWPS API
--   (api.water.noaa.gov/nwps/v1/gauges/{nws_lid}) and stored here as static
--   reference data. They change rarely and do not need to be refreshed hourly.
--
-- All values are in feet (gage height), matching the gage_height column in conditions.

ALTER TABLE rivers ADD COLUMN IF NOT EXISTS nws_lid TEXT;
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS action_stage DECIMAL(6, 2);
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS flood_stage DECIMAL(6, 2);
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS moderate_flood_stage DECIMAL(6, 2);
ALTER TABLE rivers ADD COLUMN IF NOT EXISTS major_flood_stage DECIMAL(6, 2);

CREATE INDEX IF NOT EXISTS idx_rivers_nws_lid ON rivers (nws_lid) WHERE nws_lid IS NOT NULL;
