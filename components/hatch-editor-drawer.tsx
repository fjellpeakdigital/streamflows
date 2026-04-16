'use client';

import { useEffect, useRef, useState } from 'react';
import { Bug, Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { HATCH_TEMPLATES, type HatchTemplate } from '@/lib/hatch-templates';
import type { HatchEvent } from '@/lib/types/database';

export interface HatchEditorRiver {
  id: string;
  name: string;
}

interface HatchEditorDrawerProps {
  /** River list for the create-mode dropdown. When editing, the drawer locks
   *  to the entry's river and this prop can be empty. */
  rivers: HatchEditorRiver[];
  /** Null = create mode. When set, edit that hatch. */
  entry: HatchEvent | null;
  /** Pre-select this river in create mode (skips the dropdown). */
  defaultRiverId?: string;
  onClose: () => void;
  onSaved: (entry: HatchEvent) => void;
  onDeleted: (id: string) => void;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const STAGE_SUGGESTIONS = ['nymph', 'emerger', 'dun', 'spinner', 'adult'];
const TIME_SUGGESTIONS  = ['morning', 'midday', 'afternoon', 'evening', 'all day'];

function clampDay(day: number, month: number): number {
  const max = DAYS_IN_MONTH[month - 1] ?? 31;
  return Math.min(Math.max(1, day), max);
}

export function HatchEditorDrawer({
  rivers,
  entry,
  defaultRiverId,
  onClose,
  onSaved,
  onDeleted,
}: HatchEditorDrawerProps) {
  const isEdit = entry !== null;

  const initialRiverId =
    entry?.river_id ?? defaultRiverId ?? rivers[0]?.id ?? '';

  const [riverId, setRiverId] = useState<string>(initialRiverId);

  const [insect,       setInsect]       = useState<string>(entry?.insect ?? '');
  const [stage,        setStage]        = useState<string>(entry?.stage ?? '');
  const [timeOfDay,    setTimeOfDay]    = useState<string>(entry?.time_of_day ?? '');

  const [startMonth,   setStartMonth]   = useState<number>(entry?.start_month ?? 4);
  const [startDay,     setStartDay]     = useState<number>(entry?.start_day ?? 1);
  const [endMonth,     setEndMonth]     = useState<number>(entry?.end_month ?? 5);
  const [endDay,       setEndDay]       = useState<number>(entry?.end_day ?? 31);

  const [peakEnabled,  setPeakEnabled]  = useState<boolean>(
    entry?.peak_start_month != null && entry?.peak_start_day != null
  );
  const [peakStartMonth, setPeakStartMonth] = useState<number>(entry?.peak_start_month ?? 4);
  const [peakStartDay,   setPeakStartDay]   = useState<number>(entry?.peak_start_day ?? 10);
  const [peakEndMonth,   setPeakEndMonth]   = useState<number>(entry?.peak_end_month ?? 4);
  const [peakEndDay,     setPeakEndDay]     = useState<number>(entry?.peak_end_day ?? 20);

  const [tempTrigger,  setTempTrigger]  = useState<string>(
    entry?.temp_trigger != null ? String(entry.temp_trigger) : ''
  );
  const [flyPatterns,  setFlyPatterns]  = useState<string>(entry?.fly_patterns ?? '');
  const [notes,        setNotes]        = useState<string>(entry?.notes ?? '');

  const [saving,         setSaving]         = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);

  const applyTemplate = (t: HatchTemplate) => {
    setInsect(t.insect);
    setStage(t.stage);
    setTimeOfDay(t.time_of_day);
    setStartMonth(t.start_month);
    setStartDay(t.start_day);
    setEndMonth(t.end_month);
    setEndDay(t.end_day);
    const hasPeak = t.peak_start_month != null && t.peak_start_day != null;
    setPeakEnabled(hasPeak);
    if (hasPeak) {
      setPeakStartMonth(t.peak_start_month as number);
      setPeakStartDay(t.peak_start_day as number);
      setPeakEndMonth(t.peak_end_month as number);
      setPeakEndDay(t.peak_end_day as number);
    }
    setTempTrigger(t.temp_trigger != null ? String(t.temp_trigger) : '');
    setFlyPatterns(t.fly_patterns);
    setNotes(t.notes);
    setAppliedTemplateId(t.id);
  };

  const firstFieldRef = useRef<HTMLInputElement | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!riverId) {
      setError('Pick a river.');
      return;
    }
    if (!insect.trim()) {
      setError('Insect name is required.');
      return;
    }

    setSaving(true);

    try {
      const trigger = tempTrigger.trim();
      const payload: Record<string, unknown> = {
        river_id: riverId,
        insect: insect.trim(),
        start_month: startMonth,
        start_day: clampDay(startDay, startMonth),
        end_month: endMonth,
        end_day: clampDay(endDay, endMonth),
        peak_start_month: peakEnabled ? peakStartMonth : null,
        peak_start_day:   peakEnabled ? clampDay(peakStartDay, peakStartMonth) : null,
        peak_end_month:   peakEnabled ? peakEndMonth   : null,
        peak_end_day:     peakEnabled ? clampDay(peakEndDay, peakEndMonth) : null,
        temp_trigger: trigger === '' ? null : Number(trigger),
        fly_patterns: flyPatterns.trim() || null,
        stage:        stage.trim() || null,
        time_of_day:  timeOfDay.trim() || null,
        notes:        notes.trim() || null,
      };

      const res = await fetch('/api/hatches', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: entry!.id, ...payload } : payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error ?? 'Failed to save hatch.');
        return;
      }

      const saved = (await res.json()) as HatchEvent;
      onSaved(saved);
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entry) return;
    if (!confirm('Delete this hatch? This removes it from your custom list.')) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/hatches', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error ?? 'Failed to delete hatch.');
        return;
      }
      onDeleted(entry.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex md:items-stretch md:justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit hatch' : 'Add hatch'}
        className="relative ml-auto w-full md:max-w-lg bg-white md:shadow-xl overflow-y-auto flex flex-col"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-border px-5 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Bug className="h-4 w-4 text-primary" />
            {isEdit ? 'Edit hatch' : 'Add hatch'}
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

          {/* River (create mode, only shown if the drawer wasn't pre-scoped) */}
          {!isEdit && !defaultRiverId && rivers.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5">River</label>
              <select
                value={riverId}
                onChange={(e) => setRiverId(e.target.value)}
                className="w-full h-10 rounded-md border border-border bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                {rivers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick-add templates (create mode only) */}
          {!isEdit && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                  Quick add from regional hatches
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">
                Pick a starter — you can tweak any field before saving.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {HATCH_TEMPLATES.map((t) => {
                  const active = appliedTemplateId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-full border transition-colors',
                        active
                          ? 'border-primary bg-primary text-white font-semibold'
                          : 'border-border bg-white text-foreground hover:border-primary/50 hover:bg-primary/5'
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Insect */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Insect</label>
            <Input
              ref={firstFieldRef}
              value={insect}
              onChange={(e) => setInsect(e.target.value)}
              placeholder="Blue-Winged Olive, Sulphur, Hendrickson…"
              className="h-10 text-sm"
              required
            />
          </div>

          {/* Stage + Time of day */}
          <div className="grid gap-3 sm:grid-cols-2">
            <SuggestField
              label="Stage"
              value={stage}
              suggestions={STAGE_SUGGESTIONS}
              onChange={setStage}
              placeholder="nymph / dun / spinner…"
            />
            <SuggestField
              label="Time of day"
              value={timeOfDay}
              suggestions={TIME_SUGGESTIONS}
              onChange={setTimeOfDay}
              placeholder="afternoon, evening…"
            />
          </div>

          {/* Window */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Season window</label>
            <div className="grid gap-2 grid-cols-2">
              <MonthDayPicker
                label="Start"
                month={startMonth}
                day={startDay}
                onChange={(m, d) => {
                  setStartMonth(m);
                  setStartDay(d);
                }}
              />
              <MonthDayPicker
                label="End"
                month={endMonth}
                day={endDay}
                onChange={(m, d) => {
                  setEndMonth(m);
                  setEndDay(d);
                }}
              />
            </div>
          </div>

          {/* Peak */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={peakEnabled}
                onChange={(e) => setPeakEnabled(e.target.checked)}
                className="accent-primary h-4 w-4"
              />
              Peak window <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            {peakEnabled && (
              <div className="grid gap-2 grid-cols-2">
                <MonthDayPicker
                  label="Peak start"
                  month={peakStartMonth}
                  day={peakStartDay}
                  onChange={(m, d) => {
                    setPeakStartMonth(m);
                    setPeakStartDay(d);
                  }}
                />
                <MonthDayPicker
                  label="Peak end"
                  month={peakEndMonth}
                  day={peakEndDay}
                  onChange={(m, d) => {
                    setPeakEndMonth(m);
                    setPeakEndDay(d);
                  }}
                />
              </div>
            )}
          </div>

          {/* Temp trigger */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Temp trigger <span className="font-normal text-muted-foreground">(°F, optional)</span>
            </label>
            <Input
              type="number"
              min={32}
              max={90}
              step={1}
              value={tempTrigger}
              onChange={(e) => setTempTrigger(e.target.value)}
              placeholder="e.g. 50"
              className="h-10 text-sm w-32"
            />
          </div>

          {/* Fly patterns */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Fly patterns <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              value={flyPatterns}
              onChange={(e) => setFlyPatterns(e.target.value)}
              placeholder="#18 parachute BWO, #20 CDC emerger, #16 pheasant tail dropper…"
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
              placeholder="Overcast days produce the best emergence. Target slow water downstream of the dam…"
              rows={3}
              className="text-sm resize-none"
            />
          </div>
        </form>

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
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add hatch'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthDayPicker({
  label,
  month,
  day,
  onChange,
}: {
  label: string;
  month: number;
  day: number;
  onChange: (month: number, day: number) => void;
}) {
  const maxDay = DAYS_IN_MONTH[month - 1] ?? 31;
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {label}
      </label>
      <div className="flex gap-1.5">
        <select
          value={month}
          onChange={(e) => {
            const m = Number(e.target.value);
            onChange(m, clampDay(day, m));
          }}
          className="h-9 flex-1 rounded-md border border-border bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
        >
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min={1}
          max={maxDay}
          value={day}
          onChange={(e) => onChange(month, clampDay(Number(e.target.value) || 1, month))}
          className="h-9 w-16 text-sm"
        />
      </div>
    </div>
  );
}

function SuggestField({
  label,
  value,
  suggestions,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  suggestions: string[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {label} <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 text-sm"
      />
      <div className="flex flex-wrap gap-1 mt-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={cn(
              'text-[11px] px-2 py-0.5 rounded-full border transition-colors',
              value.toLowerCase() === s
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-border bg-white text-muted-foreground hover:border-primary/40'
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
