import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_UPDATE_FIELDS = [
  'insect',
  'start_month',
  'start_day',
  'end_month',
  'end_day',
  'peak_start_month',
  'peak_start_day',
  'peak_end_month',
  'peak_end_day',
  'notes',
  'temp_trigger',
  'fly_patterns',
  'stage',
  'time_of_day',
] as const;

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getContext();
    const { searchParams } = new URL(request.url);
    const riverId = searchParams.get('river_id');

    if (!riverId) {
      return NextResponse.json({ error: 'river_id is required' }, { status: 400 });
    }

    let query = supabase.from('hatch_events').select('*').eq('river_id', riverId);

    query = user
      ? query.or(`user_id.is.null,user_id.eq.${user.id}`)
      : query.is('user_id', null);

    const { data, error } = await query.order('start_month', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getContext();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      river_id,
      insect,
      start_month,
      start_day,
      end_month,
      end_day,
      peak_start_month,
      peak_start_day,
      peak_end_month,
      peak_end_day,
      notes,
      temp_trigger,
      fly_patterns,
      stage,
      time_of_day,
      source_hatch_id,
    } = body ?? {};

    if (
      !river_id ||
      !insect ||
      start_month == null ||
      start_day == null ||
      end_month == null ||
      end_day == null
    ) {
      return NextResponse.json(
        {
          error:
            'river_id, insect, start_month, start_day, end_month, end_day are required',
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('hatch_events')
      .insert({
        user_id: user.id,
        river_id,
        insect,
        start_month,
        start_day,
        end_month,
        end_day,
        peak_start_month: peak_start_month ?? null,
        peak_start_day: peak_start_day ?? null,
        peak_end_month: peak_end_month ?? null,
        peak_end_day: peak_end_day ?? null,
        notes: notes ?? null,
        temp_trigger: temp_trigger ?? null,
        fly_patterns: fly_patterns ?? null,
        stage: stage ?? null,
        time_of_day: time_of_day ?? null,
        source_hatch_id: source_hatch_id ?? null,
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

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await getContext();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...rest } = body ?? {};

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (key in rest) updates[key] = rest[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'no updatable fields provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('hatch_events')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
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

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await getContext();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('hatch_events')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
