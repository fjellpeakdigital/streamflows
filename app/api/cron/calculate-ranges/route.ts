import { createClient as createServiceClient } from '@supabase/supabase-js';
import { chunk, runWithConcurrency } from '@/lib/usgs';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

// ── Stage 1: USGS Daily Values ────────────────────────────────────────────────

interface USGSDVResponse {
  value: {
    timeSeries: Array<{
      sourceInfo: { siteCode: Array<{ value: string }> };
      variable: { variableCode: Array<{ value: string }> };
      values: Array<{ value: Array<{ value: string }> }>;
    }>;
  };
}

/**
 * Fetch daily discharge data for a batch of stations.
 * Normal mode uses P2Y (2 years) for better percentile quality.
 * Force mode uses P365D (1 year) to keep large-batch payloads manageable.
 */
async function fetchDVBatch(
  siteIds: string[],
  period: string,
  errors: string[]
): Promise<Map<string, number[]>> {
  const url =
    `https://waterservices.usgs.gov/nwis/dv/?format=json` +
    `&sites=${siteIds.join(',')}` +
    `&parameterCd=00060&period=${period}&siteStatus=all`;

  const flowsBySite = new Map<string, number[]>();

  try {
    console.log(`[ranges] DV ${period} fetch: ${siteIds.length} sites`);
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      errors.push(`USGS DV batch failed (HTTP ${res.status}): ${body.slice(0, 120)}`);
      return flowsBySite;
    }

    const data: USGSDVResponse = await res.json();
    if (!data.value?.timeSeries) return flowsBySite;

    for (const series of data.value.timeSeries) {
      const siteId = series.sourceInfo.siteCode[0].value;
      if (series.variable.variableCode[0].value !== '00060') continue;

      const flows = parseFlows(series.values[0]?.value ?? []);
      if (flows.length >= 30) flowsBySite.set(siteId, flows);
    }

    console.log(`[ranges] DV: got data for ${flowsBySite.size}/${siteIds.length} sites`);
  } catch (err: any) {
    errors.push(`USGS DV error: ${err?.message ?? String(err)}`);
  }

  return flowsBySite;
}

// ── Stage 2: NWIS Statistics Service (fallback, RDB format) ───────────────────

/**
 * Parse USGS RDB tab-delimited text, grouping rows by site_no.
 * RDB layout: comment lines (#), then header row, then format row, then data rows.
 */
function parseRdbBySite(rdb: string): Map<string, Array<Record<string, string>>> {
  const result = new Map<string, Array<Record<string, string>>>();
  const lines = rdb.split('\n');
  let headers: string[] = [];
  let skipNext = false; // skip the column-format row after the header

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (headers.length === 0) {
      headers = trimmed.split('\t');
      skipNext = true;
      continue;
    }
    if (skipNext) {
      skipNext = false;
      continue; // format row like "5s\t15s\t10n…"
    }

    const values = trimmed.split('\t');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i]?.trim() ?? ''; });

    const siteId = row['site_no'];
    if (!siteId) continue;
    if (!result.has(siteId)) result.set(siteId, []);
    result.get(siteId)!.push(row);
  }

  return result;
}

/**
 * Fetch pre-calculated annual statistics from the USGS statistics service.
 * Uses RDB (tab-delimited) format — the stats endpoint doesn't support JSON.
 *
 * For each site the response has one row per water year with columns
 * p25_va and p75_va. We take the median of all available years' values
 * as the long-term representative range.
 *
 * Keep batch sizes small (≤10 sites) — the stats endpoint rejects large batches.
 */
