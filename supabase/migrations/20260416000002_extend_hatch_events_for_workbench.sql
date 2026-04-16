-- Hatch Workbench extensions:
--  * fly_patterns    — free-form list of patterns that work this hatch
--                      ("#18 parachute BWO, #20 CDC emerger, #16 pheasant tail…")
--  * stage           — free text: nymph / emerger / dun / spinner / adult
--  * time_of_day     — free text: morning / midday / afternoon / evening
--  * source_hatch_id — when a user clones a seed row, this back-references
--                      the seed so we can badge "customized from default" and
--                      offer a "reset to seed" action.
--
-- All fields are nullable — no backfill required, existing rows keep working.

ALTER TABLE hatch_events
  ADD COLUMN IF NOT EXISTS fly_patterns    TEXT,
  ADD COLUMN IF NOT EXISTS stage           TEXT,
  ADD COLUMN IF NOT EXISTS time_of_day     TEXT,
  ADD COLUMN IF NOT EXISTS source_hatch_id UUID REFERENCES hatch_events(id) ON DELETE SET NULL;

-- Lets us quickly find the custom that overrides a given seed, or the reverse.
CREATE INDEX IF NOT EXISTS hatch_events_source_idx
  ON hatch_events(source_hatch_id)
  WHERE source_hatch_id IS NOT NULL;
