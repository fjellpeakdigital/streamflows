import { createClient as createServiceClient } from '@supabase/supabase-js';
import { calculateStatus, calculateTrend } from '@/lib/river-utils';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface USGSResponse {
  value: {
    timeSeries: Array<{
      sourceInfo: {
        siteCode: Array<{
          value: string;
        }>;
      };
      variable: {
        variableCode: Array<{
          value: string;
        }>;
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

interface SiteData {
  flow: number | null;
  temperature: number | null;
  gageHeight: number | null;
  timestamp: string;
}

const BATCH_SIZE = 100;
const MAX_CONCURRENT = 3;

/** Split an array into chunks of a given size */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Run async functions with limited concurrency */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p = task().then((result) => {
      results.push(result);
    });
    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((e) => e === p),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

/** Fetch a batch of sites from USGS and return parsed data keyed by site ID */
async function fetchUSGSBatch(
  siteIds: string[],
  errors: string[]
): Promise<Map<string, SiteData>> {
  const siteDataMap = new Map<string, SiteData>();
  const sitesParam = siteIds.join(',');
  const usgsUrl = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${sitesParam}&parameterCd=00060,00065,00010&siteStatus=all`;

  try {
    const response = await fetch(usgsUrl);
    if (!response.ok) {
      errors.push(`USGS batch fetch failed (HTTP ${response.status}) for ${siteIds.length} sites`);
      return siteDataMap;
    }

    const data: USGSResponse = await response.json();

    if (!data.value?.timeSeries) {
      errors.push(`USGS batch: no timeSeries in response for ${siteIds.length} sites`);
      return siteDataMap;
    }

    // Group time series by site ID
    const siteSeriesMap = new Map<string, typeof data.value.timeSeries>();
    for (const series of data.value.timeSeries) {
      const siteId = series.sourceInfo.siteCode[0].value;
      if (!siteSeriesMap.has(siteId)) {
        siteSeriesMap.set(siteId, []);
      }
      siteSeriesMap.get(siteId)!.push(series);
    }

    // Parse each site's data
    for (const [siteId, seriesList] of siteSeriesMap) {
      let flow: number | null = null;
      let temperature: number | null = null;
      let gageHeight: number | null = null;
      let timestamp = new Date().toISOString();

      for (const series of seriesList) {
        const paramCode = series.variable.variableCode[0].value;
        const values = series.values[0]?.value;
        if (!values || values.length === 0) continue;

        const latestValue = values[values.length - 1];
        timestamp = latestValue.dateTime;

        if (paramCode === '00060') {
          flow = parseFloat(latestValue.value);
        } else if (paramCode === '00010') {
          const celsius = parseFloat(latestValue.value);
          temperature = (celsius * 9) / 5 + 32;
        } else if (paramCode === '00065') {
          gageHeight = parseFloat(latestValue.value);
        }
      }

      siteDataMap.set(siteId, { flow, temperature, gageHeight, timestamp });
    }
  } catch (error: any) {
    errors.push(`USGS batch error: ${error?.message ?? String(error)}`);
  }

  return siteDataMap;
}

export async function GET(request: Request) {
  const startTime = Date.now();

  // Verify cron secret via header or query param
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

    // Get all rivers
    const { data: rivers, error: riversError } = await supabase
      .from('rivers')
      .select('*');

    if (riversError || !rivers) {
      throw new Error('Failed to fetch rivers');
    }

    console.log(`[cron] Fetching data for ${rivers.length} rivers`);
    const results: Array<{ river: string; flow: number | null; temperature: number | null; status: string }> = [];
    const errors: string[] = [];

    // Build a map of station ID → river(s) for quick lookup
    const stationToRivers = new Map<string, typeof rivers>();
    for (const river of rivers) {
      const sid = river.usgs_station_id;
      if (!stationToRivers.has(sid)) {
        stationToRivers.set(sid, []);
      }
      stationToRivers.get(sid)!.push(river);
    }

    // Batch USGS API calls
    const allStationIds = Array.from(stationToRivers.keys());
    const batches = chunk(allStationIds, BATCH_SIZE);

    console.log(`[cron] ${allStationIds.length} stations in ${batches.length} batch(es)`);
    const fetchStart = Date.now();

    // Fetch all batches with limited concurrency
    const batchResults = await runWithConcurrency(
      batches.map((batch) => () => fetchUSGSBatch(batch, errors)),
      MAX_CONCURRENT
    );

    // Merge all batch results into one map
    const allSiteData = new Map<string, SiteData>();
    for (const batchMap of batchResults) {
      for (const [siteId, data] of batchMap) {
        allSiteData.set(siteId, data);
      }
    }

    console.log(`[cron] USGS fetch complete in ${Date.now() - fetchStart}ms — got data for ${allSiteData.size} sites`);

    // Fetch old flows for trend calculation (one query for all rivers)
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const { data: oldConditions } = await supabase
      .from('conditions')
      .select('river_id, flow, timestamp')
      .lte('timestamp', threeHoursAgo)
      .order('timestamp', { ascending: false });

    // Build a map of river_id → most recent old flow (for trend calc)
    const oldFlowMap = new Map<string, number>();
    if (oldConditions) {
      for (const cond of oldConditions) {
        // Only keep the first (most recent) one per river
        if (!oldFlowMap.has(cond.river_id) && cond.flow !== null && cond.flow > -999000) {
          oldFlowMap.set(cond.river_id, cond.flow);
        }
      }
    }

    // Process each river and prepare inserts
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const inserts: Array<{
      river_id: string;
      timestamp: string;
      flow: number | null;
      temperature: number | null;
      gage_height: number | null;
      status: string;
      trend: string;
    }> = [];

    for (const river of rivers) {
      const siteData = allSiteData.get(river.usgs_station_id);
      if (!siteData) {
        errors.push(`${river.name}: no data returned from USGS`);
        continue;
      }

      // Skip stale data
      const dataAge = Date.now() - new Date(siteData.timestamp).getTime();
      if (dataAge > twentyFourHours) {
        errors.push(`${river.name}: stale data (timestamp: ${siteData.timestamp}), skipping`);
        continue;
      }

      const status = calculateStatus(
        siteData.flow,
        river.optimal_flow_min,
        river.optimal_flow_max
      );

      // Calculate trend
      let trend: string = 'unknown';
      if (siteData.flow !== null && siteData.flow > -999000) {
        const oldFlow = oldFlowMap.get(river.id);
        if (oldFlow !== undefined) {
          trend = calculateTrend(siteData.flow, oldFlow);
        }
      }

      inserts.push({
        river_id: river.id,
        timestamp: siteData.timestamp,
        flow: siteData.flow,
        temperature: siteData.temperature,
        gage_height: siteData.gageHeight,
        status,
        trend,
      });

      results.push({
        river: river.name,
        flow: siteData.flow,
        temperature: siteData.temperature,
        status,
      });
    }

    // Batch insert all conditions at once
    if (inserts.length > 0) {
      const insertStart = Date.now();
      const { error: insertError } = await supabase
        .from('conditions')
        .insert(inserts);

      if (insertError) {
        // If batch insert fails (e.g. some duplicates), fall back to individual inserts
        console.log(`[cron] Batch insert failed, falling back to individual inserts: ${insertError.message}`);
        let inserted = 0;
        for (const row of inserts) {
          const { error: rowError } = await supabase.from('conditions').insert(row);
          if (rowError) {
            // Find river name for error message
            const riverName = rivers.find((r) => r.id === row.river_id)?.name ?? row.river_id;
            if (rowError.code === '23505') {
              // Duplicate — silently skip
            } else {
              errors.push(`INSERT ${riverName}: ${JSON.stringify(rowError)}`);
            }
          } else {
            inserted++;
          }
        }
        console.log(`[cron] Individual inserts: ${inserted}/${inserts.length} succeeded in ${Date.now() - insertStart}ms`);
      } else {
        console.log(`[cron] Batch insert: ${inserts.length} rows in ${Date.now() - insertStart}ms`);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[cron] Complete: ${results.length}/${rivers.length} rivers in ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      total_rivers: rivers.length,
      processed: results.length,
      duration_ms: totalTime,
      errors,
      results,
    });
  } catch (error: any) {
    console.error('Error in fetch-data cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
