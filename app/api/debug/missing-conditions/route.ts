import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getUserHomeRegions } from '@/lib/user-regions';

export const dynamic = 'force-dynamic';

/**
 * Diagnostic endpoint: lists rivers in the user's home regions that have no
 * recent (last 72h) conditions, classified by likely root cause so we can tell
 * apart "bad station ID", "missing gauge_type", and "USGS gauge offline".
 *
 * Auth-gated. Read-only. Safe to call repeatedly.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const homeRegions = getUserHomeRegions(user);
  if (homeRegions.length === 0) {
    return NextResponse.json({
      message: 'No home regions set; nothing to diagnose.',
      rivers: [],
    });
  }

  // Pull every river in the user's home regions.
  const { data: rivers, error: riversError } = await supabase
    .from('rivers')
    .select('id, name, slug, region, usgs_station_id, gauge_type, optimal_flow_min, optimal_flow_max')
    .in('region', homeRegions)
    .order('region')
    .order('name');

  if (riversError || !rivers) {
    return NextResponse.json({ error: riversError?.message ?? 'fetch failed' }, { status: 500 });
  }

  const riverIds = rivers.map((r) => r.id);
  const seventyTwoHoursAgo = new Date();
  seventyTwoHoursAgo.setHours(seventyTwoHoursAgo.getHours() - 72);

  // Latest condition timestamp per river (any age — used to distinguish
  // "never had data" from "data went stale a long time ago").
  const { data: anyConditions } = await supabase
    .from('conditions')
    .select('river_id, timestamp')
    .in('river_id', riverIds)
    .order('timestamp', { ascending: false })
    .limit(10000);

  const latestEver = new Map<string, string>();
  for (const c of anyConditions ?? []) {
    if (!latestEver.has(c.river_id)) latestEver.set(c.river_id, c.timestamp);
  }

  // Recent (last 72h) — same window the rivers page uses.
  const { data: recentConditions } = await supabase
    .from('conditions')
    .select('river_id')
    .in('river_id', riverIds)
    .gte('timestamp', seventyTwoHoursAgo.toISOString())
    .limit(10000);

  const hasRecent = new Set<string>();
  for (const c of recentConditions ?? []) hasRecent.add(c.river_id);

  // Classify the missing ones.
  const missing = rivers
    .filter((r) => !hasRecent.has(r.id))
    .map((r) => {
      const lastSeen = latestEver.get(r.id) ?? null;
      let likelyCause: string;
      if (!r.usgs_station_id) {
        likelyCause = 'missing_station_id';
      } else if (!r.gauge_type) {
        likelyCause = 'null_gauge_type (no cron picks it up)';
      } else if (lastSeen === null) {
        likelyCause = 'never_fetched (bad station ID or always-silent gauge)';
      } else {
        const ageDays = Math.round(
          (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24)
        );
        likelyCause = `stale_>=72h (last seen ${ageDays}d ago)`;
      }
      return {
        name: r.name,
        slug: r.slug,
        region: r.region,
        usgs_station_id: r.usgs_station_id,
        gauge_type: r.gauge_type,
        last_seen: lastSeen,
        likely_cause: likelyCause,
        usgs_check_url: r.usgs_station_id
          ? `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${r.usgs_station_id}&parameterCd=00060&period=P7D`
          : null,
      };
    });

  // Aggregate counts so the user gets a one-glance summary.
  const summary: Record<string, number> = {};
  for (const m of missing) {
    const bucket = m.likely_cause.split(' ')[0]; // first word
    summary[bucket] = (summary[bucket] ?? 0) + 1;
  }

  return NextResponse.json({
    home_regions: homeRegions,
    total_rivers: rivers.length,
    rivers_with_recent_data: rivers.length - missing.length,
    rivers_missing_recent_data: missing.length,
    summary_by_cause: summary,
    rivers: missing,
  });
}
