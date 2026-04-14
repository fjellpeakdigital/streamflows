import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchWeatherForRivers } from '@/lib/weather';
import { calculateFlowEta } from '@/lib/flow-eta';
import { calculateStatus } from '@/lib/river-utils';
import { scoreBackupRiver } from '@/lib/backup-river-scorer';
import { getCachedUser } from '@/app/layout';
import { GuideDashboard } from './dashboard-client';

export const dynamic = 'force-dynamic';

interface HatchEventRow {
  id: string;
  river_id: string;
  insect: string;
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
}

const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

function dayOfYear(month: number, day: number): number {
  return DAYS_BEFORE_MONTH[month - 1] + day;
}

export function isHatchActive(event: HatchEventRow, today: Date): boolean {
  const t = dayOfYear(today.getMonth() + 1, today.getDate());
  const s = dayOfYear(event.start_month, event.start_day);
  const e = dayOfYear(event.end_month, event.end_day);
  if (s > e) return t >= s || t <= e; // wraps year-end (Dec → Jan)
  return t >= s && t <= e;
}

export function isHatchSoon(
  event: HatchEventRow,
  today: Date,
  days: number
): boolean {
  if (isHatchActive(event, today)) return false;
  const t = dayOfYear(today.getMonth() + 1, today.getDate());
  const s = dayOfYear(event.start_month, event.start_day);
  const diff = (s - t + 365) % 365;
  return diff >= 1 && diff <= days;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await getCachedUser();

  if (!user) redirect('/login');

  // 1. Roster
  const { data: rosterRows } = await supabase
    .from('user_roster')
    .select('river_id')
    .eq('user_id', user.id)
    .eq('archived', false);

  const rosterIds = (rosterRows ?? []).map((r) => r.river_id);

  if (rosterIds.length === 0) {
    return (
      <GuideDashboard
        rivers={[]}
        alerts={[]}
        optimalBanners={[]}
        notesByRiver={{}}
        nextTrip={null}
        backup={null}
        user={user}
      />
    );
  }

  const seventyTwoHoursAgo = new Date();
  seventyTwoHoursAgo.setHours(seventyTwoHoursAgo.getHours() - 72);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const todayIso = new Date().toISOString().slice(0, 10);

  // All queries below only depend on rosterIds / user.id — run them in one round-trip.
  const riversPromise = supabase
    .from('rivers')
    .select('*')
    .in('id', rosterIds)
    .order('name');

  // Weather depends on rivers result; chain it so it rides the same Promise.all.
  const weatherPromise = riversPromise.then(({ data }) =>
    fetchWeatherForRivers(data ?? [])
  );

  const [
    { data: rivers },
    { data: conditions },
    { data: checkins },
    { data: alertRows },
    { data: noteRows },
    { data: hatchRows },
    weatherMap,
    { data: nextTripRow },
  ] = await Promise.all([
    riversPromise,
    supabase
      .from('conditions')
      .select('*')
      .in('river_id', rosterIds)
      .gte('timestamp', seventyTwoHoursAgo.toISOString())
      .order('timestamp', { ascending: true }),
    supabase
      .from('river_checkins')
      .select('river_id, conditions_rating')
      .eq('is_public', true)
      .in('river_id', rosterIds)
      .gte('fished_at', sevenDaysAgo.toISOString()),
    supabase
      .from('user_alerts')
      .select('id, river_id, alert_type, threshold_value, updated_at, rivers(name, slug)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .in('river_id', rosterIds)
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase
      .from('user_notes')
      .select('river_id, note, updated_at')
      .eq('user_id', user.id)
      .in('river_id', rosterIds)
      .order('updated_at', { ascending: false }),
    supabase
      .from('hatch_events')
      .select('id, river_id, insect, start_month, start_day, end_month, end_day')
      .in('river_id', rosterIds),
    weatherPromise,
    supabase
      .from('trips')
      .select(
        'id, trip_date, client_count, target_river_id, target_river:rivers!trips_target_river_id_fkey(id, name, slug, optimal_flow_min, optimal_flow_max)'
      )
      .eq('user_id', user.id)
      .eq('status', 'upcoming')
      .gte('trip_date', todayIso)
      .order('trip_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const alerts = (alertRows ?? []).map((a: any) => ({
    id: a.id,
    river_id: a.river_id,
    river_name: a.rivers?.name ?? 'Unknown',
    river_slug: a.rivers?.slug ?? '',
    alert_type: a.alert_type,
    threshold_value: a.threshold_value,
    updated_at: a.updated_at,
  }));

  const notesByRiver: Record<string, string> = {};
  for (const n of noteRows ?? []) {
    if (!notesByRiver[n.river_id] && n.note) {
      notesByRiver[n.river_id] = n.note;
    }
  }

  const today = new Date();
  const hatchesByRiver = new Map<string, { active: string[]; soon: string[] }>();
  for (const h of (hatchRows ?? []) as HatchEventRow[]) {
    const entry = hatchesByRiver.get(h.river_id) ?? { active: [], soon: [] };
    if (isHatchActive(h, today)) entry.active.push(h.insect);
    else if (isHatchSoon(h, today, 14)) entry.soon.push(h.insect);
    hatchesByRiver.set(h.river_id, entry);
  }

  // 8. Assemble per-river data
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

    const hatches = hatchesByRiver.get(river.id) ?? { active: [], soon: [] };

    return {
      ...river,
      current_condition: currentCondition,
      conditions: riverConditions,
      trend,
      angler_rating,
      eta,
      weather,
      active_hatches: hatches.active,
      upcoming_hatches: hatches.soon,
    };
  });

  // Next upcoming trip (fetched in the main Promise.all above)
  let nextTrip = null as null | {
    id: string;
    trip_date: string;
    client_count: number;
    target_river_id: string;
    river_name: string;
    river_slug: string;
    status: string;
    eta_label: string | null;
  };

  if (nextTripRow && nextTripRow.target_river) {
    const targetRiver: any = nextTripRow.target_river;
    const existing = dashboardRivers.find((r) => r.id === targetRiver.id);

    let riverConditions = existing?.conditions ?? [];
    if (!existing) {
      const { data: extraConditions } = await supabase
        .from('conditions')
        .select('*')
        .eq('river_id', targetRiver.id)
        .gte('timestamp', seventyTwoHoursAgo.toISOString())
        .order('timestamp', { ascending: true });
      riverConditions = extraConditions ?? [];
    }

    const latest = riverConditions[riverConditions.length - 1] ?? null;
    const status =
      latest?.status ??
      calculateStatus(
        latest?.flow ?? null,
        targetRiver.optimal_flow_min,
        targetRiver.optimal_flow_max
      );
    const eta = calculateFlowEta(
      riverConditions,
      targetRiver.optimal_flow_min,
      targetRiver.optimal_flow_max
    );

    nextTrip = {
      id: nextTripRow.id,
      trip_date: nextTripRow.trip_date,
      client_count: nextTripRow.client_count,
      target_river_id: targetRiver.id,
      river_name: targetRiver.name,
      river_slug: targetRiver.slug,
      status,
      eta_label: eta.label || null,
    };
  }

  // 9b. Smart optimal-river banners
  const optimalBanners = dashboardRivers
    .filter((r) => r.current_condition?.status === 'optimal')
    .map((r) => {
      const flow = r.current_condition?.flow;
      const flowLabel = typeof flow === 'number' ? `${flow.toLocaleString()} CFS` : 'current flow';
      const trend = r.trend;
      let message: string;
      if (trend === 'falling') {
        message = `${r.name} is optimal but falling — currently at ${flowLabel}`;
      } else if (trend === 'rising') {
        message = `${r.name} entered optimal range — rising at ${flowLabel}`;
      } else {
        message = `${r.name} hit optimal range — holding steady at ${flowLabel}`;
      }
      return {
        id: `optimal:${r.id}`,
        river_slug: r.slug,
        message,
        trend,
      };
    });

  // 10. Backup river suggestion
  const primaryIdForBackup =
    nextTrip?.target_river_id ??
    (dashboardRivers[0]?.id as string | undefined) ??
    '';
  const backupScore = primaryIdForBackup
    ? scoreBackupRiver(dashboardRivers as any, primaryIdForBackup)
    : null;

  const backup = backupScore
    ? {
        river_id: backupScore.river.id,
        river_name: backupScore.river.name,
        river_slug: backupScore.river.slug,
        rationale: backupScore.rationale,
      }
    : null;

  return (
    <GuideDashboard
      rivers={dashboardRivers}
      alerts={alerts}
      optimalBanners={optimalBanners}
      notesByRiver={notesByRiver}
      nextTrip={nextTrip}
      backup={backup}
      user={user}
    />
  );
}
