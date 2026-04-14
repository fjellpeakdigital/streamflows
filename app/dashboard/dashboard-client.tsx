'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  getStatusLabel,
  getStatusBorderColor,
  formatFlow,
  formatTemperature,
} from '@/lib/river-utils';
import type { FlowEta } from '@/lib/flow-eta';
import type { WeatherForecast } from '@/lib/weather';
import type { RiverStatus, FlowTrend, AlertType } from '@/lib/types/database';
import { ArrowRight, Bell, CalendarDays, CheckCircle2, LayoutDashboard, StickyNote, Users, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface DashboardRiver {
  id: string;
  name: string;
  slug: string;
  region: string;
  optimal_flow_min: number | null;
  optimal_flow_max: number | null;
  latitude: number | null;
  longitude: number | null;
  current_condition: any;
  trend: string;
  angler_rating?: { label: string; count: number };
  eta: FlowEta;
  weather: WeatherForecast | null;
  active_hatches?: string[];
  upcoming_hatches?: string[];
}

const STATUS_RANK: Record<RiverStatus, number> = {
  optimal: 0,
  elevated: 1,
  low: 2,
  high: 3,
  ice_affected: 4,
  no_data: 5,
  unknown: 5,
};

function trendLabel(trend: string): { arrow: string; text: string; className: string } {
  switch (trend as FlowTrend) {
    case 'rising':
      return { arrow: '↑', text: 'Rising', className: 'text-amber-600' };
    case 'falling':
      return { arrow: '↓', text: 'Falling', className: 'text-blue-600' };
    case 'stable':
      return { arrow: '→', text: 'Stable', className: 'text-emerald-600' };
    default:
      return { arrow: '→', text: 'Unknown', className: 'text-muted-foreground' };
  }
}

function formatOptimalRange(min: number | null, max: number | null): string | null {
  if (min === null || max === null) return null;
  return `${min.toLocaleString()}–${max.toLocaleString()} CFS`;
}

interface DashboardAlert {
  id: string;
  river_id: string;
  river_name: string;
  river_slug: string;
  alert_type: AlertType;
  threshold_value: number | null;
  updated_at: string;
}

function alertTypeLabel(type: AlertType): string {
  switch (type) {
    case 'optimal_flow':
      return 'Optimal flow';
    case 'flow_threshold':
      return 'Flow threshold';
    case 'temperature':
      return 'Temperature';
    default:
      return type;
  }
}

function thresholdLabel(type: AlertType, value: number | null): string | null {
  if (value === null) return null;
  if (type === 'temperature') return `${value}°F`;
  return `${value.toLocaleString()} CFS`;
}

interface OptimalBanner {
  id: string;
  river_slug: string;
  message: string;
  trend: string;
}

function OptimalBanners({ banners }: { banners: OptimalBanner[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = banners.filter((b) => !dismissed.has(b.id));
  if (visible.length === 0) return null;
  return (
    <div className="mb-3 space-y-2">
      {visible.map((b) => (
        <div
          key={b.id}
          className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <Link
            href={`/rivers/${b.river_slug}`}
            className="min-w-0 flex-1 text-sm text-emerald-900 hover:underline"
          >
            {b.message}
          </Link>
          <button
            type="button"
            onClick={() =>
              setDismissed((prev) => {
                const next = new Set(prev);
                next.add(b.id);
                return next;
              })
            }
            aria-label="Dismiss"
            className="shrink-0 text-emerald-700 hover:text-emerald-900 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function AlertFeed({ alerts }: { alerts: DashboardAlert[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = alerts.filter((a) => !dismissed.has(a.id));

  if (visible.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {visible.map((alert) => {
        const threshold = thresholdLabel(alert.alert_type, alert.threshold_value);
        return (
          <div
            key={alert.id}
            className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
          >
            <Bell className="h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1 text-sm">
              <Link
                href={`/rivers/${alert.river_slug}`}
                className="font-semibold text-amber-900 hover:underline"
              >
                {alert.river_name}
              </Link>
              <span className="text-amber-800">
                {' '}
                · {alertTypeLabel(alert.alert_type)}
                {threshold ? ` at ${threshold}` : ''}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setDismissed((prev) => {
                  const next = new Set(prev);
                  next.add(alert.id);
                  return next;
                })
              }
              aria-label="Dismiss alert"
              className="shrink-0 text-amber-700 hover:text-amber-900 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

interface BackupSuggestion {
  river_id: string;
  river_name: string;
  river_slug: string;
  rationale: string;
}

interface NextTrip {
  id: string;
  trip_date: string;
  client_count: number;
  river_name: string;
  river_slug: string;
  status: string;
  eta_label: string | null;
}

function NextTripBar({ trip, backup }: { trip: NextTrip; backup: BackupSuggestion | null }) {
  const statusLabel = getStatusLabel(trip.status as RiverStatus);
  const etaLabel = trip.eta_label || statusLabel;

  return (
    <div className="mb-6 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
      <div className="flex items-start gap-3 min-w-0">
        <CalendarDays className="h-5 w-5 shrink-0 text-primary mt-0.5" />
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="font-semibold">
              Next trip · {format(parseISO(trip.trip_date), 'EEE MMM d')}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {trip.client_count} client{trip.client_count !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="text-sm">
            <Link
              href={`/rivers/${trip.river_slug}`}
              className="font-medium text-foreground hover:underline"
            >
              {trip.river_name}
            </Link>
            <span className="text-muted-foreground"> · {etaLabel}</span>
          </div>
          {backup && (
            <div className="text-xs text-muted-foreground">
              Best backup:{' '}
              <Link
                href={`/rivers/${backup.river_slug}`}
                className="font-medium text-foreground hover:underline"
              >
                {backup.river_name}
              </Link>
              <span> — {backup.rationale.split(' — ')[1] ?? backup.rationale}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function truncate(text: string, max = 60): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function HatchChip({ river }: { river: DashboardRiver }) {
  const active = river.active_hatches ?? [];
  const soon = river.upcoming_hatches ?? [];
  if (active.length > 0) {
    const extra = active.length - 1;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium px-2 py-0.5">
        🪰 {active[0]}
        {extra > 0 ? ` +${extra}` : ''}
      </span>
    );
  }
  if (soon.length > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border text-muted-foreground text-xs font-medium px-2 py-0.5">
        Soon: {soon[0]}
      </span>
    );
  }
  return null;
}

function ConditionsRow({ river, note }: { river: DashboardRiver; note?: string }) {
  const status = (river.current_condition?.status ?? 'unknown') as RiverStatus;
  const flow = river.current_condition?.flow ?? null;
  const temp = river.current_condition?.temperature ?? null;
  const optimalRange = formatOptimalRange(river.optimal_flow_min, river.optimal_flow_max);
  const trend = trendLabel(river.trend);

  return (
    <div className="space-y-1.5">
      <Link
        href={`/rivers/${river.slug}`}
        className={cn(
          'group block bg-card border border-border rounded-xl p-3 border-l-4 transition-colors hover:border-foreground/20',
          getStatusBorderColor(status)
        )}
      >
        {/* Mobile stacked layout */}
        <div className="md:hidden space-y-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{river.name}</h3>
            <p className="text-xs text-muted-foreground truncate">{river.region}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Flow</div>
              <div className="font-bold">{formatFlow(flow)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Temp</div>
              <div className="font-semibold">
                {temp !== null ? formatTemperature(temp) : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Trend</div>
              <div className={cn('font-semibold', trend.className)}>
                {trend.arrow} {trend.text}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {getStatusLabel(status)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              View <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* md+ grid layout — columns align across cards */}
        <div className="hidden md:grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_6rem_8rem_4.5rem_7rem_6rem_5rem]">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{river.name}</h3>
            <p className="text-xs text-muted-foreground truncate">{river.region}</p>
          </div>

          <div className="text-right tabular-nums">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Flow</div>
            <div className="font-bold text-base leading-tight">{formatFlow(flow)}</div>
          </div>

          <div className="text-right tabular-nums">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Optimal</div>
            <div className="text-xs text-muted-foreground leading-tight">
              {optimalRange ?? '—'}
            </div>
          </div>

          <div className="text-right tabular-nums">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Temp</div>
            <div className="text-sm font-semibold leading-tight">
              {temp !== null ? formatTemperature(temp) : '—'}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Trend</div>
            <div className={cn('text-sm font-semibold leading-tight whitespace-nowrap', trend.className)}>
              {trend.arrow} {trend.text}
            </div>
          </div>

          <div>
            <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
              {getStatusLabel(status)}
            </span>
          </div>

          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-1.5 transition-all whitespace-nowrap">
              View <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </Link>

      {(note || (river.active_hatches?.length ?? 0) > 0 || (river.upcoming_hatches?.length ?? 0) > 0) && (
        <div className="flex flex-wrap items-center gap-2 pl-3">
          <HatchChip river={river} />
          {note && (
            <span className="inline-flex items-start gap-1.5 bg-secondary/60 border border-border rounded-md px-2 py-1 text-xs text-muted-foreground">
              <StickyNote className="h-3 w-3 shrink-0 mt-0.5" />
              <span className="leading-snug">{truncate(note)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function GuideDashboard({
  rivers,
  alerts,
  optimalBanners,
  notesByRiver,
  nextTrip,
  backup,
  user,
}: {
  rivers: DashboardRiver[];
  alerts: DashboardAlert[];
  optimalBanners: OptimalBanner[];
  notesByRiver: Record<string, string>;
  nextTrip: NextTrip | null;
  backup: BackupSuggestion | null;
  user: any;
}) {
  void user;

  if (rivers.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-3xl text-center">
        <LayoutDashboard className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Guide Dashboard</h1>
        <p className="text-muted-foreground mb-6">
          Add rivers to your roster to see live conditions at a glance.
        </p>
        <Link href="/rivers">
          <Button>Browse Rivers</Button>
        </Link>
      </div>
    );
  }

  const sorted = [...rivers].sort((a, b) => {
    const sa = (a.current_condition?.status ?? 'unknown') as RiverStatus;
    const sb = (b.current_condition?.status ?? 'unknown') as RiverStatus;
    const ra = STATUS_RANK[sa] ?? 5;
    const rb = STATUS_RANK[sb] ?? 5;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Today's Conditions</h1>
        <p className="text-sm text-muted-foreground">
          {rivers.length} river{rivers.length !== 1 ? 's' : ''} on your roster ·{' '}
          {format(new Date(), 'EEE MMM d, h:mm a')}
        </p>
        {backup && (
          <p className="text-xs text-muted-foreground mt-1">
            Best backup:{' '}
            <Link
              href={`/rivers/${backup.river_slug}`}
              className="font-medium text-foreground hover:underline"
            >
              {backup.river_name}
            </Link>
            <span> — {backup.rationale.split(' — ')[1] ?? backup.rationale}</span>
          </p>
        )}
      </div>

      <OptimalBanners banners={optimalBanners} />
      <AlertFeed alerts={alerts} />

      {nextTrip && <NextTripBar trip={nextTrip} backup={backup} />}

      <div className="space-y-2">
        {sorted.map((river) => (
          <ConditionsRow
            key={river.id}
            river={river}
            note={notesByRiver[river.id]}
          />
        ))}
      </div>
    </div>
  );
}
