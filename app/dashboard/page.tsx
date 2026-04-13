import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchWeatherForRivers } from '@/lib/weather';
import { calculateFlowEta } from '@/lib/flow-eta';
import { calculateStatus } from '@/lib/river-utils';
import { GuideDashboard } from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // 1. Favorites
  const { data: favRows } = await supabase
    .from('user_favorites')
    .select('river_id')
    .eq('user_id', user.id);

  const favoriteIds = (favRows ?? []).map((f) => f.river_id);

  if (favoriteIds.length === 0) {
    return <GuideDashboard rivers={[]} user={user} />;
  }

  // 2. Rivers
  const { data: rivers } = await supabase
    .from('rivers')
    .select('*')
    .in('id', favoriteIds)
    .order('name');

  // 3. Last 24h conditions for all favorited rivers
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const { data: conditions } = await supabase
    .from('conditions')
    .select('*')
    .in('river_id', favoriteIds)
    .gte('timestamp', twentyFourHoursAgo.toISOString())
    .order('timestamp', { ascending: true });

  // 4. Recent angler check-ins (7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: checkins } = await supabase
    .from('river_checkins')
    .select('river_id, conditions_rating')
    .eq('is_public', true)
    .in('river_id', favoriteIds)
    .gte('fished_at', sevenDaysAgo.toISOString());

  // 5. Weather for all favorited rivers (parallel, batched)
  const weatherMap = await fetchWeatherForRivers(rivers ?? []);

  // 6. Assemble per-river data
  const SCORE: Record<string, number> = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const LABEL = ['poor', 'poor', 'fair', 'good', 'excellent'];

  const checkinMap = new Map<string, { total: number; count: number }>();
  for (const c of checkins ?? []) {
    const score = SCORE[c.conditions_rating];
    if (!score) continue;
    const entry = checkinMap.get(c.river_id) ?? { total: 0, count: 0 };
    entry.total += score;
    entry.count += 1;
    checkinMap.set(c.river_id, entry);
  }

  const dashboardRivers = (rivers ?? []).map((river) => {
    const riverConditions = (conditions ?? []).filter((c) => c.river_id === river.id);
    const currentCondition = riverConditions[riverConditions.length - 1] ?? null;
    const trend = currentCondition?.trend ?? 'unknown';

    if (currentCondition && !currentCondition.status) {
      currentCondition.status = calculateStatus(
        currentCondition.flow,
        river.optimal_flow_min,
        river.optimal_flow_max
      );
    }

    const agg = checkinMap.get(river.id);
    const angler_rating = agg
      ? { label: LABEL[Math.round(agg.total / agg.count)] as any, count: agg.count }
      : undefined;

    const eta = calculateFlowEta(riverConditions, river.optimal_flow_min, river.optimal_flow_max);
    const weather = weatherMap.get(river.id) ?? null;

    return {
      ...river,
      current_condition: currentCondition,
      conditions: riverConditions,
      trend,
      angler_rating,
      eta,
      weather,
    };
  });

  return <GuideDashboard rivers={dashboardRivers} user={user} />;
}
