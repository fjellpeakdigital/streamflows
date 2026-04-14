'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WeatherStripCompact } from '@/components/weather-strip';
import {
  getStatusColor, getStatusLabel, getStatusBorderColor, formatFlow, formatTemperature,
} from '@/lib/river-utils';
import type { FlowEta } from '@/lib/flow-eta';
import type { WeatherForecast } from '@/lib/weather';
import {
  TrendingUp, TrendingDown, Minus, ArrowRight, Share2,
  MapPin, Fish, Clock, Droplets, LayoutDashboard,
  CloudRain, CheckCircle2, AlertTriangle, Star, Thermometer,
} from 'lucide-react';
import { format } from 'date-fns';

// ── Helpers ─────────────────────────────────────────────────────────────────

const ANGLER_BADGE: Record<string, string> = {
  poor:      'bg-red-50 text-red-600 border-red-200',
  fair:      'bg-amber-50 text-amber-600 border-amber-200',
  good:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  excellent: 'bg-primary/10 text-primary border-primary/20',
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'rising')  return <TrendingUp  className="h-3.5 w-3.5 text-amber-500" />;
  if (trend === 'falling') return <TrendingDown className="h-3.5 w-3.5 text-blue-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

/**
 * Synthesise ETA + weather into a single guide-facing sentence.
 * Examples:
 *   "Optimal now · Rain Wed may push flows up"
 *   "Optimal in ~3h · Dry week — conditions holding"
 *   "Elevated · Falling toward optimal by tomorrow · Rain Thu — watch levels"
 */
function smartOutlook(
  eta: FlowEta,
  weather: WeatherForecast | null,
  status: string
): { text: string; urgent: boolean } {
  const parts: string[] = [];
  let urgent = false;

  // Part 1: flow status / ETA
  if (eta.label) {
    parts.push(eta.label);
  } else if (status === 'optimal') {
    parts.push('Optimal now');
  } else if (status === 'low') {
    parts.push('Running low');
  } else if (status === 'high') {
    parts.push('Running high');
  } else if (status === 'elevated') {
    parts.push('Elevated');
  }

  // Part 2: weather influence
  if (weather) {
    const rainDays = weather.days.filter((d) => d.precipPct >= 40);
    const heavyDays = weather.days.filter((d) => d.precipPct >= 70 || d.precipMm >= 15);

    if (heavyDays.length > 0) {
      urgent = true;
      const day = heavyDays[0].dayLabel;
      if (status === 'optimal') {
        parts.push(`Heavy rain ${day} — expect elevated flows`);
      } else if (status === 'high' || status === 'elevated') {
        parts.push(`Heavy rain ${day} — levels may stay high`);
      } else {
        parts.push(`Heavy rain ${day}`);
      }
    } else if (rainDays.length > 0) {
      const day = rainDays[0].dayLabel;
      if (status === 'optimal') {
        parts.push(`Rain ${day} may push flows up`);
      } else if (status === 'low') {
        parts.push(`Rain ${day} could improve flows`);
      } else if (status === 'high' || status === 'elevated') {
        parts.push(`Rain ${day} — watch levels`);
        urgent = true;
      } else {
        parts.push(`Rain expected ${day}`);
      }
    } else {
      if (status === 'optimal') {
        parts.push('Dry week — conditions stable');
      }
    }
  }

  return { text: parts.join(' · ') || '—', urgent };
}

// ── Types ────────────────────────────────────────────────────────────────────

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
}

// ── Status sort order ────────────────────────────────────────────────────────
const STATUS_RANK: Record<string, number> = {
  optimal: 0, elevated: 1, low: 2, high: 3, ice_affected: 4, unknown: 5,
};

// ── Main component ───────────────────────────────────────────────────────────

