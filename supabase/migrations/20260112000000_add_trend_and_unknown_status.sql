-- Add trend column to conditions table
ALTER TABLE conditions ADD COLUMN IF NOT EXISTS trend TEXT
  CHECK (trend IN ('rising', 'falling', 'stable', 'unknown'));

-- Expand status check constraint to include 'unknown'
-- Drop the old constraint and recreate with 'unknown' included
ALTER TABLE conditions DROP CONSTRAINT IF EXISTS conditions_status_check;
ALTER TABLE conditions ADD CONSTRAINT conditions_status_check
  CHECK (status IN ('optimal', 'elevated', 'high', 'low', 'ice_affected', 'unknown'));
