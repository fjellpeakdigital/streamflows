'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { format, parseISO, startOfDay } from 'date-fns';
import {
  BookText,
  ChevronDown,
  ChevronUp,
  Feather,
  Filter,
  Globe,
  Lock,
  Plus,
  Search,
  StickyNote,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JournalEntryDrawer } from '@/components/journal-entry-drawer';
import { formatFlow, formatTemperature } from '@/lib/river-utils';
import { cn } from '@/lib/utils';
import type { FishingRating } from '@/lib/types/database';
import type { JournalEntry, JournalRiver, PinnedNote } from './page';

interface JournalClientProps {
  rivers: JournalRiver[];
  entries: JournalEntry[];
  pinnedNotes: PinnedNote[];
}

type DatePreset = 'all' | '30d' | '90d' | 'season';
type VisibilityFilter = 'all' | 'public' | 'private';
type RatingFilter = FishingRating | 'scouting' | 'all';

const RATING_CHIPS: { value: RatingFilter; label: string; style: string }[] = [
  { value: 'all',       label: 'Any',       style: 'border-border bg-white text-muted-foreground' },
  { value: 'excellent', label: 'Excellent', style: 'border-primary/40 bg-primary/5 text-primary' },
  { value: 'good',      label: 'Good',      style: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  { value: 'fair',      label: 'Fair',      style: 'border-amber-300 bg-amber-50 text-amber-700' },
  { value: 'poor',      label: 'Poor',      style: 'border-red-300 bg-red-50 text-red-700' },
  { value: 'scouting',  label: 'Scouting',  style: 'border-slate-300 bg-slate-50 text-slate-700' },
];

const RATING_BADGE: Record<FishingRating, { label: string; className: string }> = {
  poor:      { label: 'Poor',      className: 'bg-red-100 text-red-700 border-red-200' },
  fair:      { label: 'Fair',      className: 'bg-amber-100 text-amber-700 border-amber-200' },
  good:      { label: 'Good',      className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  excellent: { label: 'Excellent', className: 'bg-primary/10 text-primary border-primary/20' },
};

const RATING_BORDER: Record<FishingRating, string> = {
  poor:      'border-l-red-400',
  fair:      'border-l-amber-400',
  good:      'border-l-emerald-400',
  excellent: 'border-l-primary',
};

function presetCutoff(preset: DatePreset): Date | null {
  const now = new Date();
  switch (preset) {
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return startOfDay(d);
    }
    case '90d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      return startOfDay(d);
    }
    case 'season': {
      // "This season" = April 1 of current calendar year through today.
      // Crude but useful for northeastern guides; refine later if needed.
      return new Date(now.getFullYear(), 3, 1);
    }
    default:
      return null;
  }
}