export function GuideDashboard({ rivers, user }: { rivers: DashboardRiver[]; user: any }) {
  if (rivers.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-3xl text-center">
        <LayoutDashboard className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Guide Dashboard</h1>
        <p className="text-muted-foreground mb-6">
          Heart any rivers to add them here — you'll see live conditions,
          flow ETAs, and upstream rain forecasts at a glance.
        </p>
        <Link href="/rivers"><Button>Browse Rivers</Button></Link>
      </div>
    );
  }

  // Sort: optimal first, then by status rank
  const sorted = [...rivers].sort(
    (a, b) =>
      (STATUS_RANK[a.current_condition?.status ?? 'unknown'] ?? 5) -
      (STATUS_RANK[b.current_condition?.status ?? 'unknown'] ?? 5)
  );

  const optimalRivers  = sorted.filter((r) => r.current_condition?.status === 'optimal');
  const otherRivers    = sorted.filter((r) => r.current_condition?.status !== 'optimal');
  const rainAlertCount = rivers.filter((r) => r.weather?.hasRain && r.weather.days.some(d => d.precipPct >= 40)).length;
  const recentReports  = rivers.filter((r) => r.angler_rating).length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Guide Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {rivers.length} saved river{rivers.length !== 1 ? 's' : ''} · {format(new Date(), 'EEE MMM d, h:mm a')}
          </p>
        </div>
        <Link href="/rivers">
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
            <MapPin className="h-3.5 w-3.5" />Browse All
          </Button>
        </Link>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-7">
        <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
          optimalRivers.length > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-secondary border-border'
        }`}>
          <CheckCircle2 className={`h-5 w-5 shrink-0 ${optimalRivers.length > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`} />
          <div>
            <div className={`text-xl font-bold leading-tight ${optimalRivers.length > 0 ? 'text-emerald-700' : 'text-foreground'}`}>
              {optimalRivers.length} <span className="text-sm font-medium">of {rivers.length}</span>
            </div>
            <div className="text-xs text-muted-foreground">Fishable today</div>
          </div>
        </div>

        <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
          rainAlertCount > 0 ? 'bg-blue-50 border-blue-200' : 'bg-secondary border-border'
        }`}>
          <CloudRain className={`h-5 w-5 shrink-0 ${rainAlertCount > 0 ? 'text-blue-600' : 'text-muted-foreground'}`} />
          <div>
            <div className={`text-xl font-bold leading-tight ${rainAlertCount > 0 ? 'text-blue-700' : 'text-foreground'}`}>
              {rainAlertCount}
            </div>
            <div className="text-xs text-muted-foreground">Rain in forecast</div>
          </div>
        </div>

        <div className="rounded-xl border bg-secondary border-border px-4 py-3 flex items-center gap-3 col-span-2 sm:col-span-1">
          <Fish className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <div className="text-xl font-bold leading-tight">{recentReports}</div>
            <div className="text-xs text-muted-foreground">Recent angler reports</div>
          </div>
        </div>
      </div>

      {/* ── Best Bets ── */}
      {optimalRivers.length > 0 && (
        <div className="mb-7">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-emerald-600 fill-emerald-600" />
            <h2 className="font-semibold text-base">Best Bets Today</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {optimalRivers.map((river) => {
              const flow = river.current_condition?.flow ?? null;
              const { text: outlook, urgent } = smartOutlook(river.eta, river.weather, 'optimal');

              return (
                <div key={river.id} className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{river.name}</h3>
                      <p className="text-xs text-muted-foreground">{river.region}</p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-semibold shrink-0">
                      Optimal
                    </Badge>
                  </div>

                  {/* Flow + trend */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Droplets className="h-3.5 w-3.5 text-primary" />
                      <span className="font-bold text-lg leading-none">{formatFlow(flow)}</span>
                      <TrendIcon trend={river.trend} />
                    </div>
                    {river.current_condition?.temperature && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Thermometer className="h-3 w-3" />
                        {formatTemperature(river.current_condition.temperature)}
                      </div>
                    )}
                    {river.angler_rating && (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${ANGLER_BADGE[river.angler_rating.label]}`}>
                        <Fish className="h-2.5 w-2.5" />
                        {river.angler_rating.label.charAt(0).toUpperCase() + river.angler_rating.label.slice(1)}
                      </span>
                    )}
                  </div>

                  {/* Smart outlook */}
                  <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
                    urgent
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-white/70 border-emerald-200 text-emerald-800'
                  }`}>
                    {urgent
                      ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      : <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    }
                    <span>{outlook}</span>
                  </div>

                  {/* Weather strip */}
                  {river.weather && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1.5">
                        5-Day Rain Forecast
                      </p>
                      <WeatherStripCompact forecast={river.weather} />
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Link href={`/rivers/${river.slug}`} className="flex-1">
                      <Button size="sm" className="w-full gap-1.5 h-8 text-xs">
                        Full Conditions <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                    <Link href={`/share/${river.slug}`} target="_blank">
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                        <Share2 className="h-3 w-3" />Share
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── All rivers ── */}
      {otherRivers.length > 0 && (
        <div>
          <h2 className="font-semibold text-base mb-3">
            {optimalRivers.length > 0 ? 'Other Saved Rivers' : 'Saved Rivers'}
          </h2>
          <div className="space-y-2">
            {otherRivers.map((river) => {
              const status = river.current_condition?.status ?? 'unknown';
              const flow   = river.current_condition?.flow ?? null;
              const { text: outlook, urgent } = smartOutlook(river.eta, river.weather, status);

              return (
                <div
                  key={river.id}
                  className={`bg-white border rounded-xl overflow-hidden border-l-4 ${getStatusBorderColor(status)}`}
                >
                  <div className="p-4 grid grid-cols-1 md:grid-cols-[1.8fr_1fr_2fr_auto] gap-4 items-center">

                    {/* Name + status */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{river.name}</h3>
                        <span className="text-xs text-muted-foreground">{river.region}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`${getStatusColor(status)} text-xs px-2 py-0 rounded-md font-semibold`}>
                          {getStatusLabel(status)}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendIcon trend={river.trend} />
                          <span className="capitalize">{river.trend}</span>
                        </div>
                        {river.angler_rating && (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border ${ANGLER_BADGE[river.angler_rating.label]}`}>
                            <Fish className="h-2.5 w-2.5" />
                            {river.angler_rating.label.charAt(0).toUpperCase() + river.angler_rating.label.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Flow + weather strip */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-base">{formatFlow(flow)}</span>
                        {river.optimal_flow_min && river.optimal_flow_max && (
                          <span className="text-xs text-muted-foreground">
                            / {river.optimal_flow_min}–{river.optimal_flow_max}
                          </span>
                        )}
                      </div>
                      {river.weather && <WeatherStripCompact forecast={river.weather} />}
                    </div>

                    {/* Smart outlook */}
                    <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 border ${
                      urgent
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-secondary border-border text-muted-foreground'
                    }`}>
                      {urgent
                        ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                        : <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      }
                      <span className="leading-relaxed">{outlook}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 md:flex-col md:items-end">
                      <Link href={`/rivers/${river.slug}`}>
                        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
                          Details <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                      <Link href={`/share/${river.slug}`} target="_blank">
                        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-muted-foreground">
                          <Share2 className="h-3 w-3" />Share
                        </Button>
                      </Link>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-8 text-center">
        Weather via Open-Meteo · Gauge data via USGS · Flow outlook based on 24h trend
      </p>
    </div>
  );
}
