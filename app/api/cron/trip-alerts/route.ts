import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALERT_TYPE = 'optimal_flow';
const TRIP_WINDOW_THRESHOLD = 0;

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

    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const fiveDaysOut = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('id, user_id, target_river_id, trip_date')
      .eq('status', 'upcoming')
      .gte('trip_date', todayIso)
      .lte('trip_date', fiveDaysOut);

    if (tripsError) throw new Error(tripsError.message);

    if (!trips || trips.length === 0) {
      return NextResponse.json({
        success: true,
        cron: 'trip-alerts',
        trips_in_window: 0,
        inserted: 0,
        deactivated: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    const riverIds = Array.from(new Set(trips.map((t) => t.target_river_id)));

    // Latest condition per river (72h window)
    const seventyTwoHoursAgo = new Date(
      Date.now() - 72 * 60 * 60 * 1000
    ).toISOString();
    const { data: conditions } = await supabase
      .from('conditions')
      .select('river_id, status, timestamp')
      .in('river_id', riverIds)
      .gte('timestamp', seventyTwoHoursAgo)
      .order('timestamp', { ascending: false });

    const latestByRiver = new Map<string, { status: string | null }>();
    for (const c of conditions ?? []) {
      if (!latestByRiver.has(c.river_id)) {
        latestByRiver.set(c.river_id, { status: c.status });
      }
    }

    // Existing active trip-window alerts for these (user, river) pairs
    const userIds = Array.from(new Set(trips.map((t) => t.user_id)));
    const { data: existingAlerts } = await supabase
      .from('user_alerts')
      .select('id, user_id, river_id, is_active')
      .eq('alert_type', ALERT_TYPE)
      .eq('threshold_value', TRIP_WINDOW_THRESHOLD)
      .in('user_id', userIds)
      .in('river_id', riverIds);

    const activeKey = (userId: string, riverId: string) => `${userId}:${riverId}`;
    const activeAlertByKey = new Map<string, { id: string; is_active: boolean }>();
    for (const a of existingAlerts ?? []) {
      activeAlertByKey.set(activeKey(a.user_id, a.river_id), {
        id: a.id,
        is_active: a.is_active,
      });
    }

    const inserts: Array<{
      user_id: string;
      river_id: string;
      alert_type: string;
      threshold_value: number;
      is_active: boolean;
    }> = [];
    const deactivateIds: string[] = [];

    for (const trip of trips) {
      const latest = latestByRiver.get(trip.target_river_id);
      const isOptimal = latest?.status === 'optimal';
      const key = activeKey(trip.user_id, trip.target_river_id);
      const existing = activeAlertByKey.get(key);

      if (isOptimal) {
        if (!existing) {
          inserts.push({
            user_id: trip.user_id,
            river_id: trip.target_river_id,
            alert_type: ALERT_TYPE,
            threshold_value: TRIP_WINDOW_THRESHOLD,
            is_active: true,
          });
          activeAlertByKey.set(key, { id: 'pending', is_active: true });
        } else if (!existing.is_active) {
          deactivateIds.push(existing.id); // will re-activate below
        }
      } else if (existing && existing.is_active) {
        deactivateIds.push(existing.id);
      }
    }

    let inserted = 0;
    if (inserts.length > 0) {
      const { error: insertError, data: insertedRows } = await supabase
        .from('user_alerts')
        .insert(inserts)
        .select('id');
      if (insertError) throw new Error(insertError.message);
      inserted = insertedRows?.length ?? 0;
    }

    let deactivated = 0;
    if (deactivateIds.length > 0) {
      const { error: updateError, count } = await supabase
        .from('user_alerts')
        .update({ is_active: false }, { count: 'exact' })
        .in('id', deactivateIds);
      if (updateError) throw new Error(updateError.message);
      deactivated = count ?? deactivateIds.length;
    }

    const totalTime = Date.now() - startTime;
    console.log(
      `[cron:trip-alerts] ${trips.length} trips in window, inserted ${inserted}, deactivated ${deactivated} in ${totalTime}ms`
    );

    return NextResponse.json({
      success: true,
      cron: 'trip-alerts',
      trips_in_window: trips.length,
      inserted,
      deactivated,
      duration_ms: totalTime,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in trip-alerts cron:', error);
    return NextResponse.json(
      { success: false, error: message, duration_ms: Date.now() - startTime },
      { status: 500 }
    );
  }
}
