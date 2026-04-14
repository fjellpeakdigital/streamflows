import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_UPDATE_FIELDS = [
  'trip_date',
  'client_count',
  'client_notes',
  'target_river_id',
  'backup_river_id',
  'status',
  'post_trip_notes',
  'flow_at_trip',
  'temp_at_trip',
] as const;

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('trips')
      .select(
        'id, user_id, trip_date, client_count, client_notes, target_river_id, backup_river_id, status, post_trip_notes, flow_at_trip, temp_at_trip, created_at, updated_at, target_river:rivers!trips_target_river_id_fkey(name, slug), backup_river:rivers!trips_backup_river_id_fkey(name, slug)'
      )
      .eq('user_id', user.id)
      .order('trip_date', { ascending: false });

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
    const { supabase, user } = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      trip_date,
      client_count,
      client_notes,
      target_river_id,
      backup_river_id,
      status,
    } = body ?? {};

    if (!trip_date || !target_river_id) {
      return NextResponse.json(
        { error: 'trip_date and target_river_id are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('trips')
      .insert({
        user_id: user.id,
        trip_date,
        client_count: client_count ?? 0,
        client_notes: client_notes ?? null,
        target_river_id,
        backup_river_id: backup_river_id ?? null,
        status: status ?? 'upcoming',
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
    const { supabase, user } = await getUser();
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
      .from('trips')
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
    const { supabase, user } = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('trips')
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
