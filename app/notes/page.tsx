import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { formatFlow, formatTemperature } from '@/lib/river-utils';
import { StickyNote } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface NoteRow {
  id: string;
  river_id: string;
  note: string;
  flow_at_save: number | null;
  temp_at_save: number | null;
  updated_at: string;
  created_at: string;
  rivers: { name: string; slug: string } | null;
}

export default async function NotesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data } = await supabase
    .from('user_notes')
    .select(
      'id, river_id, note, flow_at_save, temp_at_save, updated_at, created_at, rivers(name, slug)'
    )
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  const notes = ((data ?? []) as unknown as NoteRow[]).filter(
    (n) => n.note && n.note.trim().length > 0
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6 flex items-center gap-2">
        <StickyNote className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Client Notes</h1>
      </div>

      {notes.length === 0 ? (
        <div className="bg-card border border-border rounded-xl px-4 py-10 text-center">
          <p className="text-sm font-medium mb-1">No notes yet.</p>
          <p className="text-xs text-muted-foreground">
            Open a river and use the Notes panel to capture what&apos;s working.{' '}
            <Link href="/rivers" className="text-primary hover:underline">
              Browse rivers
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => {
            const river = n.rivers;
            const snapshotParts = [
              n.flow_at_save != null ? formatFlow(n.flow_at_save) : null,
              n.temp_at_save != null ? formatTemperature(n.temp_at_save) : null,
            ].filter(Boolean);
            return (
              <li
                key={n.id}
                className="bg-white border border-border rounded-xl p-4"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-2">
                  <div className="min-w-0">
                    {river ? (
                      <Link
                        href={`/rivers/${river.slug}`}
                        className="font-semibold text-sm text-foreground hover:underline"
                      >
                        {river.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-sm text-muted-foreground">
                        Unknown river
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(n.updated_at), 'MMM d, yyyy')}
                  </span>
                </div>

                {snapshotParts.length > 0 && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {snapshotParts.join(' · ')}
                  </p>
                )}

                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {n.note}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
