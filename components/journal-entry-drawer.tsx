'use client';

import { useEffect, useRef, useState } from 'react';
import { Droplets, Fish, Trash2, Users, Wind, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { FishingRating, FlowAccuracy } from '@/lib/types/database';
import type { JournalEntry, JournalRiver } from '@/app/journal/page';

interface JournalEntryDrawerProps {
  rivers: JournalRiver[];
  /** Null = create mode, otherwise edit an existing entry */
  entry: JournalEntry | null;
  onClose: () => void;
  onSaved: (entry: JournalEntry) => void;
  onDeleted: (id: string) => void;
}

type EntryMode = 'trip' | 'scout';

const RATING_OPTIONS: { value: FishingRating; label: string; color: string }[] = [
  { value: 'poor',      label: 'Poor',      color: 'border-red-300    bg-red-50    text-red-700    data-[selected=true]:bg-red-100    data-[selected=true]:border-red-500' },
  { value: 'fair',      label: 'Fair',      color: 'border-amber-300  bg-amber-50  text-amber-700  data-[selected=true]:bg-amber-100  data-[selected=true]:border-amber-500' },
  { value: 'good',      label: 'Good',      color: 'border-emerald-300 bg-emerald-50 text-emerald-700 data-[selected=true]:bg-emerald-100 data-[selected=true]:border-emerald-500' },
  { value: 'excellent', label: 'Excellent', color: 'border-primary/40 bg-primary/5  text-primary    data-[selected=true]:bg-primary/10  data-[selected=true]:border-primary' },
];

const FLOW_OPTIONS: { value: FlowAccuracy; label: string }[] = [
  { value: 'accurate',   label: 'Gauge matched'      },
  { value: 'inaccurate', label: 'Gauge felt off'     },
  { value: 'unsure',     label: "Didn't check"       },
];

const COMMON_SPECIES = [
  'Brown Trout',
  'Rainbow Trout',
  'Brook Trout',
  'Atlantic Salmon',
  'Smallmouth Bass',
  'Largemouth Bass',
  'Pike',
];

function toDateInput(iso: string): string {
  // "2026-04-14T12:00:00.000Z" → "2026-04-14" (local day)
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function JournalEntryDrawer({
  rivers,
  entry,
  onClose,
  onSaved,
  onDeleted,
}: JournalEntryDrawerProps) {
  const isEdit = entry !== null;
  const today = toDateInput(new Date().toISOString());

  const initialRiverId = entry?.river_id ?? rivers[0]?.id ?? '';

  const [riverId,      setRiverId]      = useState<string>(initialRiverId);
  const [fishedAt,     setFishedAt]     = useState<string>(entry ? toDateInput(entry.fished_at) : today);
  const [mode,         setMode]         = useState<EntryMode>(entry?.conditions_rating === null ? 'scout' : 'trip');
  const [rating,       setRating]       = useState<FishingRating | null>(entry?.conditions_rating ?? null);
  const [flowAccuracy, setFlowAccuracy] = useState<FlowAccuracy>(entry?.flow_confirmed ?? 'unsure');
  const [clientName,   setClientName]   = useState<string>(entry?.client_name ?? '');
  const [partySize,    setPartySize]    = useState<string>(
    entry?.party_size != null ? String(entry.party_size) : ''
  );
  const [species,      setSpecies]      = useState<string[]>(entry?.species_caught ?? []);
  const [customSpecies, setCustomSpecies] = useState<string>('');
  const [flies,        setFlies]        = useState<string>(entry?.flies_working ?? '');
  const [notes,        setNotes]        = useState<string>(entry?.notes ?? '');
  const [isPublic,     setIsPublic]     = useState<boolean>(entry?.is_public ?? false);

  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const firstFieldRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const selectedRiver = rivers.find((r) => r.id === riverId) ?? null;

  const toggleSpecies = (s: string) =>
    setSpecies((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const addCustomSpecies = () => {
    const trimmed = customSpecies.trim();
    if (trimmed && !species.includes(trimmed)) {
      setSpecies((prev) => [...prev, trimmed]);
    }
    setCustomSpecies('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!riverId) {
      setError('Pick a river.');
      return;
    }
    if (mode === 'trip' && !rating) {
      setError('Pick a fishing rating, or switch to a scouting entry.');
      return;
    }

    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        river_id: riverId,
        fished_at: new Date(fishedAt + 'T12:00:00').toISOString(),
        conditions_rating: mode === 'trip' ? rating : null,
        flow_confirmed: flowAccuracy,
        species_caught: species.length > 0 ? species : null,
        flies_working: flies.trim() || null,
        notes: notes.trim() || null,
        is_public: isPublic,
        client_name: clientName.trim() || null,
        party_size: partySize.trim() === '' ? null : Number(partySize),
      };

      if (!isEdit) {
        // On create, snapshot the current flow/temp from the selected roster river
        payload.flow_at_log = selectedRiver?.latest_flow ?? null;
        payload.temp_at_log = selectedRiver?.latest_temp ?? null;
      }

      const res = await fetch('/api/checkins', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: entry!.id, ...payload } : payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error ?? 'Failed to save entry.');
        return;
      }

      const saved = await res.json();

      // The API returns the raw row; stitch the river relation back on so
      // the timeline can render without a reload.
      const river = rivers.find((r) => r.id === saved.river_id) ?? null;
      onSaved({
        ...(saved as JournalEntry),
        river: river
          ? { name: river.name, slug: river.slug, region: river.region }
          : entry?.river ?? null,
      });
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entry) return;
    if (!confirm('Delete this journal entry? This cannot be undone.')) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/checkins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error ?? 'Failed to delete entry.');
        return;
      }
      onDeleted(entry.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex md:items-stretch md:justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 animate-backdrop-in"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit journal entry' : 'New journal entry'}
        className="relative ml-auto w-full md:max-w-lg bg-white md:shadow-xl overflow-y-auto flex flex-col animate-drawer-in-right"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-border px-5 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {isEdit ? 'Edit entry' : 'New journal entry'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 p-5 space-y-5">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* River + Date */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">River</label>
              <select
                ref={firstFieldRef}
                value={riverId}
                onChange={(e) => setRiverId(e.target.value)}
                disabled={isEdit}
                className="w-full h-10 rounded-md border border-border bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-60"
              >
                {rivers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {isEdit && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  River can&apos;t be changed after saving.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Date</label>
              <Input
                type="date"
                value={fishedAt}
                max={today}
                onChange={(e) => setFishedAt(e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          {/* Mode: trip vs scout */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Entry type</label>
            <div className="inline-flex rounded-md border border-border bg-white overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setMode('trip')}
                className={cn(
                  'px-3 py-1.5 transition-colors',
                  mode === 'trip' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-secondary'
                )}
              >
                Trip
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('scout');
                  setRating(null);
                }}
                className={cn(
                  'px-3 py-1.5 transition-colors',
                  mode === 'scout' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-secondary'
                )}
              >
                Scouting
              </button>
            </div>
          </div>

          {/* Rating (trip only) */}
          {mode === 'trip' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                <Fish className="inline h-3.5 w-3.5 mr-1 opacity-70" />
                How was the fishing?
              </label>
              <div className="grid grid-cols-4 gap-2">
                {RATING_OPTIONS.map(({ value, label, color }) => (
                  <button
                    key={value}
                    type="button"
                    data-selected={rating === value}
                    onClick={() => setRating(value)}
                    className={`text-sm font-medium py-2 rounded-lg border-2 transition-colors ${color}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Client */}
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                <Users className="inline h-3.5 w-3.5 mr-1 opacity-70" />
                Client / party name <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Moser party, Walk-in, Rob S."
                className="h-10 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Party size</label>
              <Input
                type="number"
                min={0}
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
                placeholder="–"
                className="h-10 text-sm"
              />
            </div>
          </div>

          {/* Flow accuracy */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <Droplets className="inline h-3.5 w-3.5 mr-1 opacity-70" />
              Gauge vs. what you saw
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FLOW_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFlowAccuracy(value)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-colors',
                    flowAccuracy === value
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-white text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Species */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Species <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_SPECIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSpecies(s)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-colors',
                    species.includes(s)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-muted-foreground border-border hover:border-primary/50'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Other species…"
                value={customSpecies}
                onChange={(e) => setCustomSpecies(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomSpecies();
                  }
                }}
                className="h-9 text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustomSpecies} className="h-9">
                Add
              </Button>
            </div>
            {species.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {species.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => toggleSpecies(s)}
                      className="hover:text-primary/70"
                      aria-label={`Remove ${s}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Flies */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              <Wind className="inline h-3.5 w-3.5 mr-1 opacity-70" />
              Flies / patterns <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              value={flies}
              onChange={(e) => setFlies(e.target.value)}
              placeholder="#18 parachute BWO, #16 pheasant tail dropper, dead drift through the seam…"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Hatches, water clarity, client behavior, access observations…"
              rows={4}
              className="text-sm resize-none"
            />
          </div>

          {/* Visibility */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="accent-primary h-4 w-4 mt-0.5"
            />
            <span className="text-sm">
              Share publicly
              <span className="block text-xs text-muted-foreground font-normal">
                Other anglers see the rating, flies, and notes. Client name and party
                size stay private either way.
              </span>
            </span>
          </label>
        </form>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-white border-t border-border px-5 py-3 flex items-center gap-2">
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving || deleting}>
              Cancel
            </Button>
            <Button type="submit" onClick={handleSubmit} disabled={saving || deleting}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save entry'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
