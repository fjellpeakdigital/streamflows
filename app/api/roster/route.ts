import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
      .from('user_roster')
      .select('*, rivers(name, slug)')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });

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
    const { river_id, designation, species, sort_order } = body ?? {};

    if (!river_id) {
      return NextResponse.json({ error: 'river_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_roster')
      .insert({
        user_id: user.id,
        river_id,
        designation: designation ?? null,
        species: species ?? [],
        sort_order: sort_order ?? 0,
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
    const { river_id, ...rest } = body ?? {};

    if (!river_id) {
      return NextResponse.json({ error: 'river_id is required' }, { status: 400 });
    }

    const allowed = [
      'designation',
      'species',
      'optimal_flow_min_override',
      'optimal_flow_max_override',
      'access_notes',
      'sort_order',
      'archived',
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in rest) updates[key] = rest[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'no updatable fields provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_roster')
      .update(updates)
      .eq('user_id', user.id)
      .eq('river_id', river_id)
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

    const { river_id } = await request.json();

    if (!river_id) {
      return NextResponse.json({ error: 'river_id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_roster')
      .delete()
      .eq('user_id', user.id)
      .eq('river_id', river_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
