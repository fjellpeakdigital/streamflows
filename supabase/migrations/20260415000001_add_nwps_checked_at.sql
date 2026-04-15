-- Track when a river was last checked against the NWPS gauge API.
-- Populated by /api/admin/populate-nws-lids regardless of whether data was found.
-- Allows the populate route to skip already-checked rivers and make real progress
-- through the full list instead of re-processing the same no-data batch each run.

ALTER TABLE rivers ADD COLUMN IF NOT EXISTS nwps_checked_at TIMESTAMPTZ;
