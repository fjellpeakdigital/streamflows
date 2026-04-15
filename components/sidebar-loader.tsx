import { createClient } from '@/lib/supabase/server';
import { Sidebar } from './sidebar';
import type { Condition, River, RiverWithCondition } from '@/lib/types/database';

async function getUpcomingTripCount(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const todayIso = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'upcoming')
      .gte('trip_date', todayIso);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function getActiveAlertCount(userId: string, riverIds: string[]): Promise<number> {
  if (riverIds.length === 0) return 0;
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from('user_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true)
      .in('river_id', riverIds);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function getRosterRivers(userId: string): Promise<{
  rivers: RiverWithCondition[];
  lastSyncedAt: string | null;
}> {
  try {
    const supabase = await createClient();

    const { data: roster } = await supabase
      .from('user_roster')
      .select('river_id, sort_order, rivers(*)')
      .eq('user_id', userId)
      .eq('archived', false)
      .order('sort_order', { ascending: true });

    if (!roster || roster.length === 0) {
      return { rivers: [], lastSyncedAt: null };
    }

    const rivers = roster
      .map((r: any) => r.rivers as River | null)
      .filter((r): r is River => r !== null);

    const riverIds = rivers.map((r) => r.id);

    const seventyTwoHoursAgo = new Date();
    seventyTwoHoursAgo.setHours(seventyTwoHoursAgo.getHours() - 72);

    const { data: conditions } = await supabase
      .from('conditions')
      .select('*')
      .in('river_id', riverIds)
      .gte('timestamp', seventyTwoHoursAgo.toISOString())
      .order('timestamp', { ascending: false });

    const latestByRiver = new Map<string, Condition>();
    if (conditions) {
      for (const c of conditions as Condition[]) {
        if (!latestByRiver.has(c.river_id)) {
          latestByRiver.set(c.river_id, c);
        }
      }
    }

    let lastSyncedAt: string | null = null;
    for (const c of latestByRiver.values()) {
      if (!lastSyncedAt || c.timestamp > lastSyncedAt) {
        lastSyncedAt = c.timestamp;
      }
    }

    const withConditions: RiverWithCondition[] = rivers.map((r) => ({
      ...r,
      current_condition: latestByRiver.get(r.id),
    }));

    return { rivers: withConditions, lastSyncedAt };
  } catch {
    return { rivers: [], lastSyncedAt: null };
  }
}

interface SidebarLoaderProps {
  userId: string;
  userEmail?: string | null;
}

export async function SidebarLoader({ userId, userEmail }: SidebarLoaderProps) {
  const rosterPromise = getRosterRivers(userId);
  const tripPromise = getUpcomingTripCount(userId);

  const [rosterData, upcomingTripCount] = await Promise.all([rosterPromise, tripPromise]);
  const activeAlertCount = await getActiveAlertCount(userId, rosterData.rivers.map((r) => r.id));

  return (
    <Sidebar
      rivers={rosterData.rivers}
      lastSyncedAt={rosterData.lastSyncedAt}
      activeAlertCount={activeAlertCount}
      upcomingTripCount={upcomingTripCount}
      userEmail={userEmail}
    />
  );
}
