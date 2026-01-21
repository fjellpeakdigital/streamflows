-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Rivers table
CREATE TABLE rivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  usgs_station_id TEXT UNIQUE NOT NULL,
  region TEXT NOT NULL,
  description TEXT,
  optimal_flow_min INTEGER,
  optimal_flow_max INTEGER,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- River species junction table
CREATE TABLE river_species (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  river_id UUID NOT NULL REFERENCES rivers(id) ON DELETE CASCADE,
  species TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(river_id, species)
);

-- Conditions table (time-series data)
CREATE TABLE conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  river_id UUID NOT NULL REFERENCES rivers(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  flow DECIMAL(10, 2),
  temperature DECIMAL(5, 2),
  gage_height DECIMAL(10, 2),
  status TEXT CHECK (status IN ('optimal', 'elevated', 'high', 'low', 'ice_affected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(river_id, timestamp)
);

-- User favorites
CREATE TABLE user_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  river_id UUID NOT NULL REFERENCES rivers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, river_id)
);

-- User notes
CREATE TABLE user_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  river_id UUID NOT NULL REFERENCES rivers(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, river_id)
);

-- User alerts
CREATE TABLE user_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  river_id UUID NOT NULL REFERENCES rivers(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('optimal_flow', 'flow_threshold', 'temperature')),
  threshold_value DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_conditions_river_id ON conditions(river_id);
CREATE INDEX idx_conditions_timestamp ON conditions(timestamp DESC);
CREATE INDEX idx_conditions_river_timestamp ON conditions(river_id, timestamp DESC);
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_user_notes_user_id ON user_notes(user_id);
CREATE INDEX idx_user_alerts_user_id ON user_alerts(user_id);
CREATE INDEX idx_river_species_river_id ON river_species(river_id);
CREATE INDEX idx_rivers_slug ON rivers(slug);
CREATE INDEX idx_rivers_region ON rivers(region);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_rivers_updated_at BEFORE UPDATE ON rivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_notes_updated_at BEFORE UPDATE ON user_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_alerts_updated_at BEFORE UPDATE ON user_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
