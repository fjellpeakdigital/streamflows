import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_PATCH_FIELDS = [
  'fished_at',
  'conditions_rating',
  'flow_confirmed',
  'species_caught',
  'flies_working',
  'notes',
  'is_public',
  'client_name',
  'party_size',
  'trip_id',
  'flow_at_log',
  'temp_at_log',
] as const;

function parseNumeric(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseIntOrNull(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// Strip fields a public viewer shouldn't see. A guide's client name /
// party size never leaves their own account even if the entry is_public.
function redactForPublic<T extends Record<string, unknown>>(row: T): T {
  return {
    ...row,
    client_name: null,
    party_size: null,
    trip_id: null,
  };
}

// GET /api/checkins
//   ?river_id=xxx          — scope to one river (public feed on river detail)
//   ?mine=1                — only the current user's entries (journal timeline)
//   ?from=YYYY-MM-DD&to=…  — date range on fished_at
//   ?rating=good           — filter by conditions_rating
//   ?client=moser          — filter by exact client_name match (case-insensitive)
//   ?limit=50              — cap results (default 50, max 200)
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const river_id = searchParams.get('river_id');
    const mine     = searchParams.get('mine') === '1' || searchParams.get('mine') === 'true';
    const from     = searchParams.get('from');
    const to       = searchParams.get('to');
    const rating   = searchParams.get('rating');
    const client   = searchParams.get('client')?.trim();
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

    const { data: { user } } = await supabase.auth.getUser();

    // `mine=1` requires a logged-in user. The river-scoped public feed does not.
    if (mine && !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = supabase
      .from('river_checkins')
      .select('*')
      .order('fished_at', { ascending: false })
      .limit(limit);

    if (river_id) query = query.eq('river_id', river_id);

    if (mine) {
      query = query.eq('user_id', user!.id);
    } else if (user) {
      // Public OR owned by this user
      query = query.or(`is_public.eq.true,user_id.eq.${user.id}`);
    } else {
      query = query.eq('is_public', true);
    }

    if (from)   query = query.gte('fished_at', from);
    if (to)     query = query.lte('fished_at', to);
    if (rating) query = query.eq('conditions_rating', rating);
    if (client) query = query.ilike('client_name', `%${client}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const checkins = (data ?? []).map((c) => {
      const is_own = user?.id === c.user_id;
      const base = {
        ...c,
        is_own,
        display_name: is_own ? 'You' : 'Angler',
      };
      return is_own ? base : redactForPublic(base);
    });

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
      conditions_rating = null,
      species_caught = null,
      flies_working = null,
      notes = null,
      is_public = false,
      fished_at,
      client_name = null,
      trip_id = null,
    } = body;

    if (!river_id) {
      return NextResponse.json({ error: 'river_id is required' }, { status: 400 });
    }

    const party_size  = parseIntOrNull(body?.party_size);
    const flow_at_log = parseNumeric(body?.flow_at_log);
    const temp_at_log = parseNumeric(body?.temp_at_log);

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
        client_name: client_name?.trim() ? client_name.trim() : null,
        party_size: party_size ?? null,
        trip_id,
        flow_at_log: flow_at_log ?? null,
        temp_at_log: temp_at_log ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ...data, is_own: true, display_name: 'You' });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/checkins  body: { id, ...fields }
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...rest } = body ?? {};

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_PATCH_FIELDS) {
      if (!(key in rest)) continue;
      const raw = rest[key];
      if (key === 'party_size') {
        updates[key] = parseIntOrNull(raw) ?? null;
      } else if (key === 'flow_at_log' || key === 'temp_at_log') {
        updates[key] = parseNumeric(raw) ?? null;
      } else if (key === 'client_name') {
        updates[key] = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
      } else {
        updates[key] = raw;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'no updatable fields provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('river_checkins')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
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
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
