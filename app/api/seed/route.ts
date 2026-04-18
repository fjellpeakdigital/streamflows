import { createClient as createServiceClient } from '@supabase/supabase-js';
import { calculateStatus } from '@/lib/river-utils';
import { chunk, runWithConcurrency } from '@/lib/usgs';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface USGSResponse {
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

/** Fetch historical daily values for a batch of sites for a date range */
async function fetchHistoricalBatch(
  siteIds: string[],
  startDate: string,
  endDate: string,
  errors: string[]
): Promise<Map<string, Array<{ timestamp: string; flow: number | null; temperature: number | null; gageHeight: number | null }>>> {
  const sitesParam = siteIds.join(',');
  const url = `https://waterservices.usgs.gov/nwis/dv/?format=json&sites=${sitesParam}&parameterCd=00060,00065,00010&startDT=${startDate}&endDT=${endDate}&siteStatus=all`;

  const result = new Map<string, Array<{ timestamp: string; flow: number | null; temperature: number | null; gageHeight: number | null }>>();

  try {
    const response = await fetch(url);
    if (!response.ok) {
      errors.push(`USGS DV batch failed (HTTP ${response.status}) for ${siteIds.length} sites, ${startDate} to ${endDate}`);
      return result;
    }

    const data: USGSResponse = await response.json();
    if (!data.value?.timeSeries) return result;

    // Group all series by site ID
    const siteSeriesMap = new Map<string, typeof data.value.timeSeries>();
    for (const series of data.value.timeSeries) {
      const siteId = series.sourceInfo.siteCode[0].value;
      if (!siteSeriesMap.has(siteId)) {
        siteSeriesMap.set(siteId, []);
      }
      siteSeriesMap.get(siteId)!.push(series);
    }

    // For each site, merge all parameters by date
    for (const [siteId, seriesList] of siteSeriesMap) {
      const dateMap = new Map<string, { flow: number | null; temperature: number | null; gageHeight: number | null }>();

      for (const series of seriesList) {
        const paramCode = series.variable.variableCode[0].value;
        const values = series.values[0]?.value;
        if (!values) continue;

        for (const v of values) {
          const ts = v.dateTime;
          if (!dateMap.has(ts)) {
            dateMap.set(ts, { flow: null, temperature: null, gageHeight: null });
          }
          const entry = dateMap.get(ts)!;
          const val = parseFloat(v.value);

          if (paramCode === '00060') {
            entry.flow = isNaN(val) ? null : val;
          } else if (paramCode === '00010') {
            entry.temperature = isNaN(val) ? null : (val * 9) / 5 + 32;
          } else if (paramCode === '00065') {
            entry.gageHeight = isNaN(val) ? null : val;
          }
        }
      }

      const readings = Array.from(dateMap.entries()).map(([timestamp, data]) => ({
        timestamp,
        ...data,
      }));

      if (readings.length > 0) {
        result.set(siteId, readings);
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`USGS DV error: ${message}`);
  }

  return result;
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

  const offset = parseInt(searchParams.get('offset') || '0');
  const batchSize = parseInt(searchParams.get('batch') || '50');
  const year = parseInt(searchParams.get('year') || '2025');

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get rivers for this batch
    const { data: rivers, error: riversError } = await supabase
      .from('rivers')
      .select('id, name, usgs_station_id, optimal_flow_min, optimal_flow_max')
      .order('name')
      .range(offset, offset + batchSize - 1);

    if (riversError || !rivers) {
      throw new Error('Failed to fetch rivers');
    }

    if (rivers.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No more rivers at offset ${offset}. Seeding complete for year ${year}.`,
        done: true,
        duration_ms: Date.now() - startTime,
      });
    }

    console.log(`[seed] Year ${year}, offset ${offset}: processing ${rivers.length} rivers`);
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

    const stationIds = Array.from(stationToRivers.keys());

    // Fetch historical data in sub-batches
    const batches = chunk(stationIds, 25);
    const batchResults = await runWithConcurrency(
      batches.map((batch) => () => fetchHistoricalBatch(batch, startDate, endDate, errors)),
      3
    );

    // Merge results
    const allData = new Map<string, Array<{ timestamp: string; flow: number | null; temperature: number | null; gageHeight: number | null }>>();
    for (const batchMap of batchResults) {
      for (const [siteId, readings] of batchMap) {
        allData.set(siteId, readings);
      }
    }

    console.log(`[seed] Got historical data for ${allData.size}/${stationIds.length} stations`);

    // Build condition rows
    let totalRows = 0;
    let insertedRows = 0;
    let skippedDuplicates = 0;

    for (const river of rivers) {
      const readings = allData.get(river.usgs_station_id);
      if (!readings) continue;

      // Build rows for this river
      const rows = readings.map((r) => ({
        river_id: river.id,
        timestamp: r.timestamp,
        flow: r.flow,
        temperature: r.temperature,
        gage_height: r.gageHeight,
        status: calculateStatus(r.flow, river.optimal_flow_min, river.optimal_flow_max),
        trend: 'unknown' as string,
      }));

      totalRows += rows.length;

      // Insert in chunks of 500 to avoid payload limits
      const insertChunks = chunk(rows, 500);
      for (const insertChunk of insertChunks) {
        const { error: insertError } = await supabase
          .from('conditions')
          .insert(insertChunk);

        if (insertError) {
          if (insertError.code === '23505') {
            // Batch has duplicates — fall back to individual upsert-style inserts
            for (const row of insertChunk) {
              const { error: rowError } = await supabase.from('conditions').insert(row);
              if (rowError) {
                if (rowError.code === '23505') {
                  skippedDuplicates++;
                } else {
                  errors.push(`INSERT: ${JSON.stringify(rowError).slice(0, 100)}`);
                }
              } else {
                insertedRows++;
              }
            }
          } else {
            errors.push(`Batch insert: ${insertError.message}`);
          }
        } else {
          insertedRows += insertChunk.length;
        }
      }
    }

    const totalTime = Date.now() - startTime;
    const hasMore = rivers.length === batchSize;
    const nextOffset = offset + batchSize;

    console.log(`[seed] Year ${year}, offset ${offset}: ${insertedRows} inserted, ${skippedDuplicates} duplicates skipped in ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      year,
      offset,
      rivers_in_batch: rivers.length,
      stations_with_data: allData.size,
      total_rows: totalRows,
      inserted: insertedRows,
      duplicates_skipped: skippedDuplicates,
      duration_ms: totalTime,
      done: !hasMore,
      next: hasMore
        ? `/api/seed?year=${year}&offset=${nextOffset}&batch=${batchSize}&secret=YOUR_SECRET`
        : null,
      errors: errors.slice(0, 20),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in seed:', error);
    return NextResponse.json({ success: false, error: message, duration_ms: Date.now() - startTime }, { status: 500 });
  }
}
