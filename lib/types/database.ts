export type RiverStatus = 'optimal' | 'elevated' | 'high' | 'low' | 'ice_affected' | 'no_data' | 'unknown';
export type Species = 'trout' | 'salmon' | 'bass' | 'pike' | 'shad' | 'other';
export type AlertType = 'optimal_flow' | 'flow_threshold' | 'temperature';
export type FlowTrend = 'rising' | 'falling' | 'stable' | 'unknown';
export type FlowAccuracy = 'accurate' | 'inaccurate' | 'unsure';
export type FishingRating = 'poor' | 'fair' | 'good' | 'excellent';

export interface CheckIn {
  id: string;
  river_id: string;
  user_id: string;
  /** Did the gauge reading match what the angler observed on the water? */
  flow_confirmed: FlowAccuracy;
  /** Overall fishing conditions rating */
  conditions_rating: FishingRating;
  /** Species the angler was targeting / caught */
  species_caught: string[] | null;
  /** Flies, patterns, or techniques that worked */
  flies_working: string | null;
  /** Free-form notes */
  notes: string | null;
  /** Whether this check-in is visible to other users */
  is_public: boolean;
  /** When the angler actually fished (defaults to created_at) */
  fished_at: string;
  created_at: string;
}

export interface River {
  id: string;
  name: string;
  slug: string;
  usgs_station_id: string;
  region: string;
  description: string | null;
  optimal_flow_min: number | null;
  optimal_flow_max: number | null;
  latitude: number | null;
  longitude: number | null;
  nwm_reach_id: string | null;
  /** NWS Location Identifier — used to fetch flood stage thresholds from NWPS */
  nws_lid: string | null;
  /** Gage height (ft) at which NWS issues an action statement */
  action_stage: number | null;
  /** Gage height (ft) at which minor flooding begins */
  flood_stage: number | null;
  /** Gage height (ft) at which moderate flooding begins */
  moderate_flood_stage: number | null;
  /** Gage height (ft) at which major flooding begins */
  major_flood_stage: number | null;
  created_at: string;
  updated_at: string;
}

export interface RiverSpecies {
  id: string;
  river_id: string;
  species: Species;
  created_at: string;
}

export interface Condition {
  id: string;
  river_id: string;
  timestamp: string;
  flow: number | null;
  temperature: number | null;
  gage_height: number | null;
  status: RiverStatus | null;
  trend: FlowTrend | null;
  created_at: string;
}

export interface UserFavorite {
  id: string;
  user_id: string;
  river_id: string;
  created_at: string;
}

export interface UserNote {
  id: string;
  user_id: string;
  river_id: string;
  note: string;
  flow_at_save: number | null;
  temp_at_save: number | null;
  updated_at: string;
  created_at: string;
}

export interface UserRoster {
  id: string;
  user_id: string;
  river_id: string;
  species: string[];
  optimal_flow_min_override: number | null;
  optimal_flow_max_override: number | null;
  access_notes: string | null;
  designation: 'primary' | 'backup' | null;
  sort_order: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAlert {
  id: string;
  user_id: string;
  river_id: string;
  alert_type: AlertType;
  threshold_value: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Extended types with relations
export interface CheckInWithMeta extends CheckIn {
  /** Truncated display name derived server-side from the user's email */
  display_name: string;
}

export interface RiverWithCondition extends River {
  current_condition?: Condition;
  species?: RiverSpecies[];
  is_favorite?: boolean;
  user_note?: UserNote;
  user_roster?: UserRoster;
  trend?: FlowTrend;
  /** Aggregated angler rating from public check-ins in the last 7 days */
  angler_rating?: {
    label: FishingRating;
    count: number;
  };
}

export interface Database {
  public: {
    Tables: {
      rivers: {
        Row: River;
        Insert: Omit<River, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<River, 'id' | 'created_at' | 'updated_at'>>;
      };
      river_species: {
        Row: RiverSpecies;
        Insert: Omit<RiverSpecies, 'id' | 'created_at'>;
        Update: Partial<Omit<RiverSpecies, 'id' | 'created_at'>>;
      };
      conditions: {
        Row: Condition;
        Insert: Omit<Condition, 'id' | 'created_at'>;
        Update: Partial<Omit<Condition, 'id' | 'created_at'>>;
      };
      user_favorites: {
        Row: UserFavorite;
        Insert: Omit<UserFavorite, 'id' | 'created_at'>;
        Update: Partial<Omit<UserFavorite, 'id' | 'created_at'>>;
      };
      user_roster: {
        Row: UserRoster;
        Insert: Omit<UserRoster, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserRoster, 'id' | 'created_at' | 'updated_at'>>;
      };
      user_notes: {
        Row: UserNote;
        Insert: Omit<UserNote, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserNote, 'id' | 'created_at' | 'updated_at'>>;
      };
      user_alerts: {
        Row: UserAlert;
        Insert: Omit<UserAlert, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserAlert, 'id' | 'created_at' | 'updated_at'>>;
      };
      river_checkins: {
        Row: CheckIn;
        Insert: Omit<CheckIn, 'id' | 'created_at'>;
        Update: Partial<Omit<CheckIn, 'id' | 'created_at'>>;
      };
    };
  };
}
