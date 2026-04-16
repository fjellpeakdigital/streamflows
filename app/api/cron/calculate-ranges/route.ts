import { createClient as createServiceClient } from '@supabase/supabase-js';
import { chunk, runWithConcurrency } from '@/lib/usgs';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ── Types ─────────────────────────────────────────────────────────────────────

interface USGSDVResponse {
  value: {
    timeSeries: Array<{
      sourceInfo: { siteCode: Array<{ value: string }> };
      variable: { variableCode: Array<{ value: string }> };
      values: Array<{ value: Array<{ value: string }> }>;
    }>;
  };
}

interface USGSStatResponse {
  value: {
    timeSeries: Array<{
      // e.g. "USGS:01075000:00060:00025"
      name: string;
      values: Array<{ value: Array<{ value: string }> }>;
    }>;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Calculate a percentile from a sorted array */
function percentile(sorted: number[], p: number): number {
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/** Parse a list of raw value strings into clean positive flow numbers */
function parseFlows(raw: Array<{ value: string }>): number[] {
  const flows: number[] = [];
  for (const v of raw) {
    const f = parseFloat(v.value);
    if (!isNaN(f) && f > 0 && f < 999000) flows.push(f);
  }
  return flows;
}

// ── Stage 1: USGS Daily Values (5-year history) ───────────────────────────────

/**
 * Fetch 5 years of daily discharge data for a batch of stations.
 * Returns a map of stationId → sorted array of valid flow readings.
 */
async function fetchDVBatch(
  siteIds: string[],
  errors: string[]
): Promise<Map<string, number[]>> {
  const url =
    `https://waterservices.usgs.gov/nwis/dv/?format=json` +
    `&sites=${siteIds.join(',')}` +
    `&parameterCd=00060&period=P5Y&siteStatus=all`;

  const flowsBySite = new Map<string, number[]>();

  try {
    console.log(`[ranges] DV fetch: ${siteIds.length} sites (5-year)`);
    const res = await fetch(url);
    if (!res.ok) {
      errors.push(`USGS DV batch failed (HTTP ${res.status})`);
      return flowsBySite;
    }

    const data: USGSDVResponse = await res.json();
    if (!data.value?.timeSeries) return flowsBySite;

    for (const series of data.value.timeSeries) {
      const siteId = series.sourceInfo.siteCode[0].value;
      if (series.variable.variableCode[0].value !== '00060') continue;

      const flows = parseFlows(series.values[0]?.value ?? []);
      if (flows.length >= 30) flowsBySite.set(siteId, flows); // need at least 30 readings
    }

    console.log(`[ranges] DV: got data for ${flowsBySite.size}/${siteIds.length} sites`);
  } catch (err: any) {
    errors.push(`USGS DV error: ${err?.message ?? String(err)}`);
  }

  return flowsBySite;
}

// ── Stage 2: NWIS Statistics Service (fallback) ───────────────────────────────

/**
 * Fetch pre-calculated annual statistics from the USGS statistics service.
 * Used as a fallback for stations where DV returned no data.
 *
 * The response has one timeSeries per stat type per site.
 * Name format: "USGS:SITEID:00060:STATCODE"
 *   00025 = 25th percentile (P25)
 *   00075 = 75th percentile (P75)
 *
 * Each timeSeries has one value per water year. We take the median
 * of all available years as the long-term representative value.
 */
async function fetchStatsBatch(
  siteIds: string[],
  errors: string[]
): Promise<Map<string, { p25: number; p75: number }>> {
  const url =
    `https://waterservices.usgs.gov/nwis/stat/?format=json` +
    `&sites=${siteIds.join(',')}` +
    `&parameterCd=00060&statReportType=annual`;

  const result = new Map<string, { p25: number; p75: number }>();

  try {
    console.log(`[ranges] Stats fetch: ${siteIds.length} sites`);
    const res = await fetch(url);
    if (!res.ok) {
      errors.push(`USGS stats batch failed (HTTP ${res.status})`);
      return result;
    }

    const data: USGSStatResponse = await res.json();
    if (!data.value?.timeSeries) return result;

    const p25BySite = new Map<string, number[]>();
    const p75BySite = new Map<string, number[]>();

    for (const series of data.value.timeSeries) {
      // Name: "USGS:01075000:00060:00025"
      const parts = series.name?.split(':') ?? [];
      if (parts.length < 4) continue;
      const siteId = parts[1];
      const statCode = parts[3];

      if (statCode !== '00025' && statCode !== '00075') continue;

      const values = parseFlows(series.values[0]?.value ?? []);
      if (statCode === '00025') p25BySite.set(siteId, values);
      if (statCode === '00075') p75BySite.set(siteId, values);
    }

    for (const siteId of siteIds) {
      const vals25 = p25BySite.get(siteId) ?? [];
      const vals75 = p75BySite.get(siteId) ?? [];
      if (vals25.length === 0 || vals75.length === 0) continue;

      // Take the median of all annual P25 / P75 values
      const s25 = [...vals25].sort((a, b) => a - b);
      const s75 = [...vals75].sort((a, b) => a - b);
      const p25 = Math.round(percentile(s25, 50));
      const p75 = Math.round(percentile(s75, 50));

      if (p25 > 0 && p75 > p25) result.set(siteId, { p25, p75 });
    }

    console.log(`[ranges] Stats: got P25/P75 for ${result.size}/${siteIds.length} sites`);
  } catch (err: any) {
    errors.push(`USGS stats error: ${err?.message ?? String(err)}`);
  }

  return result;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const startTime = Date.now();

  // Auth
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get('secret');
  const validAuth =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    querySecret === process.env.CRON_SECRET;
  if (process.env.CRON_SECRET && !validAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // force=true → recalculate ALL rivers, not just those missing ranges
  const force = searchParams.get('force') === 'true';

  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch target rivers
    let query = supabase
      .from('rivers')
      .select('id, name, usgs_station_id, optimal_flow_min, optimal_flow_max')
      .limit(5000);

    if (!force) {
      query = query.or('optimal_flow_min.is.null,optimal_flow_max.is.null');
    }

    const { data: rivers, error: riversError } = await query;

    if (riversError || !rivers) throw new Error('Failed to fetch rivers');

    console.log(`[ranges] Mode: ${force ? 'FORCE (all rivers)' : 'missing only'} — ${rivers.length} rivers`);

    if (rivers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All rivers already have optimal ranges',
        duration_ms: Date.now() - startTime,
      });
    }

    const errors: string[] = [];
    const stationIds = Array.from(new Set(rivers.map((r) => r.usgs_station_id)));

    // ── Stage 1: Daily Values (5 years) ──────────────────────────────────────

    const dvBatches = chunk(stationIds, 50);
    const dvResults = await runWithConcurrency(
      dvBatches.map((batch) => () => fetchDVBatch(batch, errors)),
      3
    );

    const allFlows = new Map<string, number[]>();
    for (const m of dvResults) {
      for (const [id, flows] of m) allFlows.set(id, flows);
    }

    console.log(`[ranges] DV total: ${allFlows.size}/${stationIds.length} stations`);

    // ── Stage 2: NWIS Stats fallback for stations DV missed ───────────────────

    const dvMissed = stationIds.filter((id) => !allFlows.has(id));
    const allStats = new Map<string, { p25: number; p75: number }>();

    if (dvMissed.length > 0) {
      console.log(`[ranges] Stats fallback for ${dvMissed.length} stations`);
      const statBatches = chunk(dvMissed, 50);
      const statResults = await runWithConcurrency(
        statBatches.map((batch) => () => fetchStatsBatch(batch, errors)),
        2
      );
      for (const m of statResults) {
        for (const [id, range] of m) allStats.set(id, range);
      }
      console.log(`[ranges] Stats: resolved ${allStats.size}/${dvMissed.length} previously-missed stations`);
    }

    // ── Update database ───────────────────────────────────────────────────────

    let updated = 0;
    let skipped = 0;
    const permanentlyMissing: string[] = [];
    const updateResults: Array<{
      river: string;
      min: number;
      max: number;
      median: number;
      readings: number;
      source: 'dv' | 'stats';
    }> = [];

    for (const river of rivers) {
      const sid = river.usgs_station_id;
      let p25: number | undefined;
      let p75: number | undefined;
      let median: number | undefined;
      let readings: number | undefined;
      let source: 'dv' | 'stats';

      const dvFlows = allFlows.get(sid);
      if (dvFlows && dvFlows.length >= 30) {
        // Stage 1: DV percentiles
        const sorted = [...dvFlows].sort((a, b) => a - b);
        p25 = Math.round(percentile(sorted, 25));
        p75 = Math.round(percentile(sorted, 75));
        median = Math.round(percentile(sorted, 50));
        readings = dvFlows.length;
        source = 'dv';
      } else {
        // Stage 2: NWIS stats
        const stats = allStats.get(sid);
        if (stats) {
          p25 = stats.p25;
          p75 = stats.p75;
          median = Math.round((p25 + p75) / 2);
          readings = 0;
          source = 'stats';
        }
      }

      if (p25 === undefined || p75 === undefined) {
        skipped++;
        permanentlyMissing.push(`${river.name} (${sid})`);
        continue;
      }

      // Sanity check
      if (p25 <= 0 || p75 <= p25) {
        errors.push(`${river.name}: invalid range (P25=${p25}, P75=${p75}), skipping`);
        skipped++;
        continue;
      }

      const { error: updateError } = await supabase
        .from('rivers')
        .update({ optimal_flow_min: p25, optimal_flow_max: p75 })
        .eq('id', river.id);

      if (updateError) {
        errors.push(`${river.name}: update failed — ${updateError.message}`);
        skipped++;
      } else {
        updated++;
        updateResults.push({ river: river.name, min: p25, max: p75, median: median!, readings: readings!, source: source! });
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(
      `[ranges] Done: ${updated} updated, ${skipped} skipped` +
      ` (${permanentlyMissing.length} permanently missing) in ${totalTime}ms`
    );

    return NextResponse.json({
      success: true,
      mode: force ? 'force' : 'missing_only',
      total_targeted: rivers.length,
      updated,
      skipped,
      permanently_missing: permanentlyMissing,
      duration_ms: totalTime,
      errors,
      results: updateResults,
    });
  } catch (error: any) {
    console.error('[ranges] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message, duration_ms: Date.now() - startTime },
      { status: 500 }
    );
  }
}
