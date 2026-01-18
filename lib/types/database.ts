export type RiverStatus = 'optimal' | 'elevated' | 'high' | 'low' | 'ice_affected';
export type Species = 'trout' | 'salmon' | 'bass' | 'pike' | 'shad' | 'other';
export type AlertType = 'optimal_flow' | 'flow_threshold' | 'temperature';
export type FlowTrend = 'rising' | 'falling' | 'stable';

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
  updated_at: string;
  created_at: string;
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
export interface RiverWithCondition extends River {
  current_condition?: Condition;
  species?: RiverSpecies[];
  is_favorite?: boolean;
  user_note?: UserNote;
  trend?: FlowTrend;
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
    };
  };
}
