import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchWeatherForecast } from '@/lib/weather';
import { calculateFlowEta } from '@/lib/flow-eta';
import { calculateStatus } from '@/lib/river-utils';
import { fetchHistoricalFlow } from '@/lib/usgs-historical';
import { fetchNWMForecast } from '@/lib/nwm-forecast';
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
      : Promise.resolve([null, null, null]),
  ]);

  const user = authRes.data.user;

  // ── 3. User-specific queries (need user.id, run in parallel) ─────────────────
  let is_favorite = false;
  let user_note   = null;
  // Roster row for this river (if any) — drives the per-user optimal range
  // override. If null, the user hasn't added this river to their roster and
  // can't customize anything; we fall back to the global river values.
  let rosterRow: {
    optimal_flow_min_override: number | null;
    optimal_flow_max_override: number | null;
  } | null = null;

  if (user) {
    const [favRes, noteRes, userCheckinsRes, rosterRes] = await Promise.all([
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

      supabase
        .from('user_roster')
        .select('optimal_flow_min_override, optimal_flow_max_override')
        .eq('user_id', user.id)
        .eq('river_id', river.id)
        .eq('archived', false)
        .maybeSingle(),
    ]);

    is_favorite = !!favRes.data;
    user_note   = noteRes.data;
    rosterRow   = rosterRes.data;

    // Replace public-only checkins with authed checkins
    checkinsRawRes.data = userCheckinsRes.data;
  }

  // Effective optimal range = per-user override if set, else global river value.
  // We mutate `river` so all downstream code (status calc, ETA, NWM forecast,
  // chart reference area) automatically picks up the user's preference.
  const globalOptimalMin = river.optimal_flow_min;
  const globalOptimalMax = river.optimal_flow_max;
  river.optimal_flow_min =
    rosterRow?.optimal_flow_min_override ?? globalOptimalMin;
  river.optimal_flow_max =
    rosterRow?.optimal_flow_max_override ?? globalOptimalMax;

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
  let eta     = calculateFlowEta(allConditions, river.optimal_flow_min, river.optimal_flow_max);

  // ── 5. Checkins ───────────────────────────────────────────────────────────────
  const checkins = (checkinsRawRes.data ?? []).map((c: any) => ({
    ...c,
    is_own:       user?.id === c.user_id,
    display_name: user?.id === c.user_id ? 'You' : 'Angler',
  }));

  const [historical_last_year, historical_two_years_ago, nwmForecast] =
    (historicalRes as [any, any, any]) ?? [null, null, null];

  // Override trend-based ETA with NWM forecast when available — the linear
  // extrapolation is unreliable when a storm spike is between now and optimal.
  if (nwmForecast && river.optimal_flow_min && river.optimal_flow_max) {
    const currentFlow = currentCondition?.flow ?? null;
    if (currentFlow !== null) {
      const oMin = river.optimal_flow_min;
      const oMax = river.optimal_flow_max;
      const now  = Date.now();

      // Merge short + medium range, dedupe by timestamp, sort ascending
      const seen = new Set<string>();
      const pts = [
        ...(nwmForecast.shortRange  ?? []),
        ...(nwmForecast.mediumRange ?? []),
      ]
        .filter((p: { timestamp: string; flow: number }) => {
          if (seen.has(p.timestamp)) return false;
          seen.add(p.timestamp);
          return true;
        })
        .sort((a: { timestamp: string }, b: { timestamp: string }) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

      const isOptimal = currentFlow >= oMin && currentFlow <= oMax;

      if (!isOptimal) {
        // Find the first forecast point where flow is in the optimal band
        const hit = pts.find(
          (p: { flow: number }) => p.flow >= oMin && p.flow <= oMax
        );
        if (hit) {
          const h = (new Date(hit.timestamp).getTime() - now) / 3_600_000;
          if (h > 0 && h <= 120) {
            const label = h < 24
              ? `Optimal in ~${Math.round(h)}h`
              : `Optimal in ~${Math.round(h / 24)}d`;
            eta = {
              type:  currentFlow > oMax ? 'falling_to_optimal' : 'rising_to_optimal',
              hours: h,
              label,
            };
          } else {
            // Forecast shows optimal but it's beyond 5 days or in the past — hide the badge
            eta = { type: 'no_data', hours: null, label: '' };
          }
        } else {
          // No optimal window visible in the forecast — suppress the badge
          eta = { type: 'no_data', hours: null, label: '' };
        }
      } else {
        // Currently optimal — find when the forecast exits the band
        const exit = pts.find(
          (p: { flow: number }) => p.flow < oMin || p.flow > oMax
        );
        if (exit) {
          const h = (new Date(exit.timestamp).getTime() - now) / 3_600_000;
          if (h > 0 && h <= 120) {
            const label = h < 24
              ? `Leaving optimal in ~${Math.round(h)}h`
              : `Leaving optimal in ~${Math.round(h / 24)}d`;
            eta = {
              type:  exit.flow > oMax ? 'leaving_optimal_rising' : 'leaving_optimal_falling',
              hours: h,
              label,
            };
          }
        }
      }
    }
  }

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
    // Per-user optimal range plumbing — exposed so the editor on the detail
    // page can render correct state and reset to global when asked.
    is_in_roster:               !!rosterRow,
    optimal_flow_min_override:  rosterRow?.optimal_flow_min_override ?? null,
    optimal_flow_max_override:  rosterRow?.optimal_flow_max_override ?? null,
    optimal_flow_min_global:    globalOptimalMin,
    optimal_flow_max_global:    globalOptimalMax,
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
