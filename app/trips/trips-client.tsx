'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { getStatusDotColor } from '@/lib/river-utils';
import { cn } from '@/lib/utils';
import { CalendarDays, Plus, Users, Trash2, X } from 'lucide-react';
import type { TripRow, RosterRiverOption } from './page';

type TripStatus = 'upcoming' | 'completed' | 'cancelled';

interface FormState {
  id?: string;
  trip_date: string;
  client_count: number;
  target_river_id: string;
  backup_river_id: string;
  status: TripStatus;
  post_trip_notes: string;
}

const emptyForm = (): FormState => ({
  trip_date: new Date().toISOString().slice(0, 10),
  client_count: 1,
  target_river_id: '',
  backup_river_id: '',
  status: 'upcoming',
  post_trip_notes: '',
});

function statusBadgeClass(status: TripStatus): string {
  switch (status) {
    case 'upcoming':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'completed':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'cancelled':
      return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  }
}

export function TripsClient({
  trips,
  rosterOptions,
}: {
  trips: TripRow[];
  rosterOptions: RosterRiverOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const riverId = searchParams.get('river_id');
    if (!riverId) return;
    setForm({ ...emptyForm(), target_river_id: riverId });
    setFormOpen(true);
    router.replace('/trips');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusByRiverId = useMemo(() => {
    const m = new Map<string, RosterRiverOption>();
    for (const r of rosterOptions) m.set(r.id, r);
    return m;
  }, [rosterOptions]);

  const today = startOfDay(new Date());
  const upcoming = trips.filter(
    (t) => t.status === 'upcoming' && !isBefore(parseISO(t.trip_date), today)
  );
  const past = trips.filter((t) => !upcoming.includes(t));

  const openNew = () => {
    setForm(emptyForm());
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (trip: TripRow) => {
    setForm({
      id: trip.id,
      trip_date: trip.trip_date,
      client_count: trip.client_count,
      target_river_id: trip.target_river_id,
      backup_river_id: trip.backup_river_id ?? '',
      status: trip.status,
      post_trip_notes: trip.post_trip_notes ?? '',
    });
    setError(null);
    setFormOpen(true);
  };

  const close = () => {
    setFormOpen(false);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.target_river_id) {
      setError('Target river is required.');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      id: form.id,
      trip_date: form.trip_date,
      client_count: form.client_count,
      target_river_id: form.target_river_id,
      backup_river_id: form.backup_river_id || null,
      status: form.status,
      post_trip_notes: form.post_trip_notes || null,
    };

    const res = await fetch('/api/trips', {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? 'Failed to save trip');
      return;
    }

    close();
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this trip?')) return;
    const res = await fetch('/api/trips', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) router.refresh();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Trips</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Plan upcoming trips and log post-trip notes.
          </p>
        </div>
        <Button onClick={openNew} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          New Trip
        </Button>
      </div>

      {formOpen && (
        <form
          onSubmit={submit}
          className="mb-6 bg-card border border-border rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{form.id ? 'Edit Trip' : 'New Trip'}</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Date</span>
              <Input
                type="date"
                value={form.trip_date}
                onChange={(e) => setForm((f) => ({ ...f, trip_date: e.target.value }))}
                required
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Clients</span>
              <Input
                type="number"
                min={0}
                value={form.client_count}
                onChange={(e) =>
                  setForm((f) => ({ ...f, client_count: Number(e.target.value) || 0 }))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Target river</span>
              <Select
                value={form.target_river_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, target_river_id: e.target.value }))
                }
                required
              >
                <option value="">Select a river…</option>
                {rosterOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Backup river (optional)</span>
              <Select
                value={form.backup_river_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, backup_river_id: e.target.value }))
                }
              >
                <option value="">None</option>
                {rosterOptions
                  .filter((r) => r.id !== form.target_river_id)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </Select>
            </label>

            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="font-medium">Status</span>
              <Select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as TripStatus }))
                }
              >
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </label>

            {form.status === 'completed' && (
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-medium">Post-trip notes</span>
                <Textarea
                  rows={3}
                  value={form.post_trip_notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, post_trip_notes: e.target.value }))
                  }
                  placeholder="How did the day fish?"
                />
              </label>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : form.id ? 'Save' : 'Create Trip'}
            </Button>
          </div>
        </form>
      )}

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl px-4 py-6 text-center">
            No upcoming trips.
          </p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                statusByRiverId={statusByRiverId}
                onEdit={() => openEdit(trip)}
                onDelete={() => remove(trip.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Past
        </h2>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl px-4 py-6 text-center">
            No past trips logged.
          </p>
        ) : (
          <ul className="space-y-2">
            {past.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                statusByRiverId={statusByRiverId}
                onEdit={() => openEdit(trip)}
                onDelete={() => remove(trip.id)}
                showPostTrip
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TripCard({
  trip,
  statusByRiverId,
  onEdit,
  onDelete,
  showPostTrip,
}: {
  trip: TripRow;
  statusByRiverId: Map<string, RosterRiverOption>;
  onEdit: () => void;
  onDelete: () => void;
  showPostTrip?: boolean;
}) {
  const target = statusByRiverId.get(trip.target_river_id);
  const targetName = trip.target_river?.name ?? target?.name ?? 'Unknown river';
  const backupName = trip.backup_river?.name ?? null;

  return (
    <li className="bg-white border border-border rounded-xl p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">
              {format(parseISO(trip.trip_date), 'EEE MMM d, yyyy')}
            </span>
            <Badge
              className={cn(
                'text-xs px-2 py-0 rounded-md font-semibold',
                statusBadgeClass(trip.status)
              )}
            >
              {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
            </Badge>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {trip.client_count} client{trip.client_count !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex flex-col gap-0.5 text-sm">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  target ? getStatusDotColor(target.status) : 'bg-zinc-300'
                )}
                aria-hidden="true"
              />
              <span className="font-medium">{targetName}</span>
            </span>
            {backupName && (
              <span className="text-xs text-muted-foreground pl-4">
                Backup: {backupName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label="Delete trip"
            className="text-muted-foreground hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showPostTrip && (
        <div className="mt-3 pt-3 border-t border-border">
          {trip.post_trip_notes ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {trip.post_trip_notes}
            </p>
          ) : (
            <Button variant="outline" size="sm" onClick={onEdit}>
              Add notes
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
