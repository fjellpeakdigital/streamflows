import type { Condition } from '@/lib/types/database';

export type EtaType =
  | 'rising_to_optimal'       // below optimal, rising — will enter optimal
  | 'falling_to_optimal'      // above optimal, falling — will enter optimal
  | 'leaving_optimal_rising'  // in optimal, rising — will exceed optimal
  | 'leaving_optimal_falling' // in optimal, falling — will drop below optimal
  | 'optimal'                 // currently optimal, stable
  | 'no_data';

export interface FlowEta {
  type: EtaType;
  hours: number | null;  // null = stable / can't calculate
  label: string;         // human-readable, e.g. "Optimal in ~3h"
}

/**
 * Given the last 24h of conditions (ascending by timestamp) and the
 * river's optimal range, return a plain-English ETA label.
 */
export function calculateFlowEta(
  conditions: Pick<Condition, 'flow' | 'timestamp'>[],
  optimalMin: number | null,
  optimalMax: number | null
): FlowEta {
  const noData: FlowEta = { type: 'no_data', hours: null, label: '' };

  if (!optimalMin || !optimalMax || conditions.length < 3) return noData;

  // Use the most recent reading and one ~3 hours back for a stable rate
  const sorted = [...conditions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const latest = sorted[sorted.length - 1];
  const older  = sorted[Math.max(0, sorted.length - 4)]; // ~3 readings back

  if (!latest.flow || !older.flow) return noData;

  const currentFlow = latest.flow;
  const hoursSpan =
    (new Date(latest.timestamp).getTime() - new Date(older.timestamp).getTime()) /
    3_600_000;

  if (hoursSpan < 0.1) return noData;

  const ratePerHour = (currentFlow - older.flow) / hoursSpan; // CFS/hour, negative = falling

  const isOptimal = currentFlow >= optimalMin && currentFlow <= optimalMax;
  const isBelow   = currentFlow < optimalMin;
  const isAbove   = currentFlow > optimalMax;
  const rising    = ratePerHour > 2;   // >2 CFS/h = meaningfully rising
  const falling   = ratePerHour < -2;  // <-2 CFS/h = meaningfully falling

  const cap = 72; // don't show ETAs beyond 72 hours

  // ── Currently in optimal range ──────────────────────────────────────────
  if (isOptimal) {
    if (rising) {
      const h = (optimalMax - currentFlow) / ratePerHour;
      if (h > cap) return { type: 'optimal', hours: null, label: 'Optimal now' };
      return {
        type:  'leaving_optimal_rising',
        hours: h,
        label: `Leaving optimal in ~${formatHours(h)}`,
      };
    }
    if (falling) {
      const h = (currentFlow - optimalMin) / Math.abs(ratePerHour);
      if (h > cap) return { type: 'optimal', hours: null, label: 'Optimal now' };
      return {
        type:  'leaving_optimal_falling',
        hours: h,
        label: `Leaving optimal in ~${formatHours(h)}`,
      };
    }
    return { type: 'optimal', hours: null, label: 'Optimal now' };
  }

  // ── Below optimal, rising ────────────────────────────────────────────────
  if (isBelow && rising) {
    const h = (optimalMin - currentFlow) / ratePerHour;
    if (h > cap) return noData;
    return {
      type:  'rising_to_optimal',
      hours: h,
      label: `Optimal in ~${formatHours(h)}`,
    };
  }

  // ── Above optimal, falling ───────────────────────────────────────────────
  if (isAbove && falling) {
    const h = (currentFlow - optimalMax) / Math.abs(ratePerHour);
    if (h > cap) return noData;
    return {
      type:  'falling_to_optimal',
      hours: h,
      label: `Optimal in ~${formatHours(h)}`,
    };
  }

  return noData;
}

function formatHours(h: number): string {
  if (h < 1)  return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}