async function fetchStatsBatch(
  siteIds: string[],
  errors: string[]
): Promise<Map<string, { p25: number; p75: number }>> {
  const url =
    `https://waterservices.usgs.gov/nwis/stat/?format=rdb` +
    `&sites=${siteIds.join(',')}` +
    `&parameterCd=00060&statReportType=annual&statYearType=water`;

  const result = new Map<string, { p25: number; p75: number }>();

  try {
    console.log(`[ranges] Stats RDB fetch: ${siteIds.length} sites`);
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      errors.push(`USGS stats batch failed (HTTP ${res.status}): ${body.slice(0, 120)}`);
      return result;
    }

    const text = await res.text();
    const rowsBySite = parseRdbBySite(text);

    for (const [siteId, rows] of rowsBySite) {
      const p25Values = rows
        .map((r) => parseFloat(r['p25_va']))
        .filter((v) => !isNaN(v) && v > 0 && v < 999000);
      const p75Values = rows
        .map((r) => parseFloat(r['p75_va']))
        .filter((v) => !isNaN(v) && v > 0 && v < 999000);

      if (p25Values.length === 0 || p75Values.length === 0) continue;

      const s25 = [...p25Values].sort((a, b) => a - b);
      const s75 = [...p75Values].sort((a, b) => a - b);
      const p25 = Math.round(percentile(s25, 50));
      const p75 = Math.round(percentile(s75, 50));

      if (p25 > 0 && p75 > p25) result.set(siteId, { p25, p75 });
    }

    console.log(`[ranges] Stats: resolved ${result.size}/${siteIds.length} sites`);
  } catch (err: any) {
    errors.push(`USGS stats error: ${err?.message ?? String(err)}`);
  }

  return result;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const startTime = Date.now();

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

  // Normal mode: P2Y (2 years, better percentiles), small batches
  // Force mode:  P365D (1 year, proven), larger batches — processes all 1,500+ rivers
  const dvPeriod = force ? 'P365D' : 'P2Y';
  const dvBatchSize = force ? 50 : 20;

  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('rivers')
      .select('id, name, usgs_station_id, optimal_flow_min, optimal_flow_max')
      .limit(5000);

    if (!force) {
      query = query.or('optimal_flow_min.is.null,optimal_flow_max.is.null');
    }

    const { data: rivers, error: riversError } = await query;
    if (riversError || !rivers) throw new Error('Failed to fetch rivers');

    console.log(`[ranges] Mode: ${force ? 'FORCE (all, P365D)' : 'missing only (P2Y)'} — ${rivers.length} rivers`);

    if (rivers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All rivers already have optimal ranges',
        duration_ms: Date.now() - startTime,
      });
    }

    const errors: string[] = [];
    const stationIds = Array.from(new Set(rivers.map((r) => r.usgs_station_id)));

    // ── Stage 1: Daily Values ─────────────────────────────────────────────────

    const dvBatches = chunk(stationIds, dvBatchSize);
    const dvResults = await runWithConcurrency(
      dvBatches.map((batch) => () => fetchDVBatch(batch, dvPeriod, errors)),
      3
    );

    const allFlows = new Map<string, number[]>();
    for (const m of dvResults) {
      for (const [id, flows] of m) allFlows.set(id, flows);
    }
    console.log(`[ranges] DV total: ${allFlows.size}/${stationIds.length} stations`);

    // ── Stage 2: NWIS stats fallback for stations DV missed ───────────────────

    const dvMissed = stationIds.filter((id) => !allFlows.has(id));
    const allStats = new Map<string, { p25: number; p75: number }>();

    if (dvMissed.length > 0) {
      console.log(`[ranges] Stats fallback for ${dvMissed.length} stations (batch=10)`);
      const statBatches = chunk(dvMissed, 10); // stats endpoint rejects large batches
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
      let source: 'dv' | 'stats' | undefined;

      const dvFlows = allFlows.get(sid);
      if (dvFlows && dvFlows.length >= 30) {
        const sorted = [...dvFlows].sort((a, b) => a - b);
        p25     = Math.round(percentile(sorted, 25));
        p75     = Math.round(percentile(sorted, 75));
        median  = Math.round(percentile(sorted, 50));
        readings = dvFlows.length;
        source  = 'dv';
      } else {
        const stats = allStats.get(sid);
        if (stats) {
          p25     = stats.p25;
          p75     = stats.p75;
          median  = Math.round((p25 + p75) / 2);
          readings = 0;
          source  = 'stats';
        }
      }

      if (p25 === undefined || p75 === undefined) {
        skipped++;
        permanentlyMissing.push(`${river.name} (${sid})`);
        continue;
      }

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
      mode: force ? 'force (P365D)' : 'missing_only (P2Y)',
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
