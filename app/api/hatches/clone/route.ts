import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST /api/hatches/clone  body: { source_hatch_id }
// Reads a seed hatch (user_id IS NULL) and inserts a user-owned copy with
// source_hatch_id set so we can badge "customized from default" and offer
// a "reset to seed" action later.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { source_hatch_id } = await request.json().catch(() => ({}));

    if (!source_hatch_id) {
      return NextResponse.json({ error: 'source_hatch_id is required' }, { status: 400 });
    }

    // RLS: seed rows (user_id IS NULL) are readable by everyone, so no extra
    // filter needed beyond the id lookup. Guard against cloning someone else's
    // custom row by confirming the source is in fact a seed.
    const { data: source, error: readError } = await supabase
      .from('hatch_events')
      .select('*')
      .eq('id', source_hatch_id)
      .is('user_id', null)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 400 });
    }
    if (!source) {
      return NextResponse.json({ error: 'Seed hatch not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('hatch_events')
      .insert({
        user_id: user.id,
        river_id: source.river_id,
        insect: source.insect,
        start_month: source.start_month,
        start_day: source.start_day,
        end_month: source.end_month,
        end_day: source.end_day,
        peak_start_month: source.peak_start_month ?? null,
        peak_start_day: source.peak_start_day ?? null,
        peak_end_month: source.peak_end_month ?? null,
        peak_end_day: source.peak_end_day ?? null,
        notes: source.notes ?? null,
        temp_trigger: source.temp_trigger ?? null,
        fly_patterns: source.fly_patterns ?? null,
        stage: source.stage ?? null,
        time_of_day: source.time_of_day ?? null,
        source_hatch_id: source.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
