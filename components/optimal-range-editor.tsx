'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X, Check, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OptimalRangeEditorProps {
  riverId: string;
  /** The effective range currently in use (override if set, else global). */
  effectiveMin: number | null;
  effectiveMax: number | null;
  /** The global river default — used to render "Reset to default (X-Y)". */
  globalMin: number | null;
  globalMax: number | null;
  /** True if the user has a per-river override set. */
  hasOverride: boolean;
  /** True if the river is in the user's roster. Editor is hidden if false. */
  isInRoster: boolean;
  /** Callback fired after a successful save/reset, before router.refresh runs. */
  onSaved?: () => void;
}

export function OptimalRangeEditor({
  riverId,
  effectiveMin,
  effectiveMax,
  globalMin,
  globalMax,
  hasOverride,
  isInRoster,
  onSaved,
}: OptimalRangeEditorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [minStr, setMinStr] = useState(effectiveMin != null ? String(effectiveMin) : '');
  const [maxStr, setMaxStr] = useState(effectiveMax != null ? String(effectiveMax) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rangeLabel =
    effectiveMin != null && effectiveMax != null
      ? `Optimal ${effectiveMin}–${effectiveMax} CFS`
      : 'Optimal range not set';

  // Read-only display for non-roster rivers — no edit affordance.
  if (!isInRoster) {
    return (
      <span className="text-xs text-muted-foreground">
        {effectiveMin != null && effectiveMax != null
          ? `Optimal ${effectiveMin}–${effectiveMax} CFS`
          : null}
      </span>
    );
  }

  const handleSave = async () => {
    setError(null);
    const minNum = parseInt(minStr, 10);
    const maxNum = parseInt(maxStr, 10);
    if (!Number.isFinite(minNum) || !Number.isFinite(maxNum)) {
      setError('Both values must be numbers.');
      return;
    }
    if (minNum <= 0 || maxNum <= 0) {
      setError('Values must be greater than zero.');
      return;
    }
    if (minNum >= maxNum) {
      setError('Min must be less than max.');
      return;
    }

    setSaving(true);
    const res = await fetch('/api/roster', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        river_id: riverId,
        optimal_flow_min_override: minNum,
        optimal_flow_max_override: maxNum,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Save failed.');
      return;
    }

    setOpen(false);
    onSaved?.();
    router.refresh();
  };

  const handleReset = async () => {
    setError(null);
    setSaving(true);
    const res = await fetch('/api/roster', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        river_id: riverId,
        optimal_flow_min_override: null,
        optimal_flow_max_override: null,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Reset failed.');
      return;
    }

    setMinStr(globalMin != null ? String(globalMin) : '');
    setMaxStr(globalMax != null ? String(globalMax) : '');
    setOpen(false);
    onSaved?.();
    router.refresh();
  };

  if (!open) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{rangeLabel}</span>
        {hasOverride && (
          <span
            title={
              globalMin != null && globalMax != null
                ? `Default: ${globalMin}–${globalMax} CFS`
                : 'You have set a custom range for this river'
            }
            className="inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
          >
            Custom
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Edit optimal range"
        >
          <Pencil className="h-3 w-3" />
          <span className="underline underline-offset-2">Edit</span>
        </button>
      </span>
    );
  }

  return (
    <div className="mt-2 w-full rounded-md border border-border bg-background p-2 space-y-2">
      <div className="flex items-end gap-2">
        <label className="flex-1 min-w-0 text-[10px] uppercase tracking-wide text-muted-foreground space-y-0.5">
          Min CFS
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={minStr}
            onChange={(e) => setMinStr(e.target.value)}
            className="h-8 text-sm"
          />
        </label>
        <span className="pb-2 text-muted-foreground text-sm">–</span>
        <label className="flex-1 min-w-0 text-[10px] uppercase tracking-wide text-muted-foreground space-y-0.5">
          Max CFS
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={maxStr}
            onChange={(e) => setMaxStr(e.target.value)}
            className="h-8 text-sm"
          />
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        {hasOverride && globalMin != null && globalMax != null ? (
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className={cn(
              'inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors',
              saving && 'opacity-50 cursor-not-allowed'
            )}
          >
            <RotateCcw className="h-3 w-3" />
            Reset to default ({globalMin}–{globalMax})
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setOpen(false);
              setError(null);
              setMinStr(effectiveMin != null ? String(effectiveMin) : '');
              setMaxStr(effectiveMax != null ? String(effectiveMax) : '');
            }}
            disabled={saving}
          >
            <X className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleSave}
            disabled={saving}
          >
            <Check className="h-3 w-3 mr-1" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
