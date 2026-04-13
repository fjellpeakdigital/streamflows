import { createClient as createServiceClient } from '@supabase/supabase-js';
import { calculateStatus, calculateTrend } from '@/lib/river-utils';
import { fetchAllSites } from '@/lib/usgs';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

    // Only fetch daily (DV) rivers
    const { data: rivers, error: riversError } = await supabase
      .from('rivers')
      .select('*')
      .eq('gauge_type', 'daily');

    if (riversError || !rivers) {
      throw new Error('Failed to fetch rivers');
    }

    console.log(`[cron:daily] Fetching DV data for ${rivers.length} rivers`);
    const results: Array<{ river: string; flow: number | null; temperature: number | null; status: string }> = [];
    const errors: string[] = [];

    // Collect unique station IDs
    const stationIds = Array.from(new Set(rivers.map((r) => r.usgs_station_id)));

    // Fetch DV data with larger batches
    const allSiteData = await fetchAllSites(stationIds, 'dv', errors, 100, 5);

    // Fetch old flows for trend calculation
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const riverIds = rivers.map((r) => r.id);
    const { data: oldConditions } = await supabase
      .from('conditions')
      .select('river_id, flow, timestamp')
      .in('river_id', riverIds)
      .lte('timestamp', oneDayAgo)
      .order('timestamp', { ascending: false });

    const oldFlowMap = new Map<string, number>();
    if (oldConditions) {
      for (const cond of oldConditions) {
        if (!oldFlowMap.has(cond.river_id) && cond.flow !== null && cond.flow > -999000) {
          oldFlowMap.set(cond.river_id, cond.flow);
        }
      }
    }

    // Process rivers
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const inserts: Array<{
      river_id: string;
      timestamp: string;
      flow: number | null;
      temperature: number | null;
      gage_height: number | null;
      status: string;
      trend: string;
    }> = [];

    let noDataCount = 0;
    for (const river of rivers) {
      const siteData = allSiteData.get(river.usgs_station_id);
      if (!siteData) {
        noDataCount++;
        continue;
      }

      const dataAge = Date.now() - new Date(siteData.timestamp).getTime();
      if (dataAge > sevenDays) {
        errors.push(`${river.name}: stale DV data (${siteData.timestamp}), skipping`);
        continue;
      }

      const status = calculateStatus(siteData.flow, river.optimal_flow_min, river.optimal_flow_max);

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

      results.push({ river: river.name, flow: siteData.flow, temperature: siteData.temperature, status });
    }

    // Batch insert with duplicate fallback
    if (inserts.length > 0) {
      const insertStart = Date.now();
      const { error: insertError } = await supabase.from('conditions').insert(inserts);

      if (insertError) {
        console.log(`[cron:daily] Batch insert failed, falling back to individual: ${insertError.message}`);
        let inserted = 0;
        for (const row of inserts) {
          const { error: rowError } = await supabase.from('conditions').insert(row);
          if (rowError && rowError.code !== '23505') {
            const name = rivers.find((r) => r.id === row.river_id)?.name ?? row.river_id;
            errors.push(`INSERT ${name}: ${JSON.stringify(rowError)}`);
          } else if (!rowError) {
            inserted++;
          }
        }
        console.log(`[cron:daily] Individual inserts: ${inserted}/${inserts.length} in ${Date.now() - insertStart}ms`);
      } else {
        console.log(`[cron:daily] Batch insert: ${inserts.length} rows in ${Date.now() - insertStart}ms`);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[cron:daily] Complete: ${results.length}/${rivers.length} rivers in ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      cron: 'daily',
      total_rivers: rivers.length,
      processed: results.length,
      no_data_count: noDataCount,
      duration_ms: totalTime,
      errors,
      results,
    });
  } catch (error: any) {
    console.error('Error in daily cron:', error);
    return NextResponse.json({ success: false, error: error.message, duration_ms: Date.now() - startTime }, { status: 500 });
  }
}
