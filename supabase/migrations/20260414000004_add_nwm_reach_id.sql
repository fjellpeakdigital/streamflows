ALTER TABLE rivers
  ADD COLUMN nwm_reach_id TEXT;

CREATE INDEX rivers_nwm_reach_id_idx ON rivers(nwm_reach_id);
