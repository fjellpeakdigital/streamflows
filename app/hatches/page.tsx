import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCachedUser } from '@/app/layout';
import { HatchesClient } from './hatches-client';
import type { HatchEvent } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export interface WorkbenchRiver {
  id: string;
  name: string;
  slug: string;
  region: string | null;
}

export default async function HatchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await getCachedUser();

  if (!user) redirect('/login');

  const { data: rosterRows } = await supabase
    .from('user_roster')
    .select('sort_order, rivers(id, name, slug, region)')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('sort_order', { ascending: true });

  type RosterRow = {
    sort_order: number;
    rivers: {
      id: string;
      name: string;
      slug: string;
      region: string | null;
    } | null;
  };

  const rosterRivers: WorkbenchRiver[] = ((rosterRows ?? []) as unknown as RosterRow[])
    .map((r) => r.rivers)
    .filter((r): r is NonNullable<RosterRow['rivers']> => r !== null);

  const riverIds = rosterRivers.map((r) => r.id);

  let hatches: HatchEvent[] = [];
  if (riverIds.length > 0) {
    // RLS ensures we get seed rows (user_id IS NULL) + the current user's rows
    const { data } = await supabase
      .from('hatch_events')
      .select('*')
      .in('river_id', riverIds)
      .order('start_month', { ascending: true })
      .order('start_day', { ascending: true });

    hatches = (data ?? []) as HatchEvent[];
  }

  return <HatchesClient rivers={rosterRivers} hatches={hatches} />;
}
