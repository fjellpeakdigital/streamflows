import { createClient as createServiceClient } from '@supabase/supabase-js';
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

    const { data: rivers, error: riversError } = await supabase
      .from('rivers')
      .select('id, name, usgs_station_id, gauge_type')
      .limit(5000);

    if (riversError || !rivers) {
      throw new Error('Failed to fetch rivers');
    }

    console.log(`[detect] Checking ${rivers.length} rivers against USGS IV endpoint`);
    const errors: string[] = [];

    // Get all unique station IDs
    const allStationIds = Array.from(new Set(rivers.map((r) => r.usgs_station_id)));

    // Fetch IV data for all stations to see which ones respond
    const ivData = await fetchAllSites(allStationIds, 'iv', errors, 50, 3);

    const ivStationIds = new Set(ivData.keys());
    console.log(`[detect] ${ivStationIds.size}/${allStationIds.length} stations have IV (realtime) data`);

    // Update each river's gauge_type based on whether it has IV data
    let realtimeCount = 0;
    let dailyCount = 0;
    const updateErrors: string[] = [];

    for (const river of rivers) {
      const newType = ivStationIds.has(river.usgs_station_id) ? 'realtime' : 'daily';

      if (river.gauge_type !== newType) {
        const { error: updateError } = await supabase
          .from('rivers')
          .update({ gauge_type: newType })
          .eq('id', river.id);

        if (updateError) {
          updateErrors.push(`${river.name}: ${updateError.message}`);
        }
      }

      if (newType === 'realtime') realtimeCount++;
      else dailyCount++;
    }

    const totalTime = Date.now() - startTime;
    console.log(`[detect] Complete in ${totalTime}ms: ${realtimeCount} realtime, ${dailyCount} daily`);

    return NextResponse.json({
      success: true,
      total_rivers: rivers.length,
      realtime: realtimeCount,
      daily: dailyCount,
      duration_ms: totalTime,
      update_errors: updateErrors,
      errors,
    });
  } catch (error: any) {
    console.error('Error in detect-gauge-types:', error);
    return NextResponse.json({ success: false, error: error.message, duration_ms: Date.now() - startTime }, { status: 500 });
  }
}