export function JournalClient({ rivers, entries, pinnedNotes }: JournalClientProps) {
  const [riverFilter,      setRiverFilter]      = useState<string>('all');
  const [datePreset,       setDatePreset]       = useState<DatePreset>('all');
  const [ratingFilter,     setRatingFilter]     = useState<RatingFilter>('all');
  const [clientFilter,     setClientFilter]     = useState<string>('');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [pinnedOpen,       setPinnedOpen]       = useState<boolean>(true);
  const [filtersOpen,      setFiltersOpen]      = useState<boolean>(false);

  const [drawerState, setDrawerState] = useState<
    | { mode: 'closed' }
    | { mode: 'create' }
    | { mode: 'edit'; entry: JournalEntry }
  >({ mode: 'closed' });

  const [liveEntries, setLiveEntries] = useState<JournalEntry[]>(entries);

  const filteredEntries = useMemo(() => {
    const cutoff = presetCutoff(datePreset);
    const client = clientFilter.trim().toLowerCase();

    return liveEntries.filter((e) => {
      if (riverFilter !== 'all' && e.river_id !== riverFilter) return false;

      if (cutoff && parseISO(e.fished_at) < cutoff) return false;

      if (ratingFilter === 'scouting') {
        if (e.conditions_rating !== null) return false;
      } else if (ratingFilter !== 'all') {
        if (e.conditions_rating !== ratingFilter) return false;
      }

      if (client && !(e.client_name ?? '').toLowerCase().includes(client)) return false;

      if (visibilityFilter === 'public'  && !e.is_public) return false;
      if (visibilityFilter === 'private' &&  e.is_public) return false;

      return true;
    });
  }, [liveEntries, riverFilter, datePreset, ratingFilter, clientFilter, visibilityFilter]);

  // Group entries by local calendar day
  const groups = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const e of filteredEntries) {
      const key = format(parseISO(e.fished_at), 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries()); // already sorted since entries were sorted
  }, [filteredEntries]);

  const hasActiveFilters =
    riverFilter !== 'all' ||
    datePreset !== 'all' ||
    ratingFilter !== 'all' ||
    clientFilter.trim() !== '' ||
    visibilityFilter !== 'all';

  const clearFilters = () => {
    setRiverFilter('all');
    setDatePreset('all');
    setRatingFilter('all');
    setClientFilter('');
    setVisibilityFilter('all');
  };

  const handleSaved = (saved: JournalEntry) => {
    setLiveEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  };

  const handleDeleted = (id: string) => {
    setLiveEntries((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <BookText className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-2xl font-bold leading-tight">Journal</h1>
            <p className="text-xs text-muted-foreground">
              {liveEntries.length} {liveEntries.length === 1 ? 'entry' : 'entries'}
              {hasActiveFilters && ` · ${filteredEntries.length} shown`}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setDrawerState({ mode: 'create' })}
          disabled={rivers.length === 0}
          size="sm"
          className="shrink-0"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New entry
        </Button>
      </div>

      {rivers.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-sm mb-5">
          Add rivers to your roster before logging journal entries.{' '}
          <Link href="/rivers" className="font-semibold underline">
            Browse rivers
          </Link>
          .
        </div>
      )}

      {/* Pinned notes strip */}
      {pinnedNotes.length > 0 && (
        <section className="mb-5 bg-white border border-border rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setPinnedOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-secondary/50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <StickyNote className="h-4 w-4 text-primary" />
              Pinned river notes
              <span className="text-xs font-normal text-muted-foreground">
                ({pinnedNotes.length})
              </span>
            </span>
            {pinnedOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {pinnedOpen && (
            <ul className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
              {pinnedNotes.map((n) => (
                <li
                  key={n.id}
                  className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5"
                >
                  {n.river ? (
                    <Link
                      href={`/rivers/${n.river.slug}`}
                      className="text-xs font-semibold text-foreground hover:underline"
                    >
                      {n.river.name}
                    </Link>
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground">
                      Unknown river
                    </span>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {n.note}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Filter bar */}
      <section className="mb-5 bg-white border border-border rounded-xl">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="w-full md:hidden flex items-center justify-between gap-2 px-4 py-2.5"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                on
              </span>
            )}
          </span>
          {filtersOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <div className={cn('p-4 space-y-3', !filtersOpen && 'hidden md:block')}>
          <div className="grid gap-3 md:grid-cols-3">
            {/* River */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                River
              </label>
              <select
                value={riverFilter}
                onChange={(e) => setRiverFilter(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="all">All rivers</option>
                {rivers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Client */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Client
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  placeholder="Search client name…"
                  className="h-9 pl-7 text-sm"
                />
              </div>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Visibility
              </label>
              <select
                value={visibilityFilter}
                onChange={(e) => setVisibilityFilter(e.target.value as VisibilityFilter)}
                className="w-full h-9 rounded-md border border-border bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="all">All</option>
                <option value="private">Private only</option>
                <option value="public">Public only</option>
              </select>
            </div>
          </div>

          {/* Rating chips */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Rating
            </label>
            <div className="flex flex-wrap gap-1.5">
              {RATING_CHIPS.map((c) => {
                const active = ratingFilter === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setRatingFilter(c.value)}
                    className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded-full border transition-colors',
                      c.style,
                      active && 'ring-2 ring-offset-1 ring-primary/30'
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date presets + clear */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Date
            </label>
            {(['all', '30d', '90d', 'season'] as DatePreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDatePreset(p)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-colors',
                  datePreset === p
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border bg-white text-muted-foreground hover:border-primary/40'
                )}
              >
                {p === 'all' ? 'All time' : p === '30d' ? '30 days' : p === '90d' ? '90 days' : 'This season'}
              </button>
            ))}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Timeline */}
      {filteredEntries.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl px-6 py-16 text-center animate-fade-in">
          {liveEntries.length === 0 ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Feather className="h-6 w-6" />
              </div>
              <p className="text-base font-semibold mb-1.5">Your journal is empty.</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                Log your first trip — every entry captures the flow and temp at that
                moment, so you&apos;ll remember what worked and when.
              </p>
              {rivers.length > 0 && (
                <Button size="sm" onClick={() => setDrawerState({ mode: 'create' })}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  New entry
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="text-base font-semibold mb-1.5">No entries match these filters.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-primary hover:underline"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(([dayKey, dayEntries], groupIdx) => (
            <section key={dayKey} className="relative">
              {/* Sticky day header — offsets below the mobile top bar / desktop viewport */}
              <h2
                className="sticky top-0 z-10 -mx-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground bg-background/85 backdrop-blur-sm"
              >
                {format(parseISO(dayKey), 'EEEE · MMM d, yyyy')}
                <span className="ml-2 text-muted-foreground/60 font-normal normal-case tracking-normal">
                  · {dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}
                </span>
              </h2>
              <ul className="space-y-3 mt-2">
                {dayEntries.map((e, i) => (
                  <EntryCard
                    key={e.id}
                    entry={e}
                    index={groupIdx * 2 + i}
                    onEdit={() => setDrawerState({ mode: 'edit', entry: e })}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Drawer */}
      {drawerState.mode !== 'closed' && (
        <JournalEntryDrawer
          rivers={rivers}
          entry={drawerState.mode === 'edit' ? drawerState.entry : null}
          onClose={() => setDrawerState({ mode: 'closed' })}
          onSaved={(entry) => {
            handleSaved(entry);
            setDrawerState({ mode: 'closed' });
          }}
          onDeleted={(id) => {
            handleDeleted(id);
            setDrawerState({ mode: 'closed' });
          }}
        />
      )}
    </div>
  );
}

function EntryCard({
  entry,
  onEdit,
  index = 0,
}: {
  entry: JournalEntry;
  onEdit: () => void;
  index?: number;
}) {
  const borderClass = entry.conditions_rating
    ? RATING_BORDER[entry.conditions_rating]
    : 'border-l-slate-300';

  const ratingBadge =
    entry.conditions_rating
      ? RATING_BADGE[entry.conditions_rating]
      : { label: 'Scouting', className: 'bg-slate-100 text-slate-700 border-slate-200' };

  const snapshotParts = [
    entry.flow_at_log != null ? formatFlow(entry.flow_at_log) : null,
    entry.temp_at_log != null ? formatTemperature(entry.temp_at_log) : null,
  ].filter(Boolean);

  const clientLabel = entry.client_name
    ? entry.party_size && entry.party_size > 0
      ? `${entry.client_name} (${entry.party_size})`
      : entry.client_name
    : null;

  return (
    <li
      className="animate-slide-up"
      style={{ ['--i' as string]: Math.min(index, 8) } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={onEdit}
        className={cn(
          'hover-lift w-full text-left bg-white border border-border border-l-4 rounded-xl p-4 hover:border-primary/40',
          borderClass
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            {entry.river ? (
              <span className="font-semibold text-sm text-foreground truncate block">
                {entry.river.name}
              </span>
            ) : (
              <span className="font-semibold text-sm text-muted-foreground">
                Unknown river
              </span>
            )}
            {snapshotParts.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {snapshotParts.join(' · ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', ratingBadge.className)}>
              {ratingBadge.label}
            </span>
            {entry.is_public ? (
              <Globe className="h-3.5 w-3.5 text-muted-foreground" aria-label="Public" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Private" />
            )}
          </div>
        </div>

        {clientLabel && (
          <div className="flex items-center gap-1.5 text-xs text-foreground/80 mb-2">
            <Users className="h-3.5 w-3.5 opacity-70" />
            <span className="font-medium">{clientLabel}</span>
          </div>
        )}

        {entry.species_caught && entry.species_caught.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {entry.species_caught.map((s) => (
              <span
                key={s}
                className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {entry.flies_working && (
          <p className="text-sm mb-1.5">
            <span className="font-medium text-foreground">Flies: </span>
            <span className="text-muted-foreground">{entry.flies_working}</span>
          </p>
        )}

        {entry.notes && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 whitespace-pre-wrap">
            {entry.notes}
          </p>
        )}
      </button>
    </li>
  );
}
