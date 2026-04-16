import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCachedUser } from '@/app/layout';
import { JournalClient } from './journal-client';
import type { CheckIn } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export interface JournalRiver {
  id: string;
  name: string;
  slug: string;
  region: string | null;
  optimal_flow_min: number | null;
  optimal_flow_max: number | null;
  /** Most recent flow (CFS) if we have one in the last 3h */
  latest_flow: number | null;
  /** Most recent water temp (°F) if we have one in the last 3h */
  latest_temp: number | null;
}

export interface JournalEntry extends CheckIn {
  river: { name: string; slug: string; region: string | null } | null;
}

export interface PinnedNote {
  id: string;
  river_id: string;
  note: string;
  flow_at_save: number | null;
  temp_at_save: number | null;
  updated_at: string;
  river: { name: string; slug: string } | null;
}

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: { user } } = await getCachedUser();

  if (!user) redirect('/login');

  // 1. Roster rivers — populate filter dropdown + drawer picker
  const { data: rosterRows } = await supabase
    .from('user_roster')
    .select(
      'river_id, rivers(id, name, slug, region, optimal_flow_min, optimal_flow_max)'
    )
    .eq('user_id', user.id)
    .eq('archived', false);

  type RosterRow = {
    river_id: string;
    rivers: {
      id: string;
      name: string;
      slug: string;
      region: string | null;
      optimal_flow_min: number | null;
      optimal_flow_max: number | null;
    } | null;
  };

  const rosterIds = (rosterRows ?? []).map((r) => r.river_id);

  // 2. Most recent condition per roster river (for auto-snapshot on new entries)
  const threeHoursAgo = new Date();
  threeHoursAgo.setHours(threeHoursAgo.getHours() - 3);

  const latestByRiver = new Map<string, { flow: number | null; temp: number | null }>();
  if (rosterIds.length > 0) {
    const { data: condRows } = await supabase
      .from('conditions')
      .select('river_id, flow, temperature, timestamp')
      .in('river_id', rosterIds)
      .gte('timestamp', threeHoursAgo.toISOString())
      .order('timestamp', { ascending: false });

    for (const row of condRows ?? []) {
      if (!latestByRiver.has(row.river_id)) {
        latestByRiver.set(row.river_id, { flow: row.flow, temp: row.temperature });
      }
    }
  }

  const rosterRivers: JournalRiver[] = ((rosterRows ?? []) as unknown as RosterRow[])
    .map((row) => row.rivers)
    .filter((r): r is NonNullable<RosterRow['rivers']> => r !== null)
    .map((r) => {
      const snap = latestByRiver.get(r.id);
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        region: r.region,
        optimal_flow_min: r.optimal_flow_min,
        optimal_flow_max: r.optimal_flow_max,
        latest_flow: snap?.flow ?? null,
        latest_temp: snap?.temp ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // 3. Journal entries (user's own check-ins, all rivers)
  const { data: entryRows } = await supabase
    .from('river_checkins')
    .select('*, rivers(name, slug, region)')
    .eq('user_id', user.id)
    .order('fished_at', { ascending: false })
    .limit(200);

  type EntryRow = CheckIn & {
    rivers: { name: string; slug: string; region: string | null } | null;
  };

  const entries: JournalEntry[] = ((entryRows ?? []) as unknown as EntryRow[]).map(
    ({ rivers, ...rest }) => ({ ...rest, river: rivers })
  );

  // 4. Pinned per-river notes (user_notes — the sticky memos)
  const { data: noteRows } = await supabase
    .from('user_notes')
    .select(
      'id, river_id, note, flow_at_save, temp_at_save, updated_at, rivers(name, slug)'
    )
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  type NoteRow = Omit<PinnedNote, 'river'> & {
    rivers: { name: string; slug: string } | null;
  };

  const pinnedNotes: PinnedNote[] = ((noteRows ?? []) as unknown as NoteRow[])
    .filter((n) => n.note && n.note.trim().length > 0)
    .map(({ rivers, ...rest }) => ({ ...rest, river: rivers }));

  return (
    <JournalClient
      rivers={rosterRivers}
      entries={entries}
      pinnedNotes={pinnedNotes}
    />
  );
}
