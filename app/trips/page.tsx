import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { calculateStatus } from '@/lib/river-utils';
import { TripsClient } from './trips-client';
import type { RiverStatus } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export interface RosterRiverOption {
  id: string;
  name: string;
  slug: string;
  status: RiverStatus;
}

export interface TripRow {
  id: string;
  trip_date: string;
  client_count: number;
  client_notes: string | null;
  target_river_id: string;
  backup_river_id: string | null;
  status: 'upcoming' | 'completed' | 'cancelled';
  post_trip_notes: string | null;
  flow_at_trip: number | null;
  temp_at_trip: number | null;
  target_river: { name: string; slug: string } | null;
  backup_river: { name: string; slug: string } | null;
}

export default async function TripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: rosterRows } = await supabase
    .from('user_roster')
    .select('river_id, sort_order, rivers(id, name, slug, optimal_flow_min, optimal_flow_max)')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('sort_order', { ascending: true });

  const rosterRivers = (rosterRows ?? [])
    .map((r: any) => r.rivers)
    .filter((r: any): r is any => r !== null);

  const rosterIds = rosterRivers.map((r: any) => r.id);

  // Latest condition per roster river (for status dot)
  const latestByRiver = new Map<string, any>();
  if (rosterIds.length > 0) {
    const seventyTwoHoursAgo = new Date();
    seventyTwoHoursAgo.setHours(seventyTwoHoursAgo.getHours() - 72);
    const { data: conditions } = await supabase
      .from('conditions')
      .select('river_id, flow, status, timestamp')
      .in('river_id', rosterIds)
      .gte('timestamp', seventyTwoHoursAgo.toISOString())
      .order('timestamp', { ascending: false });

    for (const c of conditions ?? []) {
      if (!latestByRiver.has(c.river_id)) latestByRiver.set(c.river_id, c);
    }
  }

  const rosterOptions: RosterRiverOption[] = rosterRivers.map((r: any) => {
    const cond = latestByRiver.get(r.id);
    const status = (cond?.status ??
      calculateStatus(cond?.flow ?? null, r.optimal_flow_min, r.optimal_flow_max)) as RiverStatus;
    return { id: r.id, name: r.name, slug: r.slug, status };
  });

  const { data: tripRows } = await supabase
    .from('trips')
    .select(
      'id, trip_date, client_count, client_notes, target_river_id, backup_river_id, status, post_trip_notes, flow_at_trip, temp_at_trip, target_river:rivers!trips_target_river_id_fkey(name, slug), backup_river:rivers!trips_backup_river_id_fkey(name, slug)'
    )
    .eq('user_id', user.id)
    .order('trip_date', { ascending: false });

  const trips = (tripRows ?? []) as unknown as TripRow[];

  return <TripsClient trips={trips} rosterOptions={rosterOptions} />;
}
