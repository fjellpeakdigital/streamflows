import { createClient as createServiceClient } from '@supabase/supabase-js';
import { chunk, runWithConcurrency } from '@/lib/usgs';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface USGSDVResponse {
  value: {
    timeSeries: Array<{
      sourceInfo: {
        siteCode: Array<{ value: string }>;
      };
      variable: {
        variableCode: Array<{ value: string }>;
      };
      values: Array<{
        value: Array<{
          value: string;
          dateTime: string;
        }>;
      }>;
    }>;
  };
}

/** Calculate a percentile from a sorted array */
function percentile(sorted: number[], p: number): number {
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/** Fetch 1 year of daily discharge data for a batch of sites */
async function fetchHistoricalBatch(
  siteIds: string[],
  errors: string[]
): Promise<Map<string, number[]>> {
  const sitesParam = siteIds.join(',');
  const url = `https://waterservices.usgs.gov/nwis/dv/?format=json&sites=${sitesParam}&parameterCd=00060&period=P365D&siteStatus=all`;

  const flowsBySite = new Map<string, number[]>();

  try {
    console.log(`[ranges] Fetching DV history for ${siteIds.length} sites`);
    const response = await fetch(url);
    if (!response.ok) {
      errors.push(`USGS DV history batch failed (HTTP ${response.status})`);
      return flowsBySite;
    }

    const data: USGSDVResponse = await response.json();

    if (!data.value?.timeSeries) {
      return flowsBySite;
    }

    for (const series of data.value.timeSeries) {
      const siteId = series.sourceInfo.siteCode[0].value;
      const paramCode = series.variable.variableCode[0].value;

      // Only care about discharge (00060)
      if (paramCode !== '00060') continue;

      const values = series.values[0]?.value;
      if (!values || values.length === 0) continue;

      const flows: number[] = [];
      for (const v of values) {
        const f = parseFloat(v.value);
        // Skip ice-affected readings and invalid values
        if (!isNaN(f) && f > 0 && f < 999000) {
          flows.push(f);
        }
      }

      if (flows.length >= 10) {
        flowsBySite.set(siteId, flows);
      }
    }

    console.log(`[ranges] Got historical flows for ${flowsBySite.size}/${siteIds.length} sites`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`USGS DV history error: ${message}`);
  }

  return flowsBySite;
}

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

  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find rivers missing optimal ranges
    const { data: rivers, error: riversError } = await supabase
      .from('rivers')
      .select('id, name, usgs_station_id, optimal_flow_min, optimal_flow_max')
      .or('optimal_flow_min.is.null,optimal_flow_max.is.null')
      .limit(5000);

    if (riversError || !rivers) {
      throw new Error('Failed to fetch rivers');
    }

    console.log(`[ranges] ${rivers.length} rivers missing optimal ranges`);

    if (rivers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All rivers already have optimal ranges',
        duration_ms: Date.now() - startTime,
      });
    }

    const errors: string[] = [];

    // Collect unique station IDs
    const stationIds = Array.from(new Set(rivers.map((r) => r.usgs_station_id)));

    // Fetch historical daily values in batches
    const batches = chunk(stationIds, 50);
    const batchResults = await runWithConcurrency(
      batches.map((batch) => () => fetchHistoricalBatch(batch, errors)),
      3
    );

    // Merge results
    const allFlows = new Map<string, number[]>();
    for (const batchMap of batchResults) {
      for (const [siteId, flows] of batchMap) {
        allFlows.set(siteId, flows);
      }
    }

    console.log(`[ranges] Got historical data for ${allFlows.size}/${stationIds.length} stations`);

    // Calculate ranges and update
    let updated = 0;
    let skipped = 0;
    const updateResults: Array<{ river: string; min: number; max: number; median: number; readings: number }> = [];

    for (const river of rivers) {
      const flows = allFlows.get(river.usgs_station_id);
      if (!flows || flows.length < 10) {
        skipped++;
        continue;
      }

      // Sort for percentile calculation
      const sorted = [...flows].sort((a, b) => a - b);

      const p25 = Math.round(percentile(sorted, 25));
      const p75 = Math.round(percentile(sorted, 75));
      const median = Math.round(percentile(sorted, 50));

      // Sanity check: min should be > 0 and max should be > min
      if (p25 <= 0 || p75 <= p25) {
        errors.push(`${river.name}: invalid range calculated (P25=${p25}, P75=${p75}), skipping`);
        continue;
      }

      const { error: updateError } = await supabase
        .from('rivers')
        .update({
          optimal_flow_min: p25,
          optimal_flow_max: p75,
        })
        .eq('id', river.id);

      if (updateError) {
        errors.push(`${river.name}: update failed — ${updateError.message}`);
      } else {
        updated++;
        updateResults.push({
          river: river.name,
          min: p25,
          max: p75,
          median,
          readings: flows.length,
        });
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[ranges] Complete: ${updated} updated, ${skipped} skipped (no data) in ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      total_missing: rivers.length,
      updated,
      skipped,
      no_historical_data: skipped,
      duration_ms: totalTime,
      errors,
      results: updateResults,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in calculate-ranges:', error);
    return NextResponse.json({ success: false, error: message, duration_ms: Date.now() - startTime }, { status: 500 });
  }
}
