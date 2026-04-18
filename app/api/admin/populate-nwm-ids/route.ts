import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { resolveNWMReachId } from '@/lib/nwm-forecast';

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

  const limitParam = Number(searchParams.get('limit') ?? '0');
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 0;

  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('rivers')
      .select('id, name, usgs_station_id')
      .is('nwm_reach_id', null);
    if (limit > 0) query = query.limit(limit);

    const { data: rivers, error } = await query;
    if (error) throw new Error(error.message);

    let populated = 0;
    let notFound = 0;
    const notFoundSamples: string[] = [];

    for (const river of rivers ?? []) {
      if (!river.usgs_station_id) {
        notFound++;
        continue;
      }

      const reachId = await resolveNWMReachId(river.usgs_station_id);
      if (!reachId) {
        notFound++;
        if (notFoundSamples.length < 20) notFoundSamples.push(river.name);
        continue;
      }

      const { error: updateError } = await supabase
        .from('rivers')
        .update({ nwm_reach_id: reachId })
        .eq('id', river.id);

      if (updateError) {
        notFound++;
        continue;
      }
      populated++;
    }

    const totalTime = Date.now() - startTime;
    console.log(
      `[admin:populate-nwm-ids] processed ${rivers?.length ?? 0}, populated ${populated}, not found ${notFound} in ${totalTime}ms`
    );

    return NextResponse.json({
      success: true,
      scanned: rivers?.length ?? 0,
      populated,
      not_found: notFound,
      not_found_samples: notFoundSamples,
      duration_ms: totalTime,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in populate-nwm-ids:', error);
    return NextResponse.json(
      { success: false, error: message, duration_ms: Date.now() - startTime },
      { status: 500 }
    );
  }
}
