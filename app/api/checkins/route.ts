import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/checkins?river_id=xxx&limit=10
// Returns recent public check-ins for a river, plus the current user's own
// check-ins (even if private).
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const river_id = searchParams.get('river_id');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50);

    if (!river_id) {
      return NextResponse.json({ error: 'river_id is required' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Fetch public check-ins + the current user's private ones (if logged in)
    let query = supabase
      .from('river_checkins')
      .select('*')
      .eq('river_id', river_id)
      .order('fished_at', { ascending: false })
      .limit(limit);

    if (user) {
      // Public OR owned by this user
      query = query.or(`is_public.eq.true,user_id.eq.${user.id}`);
    } else {
      query = query.eq('is_public', true);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Attach a display name: first part of the email, anonymised for other users
    const checkins = (data ?? []).map((c) => ({
      ...c,
      is_own: user?.id === c.user_id,
      // We don't expose other users' emails — just a short anon label
      display_name: user?.id === c.user_id ? 'You' : 'Angler',
    }));

    return NextResponse.json(checkins);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/checkins
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      river_id,
      flow_confirmed = 'unsure',
      conditions_rating,
      species_caught = null,
      flies_working = null,
      notes = null,
      is_public = true,
      fished_at,
    } = body;

    if (!river_id || !conditions_rating) {
      return NextResponse.json(
        { error: 'river_id and conditions_rating are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('river_checkins')
      .insert({
        river_id,
        user_id: user.id,
        flow_confirmed,
        conditions_rating,
        species_caught,
        flies_working: flies_working || null,
        notes: notes || null,
        is_public,
        fished_at: fished_at ?? new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ...data, is_own: true, display_name: 'You' });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/checkins  body: { id }
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();

    const { error } = await supabase
      .from('river_checkins')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // ensure ownership

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
