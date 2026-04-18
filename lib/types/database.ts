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
  /** Overall fishing conditions rating. Null for scouting entries with no rod in the water. */
  conditions_rating: FishingRating | null;
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
  /** Client or party label — redacted from other users' view when is_public=true */
  client_name: string | null;
  /** Party size — redacted from other users' view when is_public=true */
  party_size: number | null;
  /** Back-link to a planned trip, if this log is tied to one */
  trip_id: string | null;
  /** Flow snapshot (CFS) at the moment the entry was saved */
  flow_at_log: number | null;
  /** Water temp snapshot (°F) at the moment the entry was saved */
  temp_at_log: number | null;
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
  /** CWMS location short code assigned by populate-cwms-locations (e.g. "TLD", "SMD") */
  cwms_location_id: string | null;
  /** USACE district code (e.g. "NAE", "NAB") */
  cwms_office: string | null;
  /** CWMS location kind — PROJECT | STREAM_LOCATION | STREAM_GAGE | SITE */
  cwms_location_kind: string | null;
  /** Current pool elevation in feet NGVD (PROJECT rivers only) */
  reservoir_pool_ft: number | null;
  /** Current outflow / release rate in CFS (PROJECT rivers only) */
  reservoir_release_cfs: number | null;
  /** Timestamp of last successful CWMS reservoir fetch */
  reservoir_updated_at: string | null;
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

export interface HatchEvent {
  id: string;
  river_id: string;
  /** NULL = seed data, readable by everyone. Non-null = user-owned custom. */
  user_id: string | null;
  insect: string;
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
  peak_start_month: number | null;
  peak_start_day: number | null;
  peak_end_month: number | null;
  peak_end_day: number | null;
  notes: string | null;
  /** Water temp (°F) threshold that typically triggers the hatch */
  temp_trigger: number | null;
  /** Free-form patterns list: "#18 parachute BWO, #20 CDC emerger" */
  fly_patterns: string | null;
  /** Free text: nymph / emerger / dun / spinner / adult */
  stage: string | null;
  /** Free text: morning / midday / afternoon / evening */
  time_of_day: string | null;
  /** Back-reference to the seed this custom was cloned from, if any */
  source_hatch_id: string | null;
  created_at: string;
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
  hidden_from_discover?: boolean;
  no_usable_data_72h?: boolean;
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
      hatch_events: {
        Row: HatchEvent;
        Insert: Omit<HatchEvent, 'id' | 'created_at'>;
        Update: Partial<Omit<HatchEvent, 'id' | 'created_at'>>;
      };
    };
  };
}
