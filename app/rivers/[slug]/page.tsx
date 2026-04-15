import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchWeatherForecast } from '@/lib/weather';
import { calculateFlowEta } from '@/lib/flow-eta';
import { calculateStatus } from '@/lib/river-utils';
import { fetchHistoricalFlow } from '@/lib/usgs-historical';
import { fetchNWMForecast, fetchNWMForecastByReachId } from '@/lib/nwm-forecast';
import { RiverDetail } from './river-detail';

export const dynamic = 'force-dynamic';

async function getRiver(slug: string) {
  const supabase = await createClient();

  // ── 1. River row (must come first — everything depends on river.id) ──────────
  const { data: river, error: riverError } = await supabase
    .from('rivers')
    .select('*')
    .eq('slug', slug)
    .single();

  if (riverError || !river) return null;

  // ── 2. All independent fetches in parallel ───────────────────────────────────
  const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const lastYearDate     = `${now.getFullYear() - 1}-${mm}-${dd}`;
  const twoYearsAgoDate  = `${now.getFullYear() - 2}-${mm}-${dd}`;

  const [
    conditionsRes,
    latestConditionRes,
    speciesRes,
    authRes,
    checkinsRawRes,
    hatchesRes,
    weatherRes,
    historicalRes,
  ] = await Promise.all([
    // 72 h window for the chart
    supabase
      .from('conditions')
      .select('*')
      .eq('river_id', river.id)
      .gte('timestamp', seventyTwoHoursAgo)
      .order('timestamp', { ascending: true }),

    // Most recent single condition — no time filter, so stale gauges still show data
    supabase
      .from('conditions')
      .select('*')
      .eq('river_id', river.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('river_species')
      .select('*')
      .eq('river_id', river.id),

    supabase.auth.getUser(),

    supabase
      .from('river_checkins')
      .select('*')
      .eq('river_id', river.id)
      .order('fished_at', { ascending: false })
      .limit(20),

    supabase
      .from('hatch_events')
      .select('*')
      .eq('river_id', river.id)
      .order('start_month', { ascending: true })
      .order('start_day', { ascending: true }),

    river.latitude && river.longitude
      ? fetchWeatherForecast(river.latitude, river.longitude)
      : Promise.resolve(null),

    river.usgs_station_id
      ? Promise.all([
          fetchHistoricalFlow(river.usgs_station_id, lastYearDate),
          fetchHistoricalFlow(river.usgs_station_id, twoYearsAgoDate),
          river.nwm_reach_id
            ? fetchNWMForecast(river.usgs_station_id)
            : Promise.resolve(null),
        ])
      // Ungauged river: no historical data, but fetch NWM if reach ID is known
      : river.nwm_reach_id
        ? Promise.all([null, null, fetchNWMForecastByReachId(river.nwm_reach_id)])
        : Promise.resolve([null, null, null]),
  ]);

  const user = authRes.data.user;

  // ── 3. User-specific queries (need user.id, run in parallel) ─────────────────
  let is_favorite = false;
  let user_note   = null;

  if (user) {
    const [favRes, noteRes, userCheckinsRes] = await Promise.all([
      supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('river_id', river.id)
        .maybeSingle(),

      supabase
        .from('user_notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('river_id', river.id)
        .maybeSingle(),

      // Re-fetch checkins scoped to user (public + own)
      supabase
        .from('river_checkins')
        .select('*')
        .eq('river_id', river.id)
        .or(`is_public.eq.true,user_id.eq.${user.id}`)
        .order('fished_at', { ascending: false })
        .limit(20),
    ]);

    is_favorite = !!favRes.data;
    user_note   = noteRes.data;

    // Replace public-only checkins with authed checkins
    checkinsRawRes.data = userCheckinsRes.data;
  }

  // ── 4. Assemble conditions ───────────────────────────────────────────────────
  const allConditions = conditionsRes.data ?? [];

  // Use the most recent condition from either the 72h window or the dedicated
  // latest-condition query (handles gauges that haven't reported recently).
  const latestFromWindow = allConditions[allConditions.length - 1] ?? null;
  const latestFromQuery  = latestConditionRes.data ?? null;
  let currentCondition =
    latestFromWindow ?? latestFromQuery;

  // Always recalculate status from live flow — stored status can be stale
  if (currentCondition) {
    const flowAbsent =
      currentCondition.flow === null || currentCondition.flow <= -999000;
    if (!currentCondition.status || flowAbsent) {
      currentCondition.status = calculateStatus(
        currentCondition.flow,
        river.optimal_flow_min,
        river.optimal_flow_max
      );
    }
  }

  const trend = currentCondition?.trend ?? 'unknown';
  const eta   = calculateFlowEta(allConditions, river.optimal_flow_min, river.optimal_flow_max);

  // ── 5. Checkins ───────────────────────────────────────────────────────────────
  const checkins = (checkinsRawRes.data ?? []).map((c: any) => ({
    ...c,
    is_own:       user?.id === c.user_id,
    display_name: user?.id === c.user_id ? 'You' : 'Angler',
  }));

  const [historical_last_year, historical_two_years_ago, nwmForecast] =
    (historicalRes as [any, any, any]) ?? [null, null, null];

  return {
    ...river,
    current_condition: currentCondition,
    conditions:        allConditions,
    species:           speciesRes.data ?? [],
    is_favorite,
    user_note,
    trend,
    user,
    checkins,
    eta,
    weather:                 weatherRes,
    historical_last_year,
    historical_two_years_ago,
    hatches:                 hatchesRes.data ?? [],
    nwmForecast,
  };
}

export default async function RiverPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const riverData = await getRiver(slug);

  if (!riverData) notFound();

  return <RiverDetail riverData={riverData} />;
}
