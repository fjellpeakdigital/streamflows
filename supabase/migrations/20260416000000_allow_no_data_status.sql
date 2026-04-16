-- Expand conditions.status CHECK constraint to include 'no_data'.
-- Phase 1 of the guide-focused redesign added 'no_data' to the TypeScript
-- RiverStatus type so that the USGS -999999 sentinel (and null flow from
-- silent gauges) could be represented distinctly from 'ice_affected'. The
-- matching DB constraint was missed, which caused the fetch-daily and
-- fetch-data crons to fail silently on every row where calculateStatus
-- returned 'no_data' — leaving those rivers permanently Unknown on the UI.
--
-- This drops and recreates the constraint to include 'no_data'.

ALTER TABLE conditions DROP CONSTRAINT IF EXISTS conditions_status_check;
ALTER TABLE conditions ADD CONSTRAINT conditions_status_check
  CHECK (status IN (
    'optimal',
    'elevated',
    'high',
    'low',
    'ice_affected',
    'no_data',
    'unknown'
  ));
