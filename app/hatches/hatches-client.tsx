'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  BookOpenText,
  Copy,
  Edit3,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HatchEditorDrawer } from '@/components/hatch-editor-drawer';
import { isHatchActive } from '@/lib/hatch-utils';
import { cn } from '@/lib/utils';
import type { HatchEvent } from '@/lib/types/database';
import type { WorkbenchRiver } from './page';

interface HatchesClientProps {
  rivers: WorkbenchRiver[];
  hatches: HatchEvent[];
}

const MONTH_SHORT = [
  'J', 'F', 'M', 'A', 'M', 'J',
  'J', 'A', 'S', 'O', 'N', 'D',
];

const MONTH_FULL = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function fmtMonthDay(month: number | null, day: number | null): string | null {
  if (month == null || day == null) return null;
  return `${MONTH_FULL[month - 1]} ${day}`;
}

type DrawerState =
  | { mode: 'closed' }
  | { mode: 'create'; riverId: string }
  | { mode: 'edit'; entry: HatchEvent };

export function HatchesClient({ rivers, hatches }: HatchesClientProps) {
  const [riverFilter, setRiverFilter] = useState<string>('all');
  const [activeOnly,  setActiveOnly]  = useState<boolean>(false);
  const [busyId,      setBusyId]      = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [drawer,      setDrawer]      = useState<DrawerState>({ mode: 'closed' });
  const [liveHatches, setLiveHatches] = useState<HatchEvent[]>(hatches);

  const today = useMemo(() => new Date(), []);

  // Hide seed rows that the user has already cloned — the custom replaces
  // the seed in the visible list.
  const visibleHatches = useMemo(() => {
    const clonedSeedIds = new Set(
      liveHatches
        .filter((h) => h.user_id !== null && h.source_hatch_id != null)
        .map((h) => h.source_hatch_id as string)
    );
    return liveHatches.filter((h) => {
      if (h.user_id === null && clonedSeedIds.has(h.id)) return false;
      if (riverFilter !== 'all' && h.river_id !== riverFilter) return false;
      if (activeOnly && !isHatchActive(h, today)) return false;
      return true;
    });
  }, [liveHatches, riverFilter, activeOnly, today]);

  const hatchesByRiver = useMemo(() => {
    const map = new Map<string, HatchEvent[]>();
    for (const h of visibleHatches) {
      const arr = map.get(h.river_id) ?? [];
      arr.push(h);
      map.set(h.river_id, arr);
    }
    return map;
  }, [visibleHatches]);

  const activeCount = useMemo(
    () => liveHatches.filter((h) => isHatchActive(h, today)).length,
    [liveHatches, today]
  );

  const handleSaved = (saved: HatchEvent) => {
    setLiveHatches((prev) => {
      const idx = prev.findIndex((h) => h.id === saved.id);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setDrawer({ mode: 'closed' });
  };

  const handleDeleted = (id: string) => {
    setLiveHatches((prev) => prev.filter((h) => h.id !== id));
    setDrawer({ mode: 'closed' });
  };

  const handleCustomize = async (seed: HatchEvent) => {
    setError(null);
    setBusyId(seed.id);
    try {
      const res = await fetch('/api/hatches/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_hatch_id: seed.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error ?? 'Failed to customize hatch.');
        return;
      }
      const cloned = (await res.json()) as HatchEvent;
      setLiveHatches((prev) => [cloned, ...prev]);
      setDrawer({ mode: 'edit', entry: cloned });
    } finally {
      setBusyId(null);
    }
  };

  const handleResetToSeed = async (custom: HatchEvent) => {
    if (!confirm('Discard your changes and revert to the default hatch?')) return;
    setError(null);
    setBusyId(custom.id);
    try {
      const res = await fetch('/api/hatches', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: custom.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error ?? 'Failed to reset hatch.');
        return;
      }
      setLiveHatches((prev) => prev.filter((h) => h.id !== custom.id));
    } finally {
      setBusyId(null);
    }
  };

  const renderSections = () => {
    if (rivers.length === 0) {
      return (
        <div className="bg-card border border-border rounded-2xl px-6 py-16 text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpenText className="h-6 w-6" />
          </div>
          <p className="text-base font-semibold mb-1.5">No rivers on your roster yet.</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
            Add the rivers you fish, then build out their hatches one Quick-add at a time.
          </p>
          <Link href="/rivers" className="inline-flex items-center text-sm font-medium text-primary hover:underline">
            Browse rivers
          </Link>
        </div>
      );
    }

    const filteredRivers =
      riverFilter === 'all'
        ? rivers
        : rivers.filter((r) => r.id === riverFilter);

    return (
      <div className="space-y-5">
        {filteredRivers.map((river, riverIdx) => {
          const rows = hatchesByRiver.get(river.id) ?? [];
          const allRows = liveHatches.filter((h) => h.river_id === river.id);
          return (
            <section
              key={river.id}
              className="animate-slide-up bg-white border border-border rounded-2xl overflow-hidden"
              style={{ ['--i' as string]: Math.min(riverIdx, 6) } as React.CSSProperties}
            >
              {/* Quieter river header: small uppercase label + subtle action */}
              <header className="flex items-center justify-between gap-2 px-4 py-2.5 bg-muted/40 border-b border-border/60">
                <div className="min-w-0 flex items-baseline gap-2">
                  <Link
                    href={`/rivers/${river.slug}`}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    {river.name}
                  </Link>
                  {river.region && (
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
                      {river.region}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDrawer({ mode: 'create', riverId: river.id })}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </header>

              {rows.length === 0 ? (
                <p className="px-4 py-8 text-sm text-muted-foreground text-center">
                  {activeOnly && allRows.length > 0
                    ? 'Nothing active on this river right now.'
                    : 'No hatches yet — tap Add to fill this in.'}
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {rows.map((h, i) => (
                    <HatchRow
                      key={h.id}
                      hatch={h}
                      today={today}
                      busy={busyId === h.id}
                      index={i}
                      onEdit={() => setDrawer({ mode: 'edit', entry: h })}
                      onCustomize={() => handleCustomize(h)}
                      onResetToSeed={() => handleResetToSeed(h)}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-5xl">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <BookOpenText className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-2xl font-bold leading-tight">Hatches</h1>
            <p className="text-xs text-muted-foreground">
              {liveHatches.length} {liveHatches.length === 1 ? 'hatch' : 'hatches'} across your
              roster · {activeCount} active today
            </p>
          </div>
        </div>
        {rivers.length > 0 && (
          <Button
            size="sm"
            onClick={() => setDrawer({ mode: 'create', riverId: rivers[0].id })}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add hatch
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {/* Filters */}
      {rivers.length > 0 && (
        <section className="mb-5 bg-white border border-border rounded-xl p-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              River
            </span>
            <select
              value={riverFilter}
              onChange={(e) => setRiverFilter(e.target.value)}
              className="h-9 rounded-md border border-border bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="all">All rivers</option>
              {rivers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none ml-auto">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="accent-primary h-4 w-4"
            />
            <span className="text-sm">Active today only</span>
          </label>
        </section>
      )}

      {renderSections()}

      {drawer.mode !== 'closed' && (
        <HatchEditorDrawer
          rivers={rivers.map((r) => ({ id: r.id, name: r.name }))}
          entry={drawer.mode === 'edit' ? drawer.entry : null}
          defaultRiverId={drawer.mode === 'create' ? drawer.riverId : undefined}
          onClose={() => setDrawer({ mode: 'closed' })}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

function HatchRow({
  hatch,
  today,
  busy,
  index = 0,
  onEdit,
  onCustomize,
  onResetToSeed,
}: {
  hatch: HatchEvent;
  today: Date;
  busy: boolean;
  index?: number;
  onEdit: () => void;
  onCustomize: () => void;
  onResetToSeed: () => void;
}) {
  const active = isHatchActive(hatch, today);
  const isCustom = hatch.user_id !== null;
  const isSeed   = hatch.user_id === null;
  const isCustomizedSeed = isCustom && hatch.source_hatch_id != null;

  const range = `${fmtMonthDay(hatch.start_month, hatch.start_day)} – ${fmtMonthDay(hatch.end_month, hatch.end_day)}`;
  const peakStart = fmtMonthDay(hatch.peak_start_month, hatch.peak_start_day);
  const peakEnd   = fmtMonthDay(hatch.peak_end_month, hatch.peak_end_day);
  const peak = peakStart && peakEnd ? `${peakStart} – ${peakEnd}` : null;

  const subLabelParts = [hatch.stage, hatch.time_of_day].filter(Boolean);

  return (
    <li
      className={cn(
        'relative px-4 py-3 animate-slide-up',
        active && 'bg-emerald-50/40'
      )}
      style={{ ['--i' as string]: Math.min(index, 8) } as React.CSSProperties}
    >
      {active && (
        <div
          aria-hidden="true"
          className="shimmer-active pointer-events-none absolute inset-0"
        />
      )}
      <div className="relative">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm">{hatch.insect}</span>
            {subLabelParts.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {subLabelParts.join(' · ')}
              </span>
            )}
            {active && (
              <span className="inline-flex items-center rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-semibold px-1.5 py-0.5">
                Active
              </span>
            )}
            {isCustomizedSeed ? (
              <span className="inline-flex items-center rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px] font-medium px-1.5 py-0.5">
                Customized
              </span>
            ) : isCustom ? (
              <span className="inline-flex items-center rounded-md bg-secondary text-muted-foreground text-[10px] font-medium px-1.5 py-0.5">
                Custom
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium px-1.5 py-0.5">
                Seed
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {isSeed && (
            <button
              type="button"
              onClick={onCustomize}
              disabled={busy}
              title="Copy to my custom list"
              className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
          {isCustom && (
            <>
              <button
                type="button"
                onClick={onEdit}
                disabled={busy}
                title="Edit"
                className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              {isCustomizedSeed ? (
                <button
                  type="button"
                  onClick={onResetToSeed}
                  disabled={busy}
                  title="Reset to default"
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onResetToSeed}
                  disabled={busy}
                  title="Delete"
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <SeasonBar hatch={hatch} />

      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>{range}</span>
        {peak && <span>· Peak {peak}</span>}
        {hatch.temp_trigger != null && <span>· ~{hatch.temp_trigger}°F</span>}
      </div>

      {hatch.fly_patterns && (
        <p className="mt-2 text-sm">
          <span className="font-medium text-foreground">Flies: </span>
          <span className="text-muted-foreground">{hatch.fly_patterns}</span>
        </p>
      )}

      {hatch.notes && (
        <p className="mt-1 text-xs text-foreground/80 leading-snug whitespace-pre-wrap">
          {hatch.notes}
        </p>
      )}
      </div>
    </li>
  );
}

function SeasonBar({ hatch }: { hatch: HatchEvent }) {
  const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const dayOfYear = (m: number, d: number) => {
    const DAYS_BEFORE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    return DAYS_BEFORE[m - 1] + d;
  };

  const monthOverlap = (
    m: number,
    startMonth: number,
    startDay: number,
    endMonth: number,
    endDay: number
  ): boolean => {
    const monthStart = dayOfYear(m, 1);
    const monthEnd = dayOfYear(m, DAYS_IN_MONTH[m - 1]);
    const s = dayOfYear(startMonth, startDay);
    const e = dayOfYear(endMonth, endDay);
    if (s <= e) return monthEnd >= s && monthStart <= e;
    // Wrap year
    return monthStart <= e || monthEnd >= s;
  };

  const inWindow = (m: number) =>
    monthOverlap(m, hatch.start_month, hatch.start_day, hatch.end_month, hatch.end_day);

  const inPeak = (m: number) => {
    if (
      hatch.peak_start_month == null ||
      hatch.peak_start_day == null ||
      hatch.peak_end_month == null ||
      hatch.peak_end_day == null
    ) {
      return false;
    }
    return monthOverlap(
      m,
      hatch.peak_start_month,
      hatch.peak_start_day,
      hatch.peak_end_month,
      hatch.peak_end_day
    );
  };

  const currentMonth = new Date().getMonth() + 1;

  return (
    <div aria-hidden="true">
      <div className="flex gap-px rounded-sm overflow-hidden bg-secondary/50 h-2">
        {Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          const peak = inPeak(m);
          const active = inWindow(m);
          return (
            <div
              key={m}
              className={cn(
                'flex-1',
                peak
                  ? 'bg-primary'
                  : active
                  ? 'bg-primary/35'
                  : 'bg-transparent'
              )}
            />
          );
        })}
      </div>
      <div className="flex gap-px mt-0.5">
        {MONTH_SHORT.map((letter, i) => (
          <span
            key={i}
            className={cn(
              'flex-1 text-center text-[9px] leading-none',
              currentMonth === i + 1
                ? 'text-primary font-semibold'
                : 'text-muted-foreground'
            )}
          >
            {letter}
          </span>
        ))}
      </div>
    </div>
  );
}
