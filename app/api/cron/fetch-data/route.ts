import { createClient as createServiceClient } from '@supabase/supabase-js';
import { calculateStatus, calculateTrend } from '@/lib/river-utils';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
  source: 'iv' | 'dv';
}

const BATCH_SIZE = 50;
const MAX_CONCURRENT = 3;

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

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

/** Parse USGS timeSeries response into a map of site ID -> SiteData */
function parseUSGSResponse(
  data: USGSResponse,
  source: 'iv' | 'dv'
): Map<string, SiteData> {
  const siteDataMap = new Map<string, SiteData>();

  if (!data.value?.timeSeries) return siteDataMap;

  const siteSeriesMap = new Map<string, typeof data.value.timeSeries>();
  for (const series of data.value.timeSeries) {
    const siteId = series.sourceInfo.siteCode[0].value;
    if (!siteSeriesMap.has(siteId)) {
      siteSeriesMap.set(siteId, []);
    }
    siteSeriesMap.get(siteId)!.push(series);
  }

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

    siteDataMap.set(siteId, { flow, temperature, gageHeight, timestamp, source });
  }

  return siteDataMap;
}

/** Fetch a batch of sites from a USGS endpoint */
async function fetchUSGSBatch(
  siteIds: string[],
  endpoint: 'iv' | 'dv',
  errors: string[]
): Promise<Map<string, SiteData>> {
  const sitesParam = siteIds.join(',');
  const baseUrl = `https://waterservices.usgs.gov/nwis/${endpoint}/`;
  const params = endpoint === 'iv'
    ? `format=json&sites=${sitesParam}&parameterCd=00060,00065,00010&siteStatus=all`
    : `format=json&sites=${sitesParam}&parameterCd=00060,00065,00010&siteStatus=all&period=P1D`;
  const usgsUrl = `${baseUrl}?${params}`;

  try {
    console.log(`[cron] Fetching USGS ${endpoint.toUpperCase()} batch: ${siteIds.length} sites`);
    const response = await fetch(usgsUrl);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      errors.push(`USGS ${endpoint} batch failed (HTTP ${response.status}): ${body.slice(0, 200)}`);
      return new Map();
    }

    const data: USGSResponse = await response.json();
    const result = parseUSGSResponse(data, endpoint);
    console.log(`[cron] USGS ${endpoint.toUpperCase()} batch: ${result.size}/${siteIds.length} sites returned data`);
    return result;
  } catch (error: any) {
    errors.push(`USGS ${endpoint} batch error: ${error?.message ?? String(error)}`);
    return new Map();
  }
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

    const { data: rivers, error: riversError } = await supabase
      .from('rivers')
      .select('*');

    if (riversError || !rivers) {
      throw new Error('Failed to fetch rivers');
    }

    console.log(`[cron] Fetching data for ${rivers.length} rivers`);
    const results: Array<{ river: string; flow: number | null; temperature: number | null; status: string; source: string }> = [];
    const errors: string[] = [];

    // Build station -> rivers lookup
    const stationToRivers = new Map<string, typeof rivers>();
    for (const river of rivers) {
      const sid = river.usgs_station_id;
      if (!stationToRivers.has(sid)) {
        stationToRivers.set(sid, []);
      }
      stationToRivers.get(sid)!.push(river);
    }

    const allStationIds = Array.from(stationToRivers.keys());

    // -- Phase 1: Fetch Instantaneous Values (real-time) --
    const ivBatches = chunk(allStationIds, BATCH_SIZE);
    console.log(`[cron] Phase 1 (IV): ${allStationIds.length} stations in ${ivBatches.length} batch(es)`);
    const ivStart = Date.now();

    const ivResults = await runWithConcurrency(
      ivBatches.map((batch) => () => fetchUSGSBatch(batch, 'iv', errors)),
      MAX_CONCURRENT
    );

    const allSiteData = new Map<string, SiteData>();
    for (const batchMap of ivResults) {
      for (const [siteId, data] of batchMap) {
        allSiteData.set(siteId, data);
      }
    }

    console.log(`[cron] Phase 1 (IV) complete in ${Date.now() - ivStart}ms — ${allSiteData.size}/${allStationIds.length} sites`);

    // -- Phase 2: Fetch Daily Values for stations missing from IV --
    const missingSiteIds = allStationIds.filter((id) => !allSiteData.has(id));

    if (missingSiteIds.length > 0) {
      // DV responses are smaller — use larger batches and more concurrency
      const DV_BATCH_SIZE = 100;
      const DV_CONCURRENT = 5;
      const dvBatches = chunk(missingSiteIds, DV_BATCH_SIZE);
      console.log(`[cron] Phase 2 (DV): ${missingSiteIds.length} stations in ${dvBatches.length} batch(es)`);
      const dvStart = Date.now();

      const dvResults = await runWithConcurrency(
        dvBatches.map((batch) => () => fetchUSGSBatch(batch, 'dv', errors)),
        DV_CONCURRENT
      );

      for (const batchMap of dvResults) {
        for (const [siteId, data] of batchMap) {
          allSiteData.set(siteId, data);
        }
      }

      console.log(`[cron] Phase 2 (DV) complete in ${Date.now() - dvStart}ms — now ${allSiteData.size}/${allStationIds.length} sites total`);
    }

    // -- Fetch old flows for trend calculation --
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const { data: oldConditions } = await supabase
      .from('conditions')
      .select('river_id, flow, timestamp')
      .lte('timestamp', threeHoursAgo)
      .order('timestamp', { ascending: false });

    const oldFlowMap = new Map<string, number>();
    if (oldConditions) {
      for (const cond of oldConditions) {
        if (!oldFlowMap.has(cond.river_id) && cond.flow !== null && cond.flow > -999000) {
          oldFlowMap.set(cond.river_id, cond.flow);
        }
      }
    }

    // -- Process rivers and prepare inserts --
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
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

    const noDataRivers: string[] = [];
    let ivCount = 0;
    let dvCount = 0;

    for (const river of rivers) {
      const siteData = allSiteData.get(river.usgs_station_id);
      if (!siteData) {
        noDataRivers.push(river.name);
        continue;
      }

      // Skip very stale data (7 days for DV, 24h for IV)
      const dataAge = Date.now() - new Date(siteData.timestamp).getTime();
      const maxAge = siteData.source === 'dv' ? sevenDays : twentyFourHours;
      if (dataAge > maxAge) {
        errors.push(`${river.name}: stale ${siteData.source} data (${siteData.timestamp}), skipping`);
        continue;
      }

      const status = calculateStatus(
        siteData.flow,
        river.optimal_flow_min,
        river.optimal_flow_max
      );

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
        source: siteData.source,
      });

      if (siteData.source === 'iv') ivCount++;
      else dvCount++;
    }

    // -- Batch insert --
    if (inserts.length > 0) {
      const insertStart = Date.now();
      const { error: insertError } = await supabase
        .from('conditions')
        .insert(inserts);

      if (insertError) {
        console.log(`[cron] Batch insert failed, falling back to individual inserts: ${insertError.message}`);
        let inserted = 0;
        for (const row of inserts) {
          const { error: rowError } = await supabase.from('conditions').insert(row);
          if (rowError) {
            if (rowError.code !== '23505') {
              const riverName = rivers.find((r) => r.id === row.river_id)?.name ?? row.river_id;
              errors.push(`INSERT ${riverName}: ${JSON.stringify(rowError)}`);
            }
          } else {
            inserted++;
          }
        }
        console.log(`[cron] Individual inserts: ${inserted}/${inserts.length} in ${Date.now() - insertStart}ms`);
      } else {
        console.log(`[cron] Batch insert: ${inserts.length} rows in ${Date.now() - insertStart}ms`);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[cron] Complete: ${results.length}/${rivers.length} rivers (${ivCount} IV, ${dvCount} DV) in ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      total_rivers: rivers.length,
      processed: results.length,
      sources: { iv: ivCount, dv: dvCount },
      no_data_count: noDataRivers.length,
      no_data_rivers: noDataRivers,
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
