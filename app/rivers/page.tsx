import { createClient } from '@/lib/supabase/server';
import { RiversList } from './rivers-list';
import { RiverWithCondition, RiverStatus } from '@/lib/types/database';
import { getStatusDotColor, getStatusLabel, calculateStatus } from '@/lib/river-utils';

export const dynamic = 'force-dynamic';

async function getRivers() {
  const supabase = await createClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // All independent queries run in parallel.
  // latest_conditions has one row per river (≤1,500 rows) instead of the
  // previous conditions fetch that pulled up to 10,000 rows.
  const [
    riversRes,
    latestCondsRes,
    speciesRes,
    authRes,
    checkinsRes,
  ] = await Promise.all([
    supabase.from('rivers').select('*').order('name').limit(5000),
    supabase.from('latest_conditions').select('*'),
    supabase.from('river_species').select('*').limit(10000),
    supabase.auth.getUser(),
    supabase
      .from('river_checkins')
      .select('river_id, conditions_rating')
      .eq('is_public', true)
      .gte('fished_at', sevenDaysAgo.toISOString()),
  ]);

  if (riversRes.error) {
    console.error('Error fetching rivers:', riversRes.error);
    return { rivers: [], rosterRiverIds: [], isAuthenticated: false };
  }

  const rivers = riversRes.data;
  const user = authRes.data.user ?? null;

  // Build O(1) lookup maps
  const condMap = new Map<string, any>();
  for (const c of latestCondsRes.data ?? []) condMap.set(c.river_id, c);

  const speciesMap = new Map<string, any[]>();
  for (const s of speciesRes.data ?? []) {
    const list = speciesMap.get(s.river_id) ?? [];
    list.push(s);
    speciesMap.set(s.river_id, list);
  }

  // Aggregate check-in ratings per river
  const SCORE: Record<string, number> = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const LABEL: string[] = ['poor', 'poor', 'fair', 'good', 'excellent']; // index 0 unused
  const checkinMap = new Map<string, { total: number; count: number }>();
  for (const c of checkinsRes.data ?? []) {
    const score = SCORE[c.conditions_rating];
    if (!score) continue;
    const entry = checkinMap.get(c.river_id) ?? { total: 0, count: 0 };
    entry.total += score;
    entry.count += 1;
    checkinMap.set(c.river_id, entry);
  }

  // User-specific data (roster + favorites) — only fetched when authed
  let favorites: any[] = [];
  let rosterRiverIds: string[] = [];
  if (user) {
    const [favRes, rosterRes] = await Promise.all([
      supabase.from('user_favorites').select('river_id').eq('user_id', user.id),
      supabase.from('user_roster').select('river_id').eq('user_id', user.id).eq('archived', false),
    ]);
    favorites = favRes.data ?? [];
    rosterRiverIds = (rosterRes.data ?? []).map((r: any) => r.river_id);
  }

  const riversWithConditions: RiverWithCondition[] = rivers.map((river) => {
    const currentCondition = condMap.get(river.id) ?? null;
    const riverSpecies = speciesMap.get(river.id) ?? [];
    const trend = currentCondition?.trend ?? 'unknown';
    const is_favorite = favorites.some((f: any) => f.river_id === river.id);

    if (currentCondition) {
      const flowAbsent = currentCondition.flow === null || currentCondition.flow <= -999000;
      if (!currentCondition.status || flowAbsent) {
        currentCondition.status = calculateStatus(
          currentCondition.flow,
          river.optimal_flow_min,
          river.optimal_flow_max
        );
      }
    }

    const agg = checkinMap.get(river.id);
    const angler_rating = agg
      ? { label: LABEL[Math.round(agg.total / agg.count)] as any, count: agg.count }
      : undefined;

    return { ...river, current_condition: currentCondition, species: riverSpecies, trend, is_favorite, angler_rating };
  });

  return { rivers: riversWithConditions, rosterRiverIds, isAuthenticated: !!user };
}

async function getStats(rivers: RiverWithCondition[]) {
  const statusCounts: Record<RiverStatus, number> = {
    optimal: 0, elevated: 0, high: 0, low: 0, ice_affected: 0, no_data: 0, unknown: 0,
  };
  rivers.forEach((river) => {
    const status = river.current_condition?.status ?? 'unknown';
    statusCounts[status as RiverStatus]++;
  });
  return { total: rivers.length, statusCounts };
}

const STATUS_ORDER: RiverStatus[] = ['optimal', 'elevated', 'high', 'low', 'ice_affected', 'unknown'];

export default async function RiversPage() {
  const { rivers, rosterRiverIds, isAuthenticated } = await getRivers();
  const stats = await getStats(rivers);

  return (
    <div className="container mx-auto px-4 py-8">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">River Conditions</h1>
        <p className="text-muted-foreground text-sm">
          Real-time flow data for {stats.total} New England rivers
        </p>
      </div>

      {/* Status summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">
        {STATUS_ORDER.map((status) => {
          const count = stats.statusCounts[status];
          return (
            <div
              key={status}
              className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3"
            >
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${getStatusDotColor(status)}`} />
              <div className="min-w-0">
                <div className="text-xl font-bold leading-tight">{count}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {getStatusLabel(status)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <RiversList
        rivers={rivers}
        rosterRiverIds={rosterRiverIds}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}
