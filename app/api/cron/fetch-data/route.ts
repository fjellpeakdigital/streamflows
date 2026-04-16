import { createClient as createServiceClient } from '@supabase/supabase-js';
import { calculateStatus, calculateTrend } from '@/lib/river-utils';
import { fetchAllSites } from '@/lib/usgs';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

    // Only fetch realtime (IV) rivers
    const { data: rivers, error: riversError } = await supabase
      .from('rivers')
      .select('*')
      .neq('gauge_type', 'daily')
      .limit(5000);

    if (riversError || !rivers) {
      throw new Error('Failed to fetch rivers');
    }

    console.log(`[cron:realtime] Fetching IV data for ${rivers.length} rivers`);
    const results: Array<{ river: string; flow: number | null; temperature: number | null; status: string }> = [];
    const errors: string[] = [];

    // Collect unique station IDs
    const stationIds = Array.from(new Set(rivers.map((r) => r.usgs_station_id)));

    // Fetch IV data
    const allSiteData = await fetchAllSites(stationIds, 'iv', errors, 50, 3);

    // Fetch old flows for trend calculation
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const riverIds = rivers.map((r) => r.id);
    const { data: oldConditions } = await supabase
      .from('conditions')
      .select('river_id, flow, timestamp')
      .in('river_id', riverIds)
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

    // Process rivers
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

    let noDataCount = 0;
    for (const river of rivers) {
      const siteData = allSiteData.get(river.usgs_station_id);
      if (!siteData) {
        noDataCount++;
        continue;
      }

      const dataAge = Date.now() - new Date(siteData.timestamp).getTime();
      if (dataAge > twentyFourHours) {
        errors.push(`${river.name}: stale IV data (${siteData.timestamp}), skipping`);
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

    if (inserts.length > 0) {
      const insertStart = Date.now();
      const { error: upsertError } = await supabase
        .from('conditions')
        .upsert(inserts, { onConflict: 'river_id,timestamp' });

      if (upsertError) {
        errors.push(`Upsert failed: ${upsertError.message}`);
        console.error(`[cron:realtime] Upsert error: ${upsertError.message}`);
      } else {
        console.log(`[cron:realtime] Upsert: ${inserts.length} rows in ${Date.now() - insertStart}ms`);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[cron:realtime] Complete: ${results.length}/${rivers.length} rivers in ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      cron: 'realtime',
      total_rivers: rivers.length,
      processed: results.length,
      no_data_count: noDataCount,
      duration_ms: totalTime,
      errors,
      results,
    });
  } catch (error: any) {
    console.error('Error in realtime cron:', error);
    return NextResponse.json({ success: false, error: error.message, duration_ms: Date.now() - startTime }, { status: 500 });
  }
}
