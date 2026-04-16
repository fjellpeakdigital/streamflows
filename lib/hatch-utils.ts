// Pure utilities for hatch date math. Shared between server (dashboard RSC,
// hatches page RSC) and client (workbench, river detail) — so don't import
// anything server-only from here.

const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

export interface HatchDateRange {
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
  peak_start_month?: number | null;
  peak_start_day?: number | null;
  peak_end_month?: number | null;
  peak_end_day?: number | null;
}

export function dayOfYear(month: number, day: number): number {
  return DAYS_BEFORE_MONTH[month - 1] + day;
}

export function isHatchActive(h: HatchDateRange, today: Date): boolean {
  const t = dayOfYear(today.getMonth() + 1, today.getDate());
  const s = dayOfYear(h.start_month, h.start_day);
  const e = dayOfYear(h.end_month, h.end_day);
  // Windows that wrap the year (e.g. Dec 15 → Feb 15) need the disjunction
  if (s > e) return t >= s || t <= e;
  return t >= s && t <= e;
}

export function isHatchSoon(h: HatchDateRange, today: Date, days: number): boolean {
  if (isHatchActive(h, today)) return false;
  const t = dayOfYear(today.getMonth() + 1, today.getDate());
  const s = dayOfYear(h.start_month, h.start_day);
  const diff = (s - t + 365) % 365;
  return diff >= 1 && diff <= days;
}
