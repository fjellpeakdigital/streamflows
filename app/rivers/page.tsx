import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RiversList } from './rivers-list';
import { RiverWithCondition, RiverStatus } from '@/lib/types/database';
import { getStatusDotColor, getStatusLabel, calculateStatus } from '@/lib/river-utils';
import { getUserHomeRegions, formatHomeRegionsLabel } from '@/lib/user-regions';

export const dynamic = 'force-dynamic';

async function getRivers() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const homeRegions = getUserHomeRegions(user);

  let riversQuery = supabase.from('rivers').select('*').order('name').limit(5000);
  if (homeRegions.length > 0) riversQuery = riversQuery.in('region', homeRegions);
  const { data: rivers, error: riversError } = await riversQuery;

  if (riversError) {
    console.error('Error fetching rivers:', riversError);
    return { rivers: [], rosterRiverIds: [], isAuthenticated: false, homeRegions: [] as string[] };
  }

  // Scope conditions/species queries to the rivers actually being rendered.
  // Without this scope, a global limit of 10k rows gets crowded out by the
  // 1,500+ rivers in the catalog — home-region users would see most of their
  // rivers as "Unknown" just because their conditions fell outside the slice.
  const scopedRiverIds = rivers.map((r) => r.id);

  const seventyTwoHoursAgo = new Date();
  seventyTwoHoursAgo.setHours(seventyTwoHoursAgo.getHours() - 72);

  const { data: conditions } = scopedRiverIds.length > 0
    ? await supabase
        .from('conditions')
        .select('*')
        .in('river_id', scopedRiverIds)
        .gte('timestamp', seventyTwoHoursAgo.toISOString())
        .order('timestamp', { ascending: false })
        .limit(10000)
    : { data: [] };

  const { data: species } = scopedRiverIds.length > 0
    ? await supabase
        .from('river_species')
        .select('*')
        .in('river_id', scopedRiverIds)
        .limit(10000)
    : { data: [] };

  let favorites: any[] = [];
  let rosterRiverIds: string[] = [];
  if (user) {
    const { data: favData } = await supabase
      .from('user_favorites')
      .select('river_id')
      .eq('user_id', user.id);
    favorites = favData || [];

    const { data: rosterData } = await supabase
      .from('user_roster')
      .select('river_id')
      .eq('user_id', user.id)
      .eq('archived', false);
    rosterRiverIds = (rosterData || []).map((r: any) => r.river_id);
  }

  // Fetch all public check-ins from the last 7 days in one query
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentCheckins } = await supabase
    .from('river_checkins')
    .select('river_id, conditions_rating')
    .eq('is_public', true)
    .gte('fished_at', sevenDaysAgo.toISOString());

  // Aggregate: score each rating, average per river → back to label
  const SCORE: Record<string, number> = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const LABEL: string[] = ['poor', 'poor', 'fair', 'good', 'excellent']; // index 0 unused

  const checkinMap = new Map<string, { total: number; count: number }>();
  for (const c of recentCheckins ?? []) {
    const score = SCORE[c.conditions_rating];
    if (!score) continue;
    const entry = checkinMap.get(c.river_id) ?? { total: 0, count: 0 };
    entry.total += score;
    entry.count += 1;
    checkinMap.set(c.river_id, entry);
  }

  const riversWithConditions: RiverWithCondition[] = rivers.map((river) => {
    const riverConditions = conditions?.filter((c) => c.river_id === river.id) || [];
    const currentCondition = riverConditions[0];
    const riverSpecies = species?.filter((s) => s.river_id === river.id) || [];
    const trend = currentCondition?.trend ?? 'unknown';
    const is_favorite = favorites.some((f) => f.river_id === river.id);

    // Always recalculate status when flow is absent — the stored value may be stale.
    // Also recalculate when status is missing entirely.
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

  return { rivers: riversWithConditions, rosterRiverIds, isAuthenticated: !!user, homeRegions };
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
  // Auth gate — must be logged in to see river data
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/beta');

  const { rivers, rosterRiverIds, isAuthenticated, homeRegions } = await getRivers();
  const stats = await getStats(rivers);
  const regionsLabel = formatHomeRegionsLabel(homeRegions);

  return (
    <div className="container mx-auto px-4 py-8">

      {/* Page header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold mb-1">River Conditions</h1>
          <p className="text-muted-foreground text-sm">
            Real-time flow data for {stats.total} rivers{regionsLabel ? ` in ${regionsLabel}` : ''}
          </p>
        </div>
        {homeRegions.length > 0 && (
          <a
            href="/account#regions"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            Manage regions
          </a>
        )}
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
        homeRegions={homeRegions}
      />
    </div>
  );
}
