import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isHatchActive } from '@/app/dashboard/page';
import { BookOpenText } from 'lucide-react';

export const dynamic = 'force-dynamic';

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function fmtMonthDay(month: number | null, day: number | null): string | null {
  if (month == null || day == null) return null;
  return `${MONTH_SHORT[month - 1]} ${day}`;
}

interface HatchRow {
  id: string;
  river_id: string;
  user_id: string | null;
  insect: string;
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
  peak_start_month: number | null;
  peak_start_day: number | null;
  peak_end_month: number | null;
  peak_end_day: number | null;
  notes: string | null;
  temp_trigger: number | null;
}

export default async function HatchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: rosterRows } = await supabase
    .from('user_roster')
    .select('sort_order, rivers(id, name, slug)')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('sort_order', { ascending: true });

  const rosterRivers = (rosterRows ?? [])
    .map((r: any) => r.rivers)
    .filter((r: any): r is { id: string; name: string; slug: string } => !!r);

  const riverIds = rosterRivers.map((r) => r.id);

  let hatchesByRiver = new Map<string, HatchRow[]>();
  if (riverIds.length > 0) {
    const { data: hatches } = await supabase
      .from('hatch_events')
      .select('*')
      .in('river_id', riverIds)
      .order('start_month', { ascending: true })
      .order('start_day', { ascending: true });

    for (const h of (hatches ?? []) as HatchRow[]) {
      const arr = hatchesByRiver.get(h.river_id) ?? [];
      arr.push(h);
      hatchesByRiver.set(h.river_id, arr);
    }
  }

  const today = new Date();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6 flex items-center gap-2">
        <BookOpenText className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Hatch Calendar</h1>
      </div>

      {rosterRivers.length === 0 ? (
        <div className="bg-card border border-border rounded-xl px-4 py-10 text-center">
          <p className="text-sm font-medium mb-1">No rivers on your roster yet.</p>
          <p className="text-xs text-muted-foreground">
            <Link href="/rivers" className="text-primary hover:underline">
              Add rivers
            </Link>{' '}
            to see their hatches here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {rosterRivers.map((river) => {
            const hatches = hatchesByRiver.get(river.id) ?? [];
            return (
              <section key={river.id}>
                <div className="flex items-center justify-between mb-2">
                  <Link
                    href={`/rivers/${river.slug}`}
                    className="text-base font-semibold text-foreground hover:underline"
                  >
                    {river.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {hatches.length} hatch{hatches.length !== 1 ? 'es' : ''}
                  </span>
                </div>

                {hatches.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl px-4 py-6 text-center">
                    <p className="text-sm text-muted-foreground mb-1">No hatches recorded.</p>
                    <p className="text-xs text-muted-foreground">
                      Add hatches from the{' '}
                      <Link
                        href={`/rivers/${river.slug}`}
                        className="text-primary hover:underline"
                      >
                        river detail page
                      </Link>
                      .
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {hatches.map((h) => {
                      const active = isHatchActive(h, today);
                      const range = `${fmtMonthDay(h.start_month, h.start_day)} – ${fmtMonthDay(h.end_month, h.end_day)}`;
                      const peakStart = fmtMonthDay(h.peak_start_month, h.peak_start_day);
                      const peakEnd = fmtMonthDay(h.peak_end_month, h.peak_end_day);
                      const peak = peakStart && peakEnd ? `${peakStart} – ${peakEnd}` : null;
                      return (
                        <li
                          key={h.id}
                          className={`rounded-lg border border-border bg-card px-3 py-2 ${active ? 'border-l-4 border-l-emerald-500' : ''}`}
                        >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm">{h.insect}</span>
                                <span className="text-xs text-muted-foreground">{range}</span>
                                {active && (
                                  <span className="inline-flex items-center rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-semibold px-1.5 py-0">
                                    Active now
                                  </span>
                                )}
                                {h.user_id && (
                                  <span className="inline-flex items-center rounded-md bg-secondary text-muted-foreground text-[10px] font-medium px-1.5 py-0">
                                    Custom
                                  </span>
                                )}
                              </div>
                              {peak && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Peak: {peak}
                                </p>
                              )}
                              {h.temp_trigger != null && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  ~{h.temp_trigger}°F trigger
                                </p>
                              )}
                              {h.notes && (
                                <p className="text-xs text-foreground/80 mt-1 leading-snug">
                                  {h.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
