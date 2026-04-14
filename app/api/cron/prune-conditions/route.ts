import { createClient as createServiceClient } from '@supabase/supabase-js';
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

    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const { error, count } = await supabase
      .from('conditions')
      .delete({ count: 'exact' })
      .lt('timestamp', cutoff);

    if (error) {
      throw new Error(error.message);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[cron:prune] Deleted ${count ?? 0} conditions older than ${cutoff} in ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      cron: 'prune-conditions',
      cutoff,
      deleted: count ?? 0,
      duration_ms: totalTime,
    });
  } catch (error: any) {
    console.error('Error in prune-conditions cron:', error);
    return NextResponse.json(
      { success: false, error: error.message, duration_ms: Date.now() - startTime },
      { status: 500 }
    );
  }
}
