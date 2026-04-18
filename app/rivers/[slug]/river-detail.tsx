'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import CheckinForm from '@/components/checkin-form';
import CheckinFeed from '@/components/checkin-feed';
import WeatherStrip from '@/components/weather-strip';
import { HatchEditorDrawer } from '@/components/hatch-editor-drawer';
import { isHatchActive } from '@/lib/hatch-utils';
import type {
  CheckInWithMeta,
  Condition,
  FlowTrend,
  HatchEvent,
  River,
  RiverSpecies,
  UserNote,
} from '@/lib/types/database';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  ReferenceArea,
} from 'recharts';
import {
  getStatusColor,
  getStatusLabel,
  formatFlow,
  formatTemperature,
} from '@/lib/river-utils';
import { calculateFlowEta } from '@/lib/flow-eta';
import { interpretConditions } from '@/lib/conditions-interpreter';
import { ConditionsSummaryCard } from '@/components/conditions-summary';
import type { NWMForecast, NWMForecastPoint } from '@/lib/nwm-forecast';
import type { WeatherForecast } from '@/lib/weather';
import type { HistoricalFlow } from '@/lib/usgs-historical';
import { OptimalRangeEditor } from '@/components/optimal-range-editor';
import {
  Heart,
  CalendarPlus,
  ArrowLeft,
  MapPin,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Fish,
  Waves,
  Thermometer,
  Gauge,
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatMonthDay(month: number | null, day: number | null): string | null {
  if (month == null || day == null) return null;
  return `${MONTH_SHORT[month - 1]} ${day}`;
}

function summarizeForecast(
  points: Array<{ timestamp: string; flow: number }>,
  optimalMin: number | null,
  optimalMax: number | null
): string {
  if (!points.length) return 'Forecast data unavailable.';

  const withStatus = points.map((p) => {
    const d = new Date(p.timestamp);
    const flow = p.flow;
    let status: 'low' | 'optimal' | 'elevated' | 'high' | 'unknown' = 'unknown';
    if (optimalMin != null && optimalMax != null) {
      if (flow < optimalMin) status = 'low';
      else if (flow <= optimalMax) status = 'optimal';
      else if (flow <= optimalMax * 1.5) status = 'elevated';
      else status = 'high';
    }
    return { date: d, status };
  });

  const optimalDays = Array.from(
    new Set(
      withStatus
        .filter((p) => p.status === 'optimal')
        .map((p) => format(p.date, 'MMM d'))
    )
  );

  if (optimalDays.length > 0) {
    if (optimalDays.length === 1) return `Forecast shows optimal conditions ${optimalDays[0]}.`;
    return `Forecast shows optimal conditions ${optimalDays[0]}–${optimalDays[optimalDays.length - 1]}.`;
  }

  const statuses = new Set(withStatus.map((p) => p.status));
  if (statuses.has('high')) return 'Expected to run high through the forecast window.';
  if (statuses.has('elevated')) return 'Expected to remain elevated through the forecast window.';
  if (statuses.has('low')) return 'Expected to stay low through the forecast window.';
  return 'Forecast trend unclear — check the chart for details.';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'rising')
    return <TrendingUp  className="h-5 w-5 text-amber-600" aria-label="Rising" />;
  if (trend === 'falling')
    return <TrendingDown className="h-5 w-5 text-blue-600"  aria-label="Falling" />;
  return <Minus className="h-5 w-5 text-muted-foreground"   aria-label="Stable" />;
}

/**
 * Return a concise flood stage context string for the gage height cell.
 * All values are in feet. Returns null if there is insufficient data to say
 * anything meaningful.
 */
function floodStageSubtext(
  gageHeight: number | null | undefined,
  actionStage: number | null | undefined,
  floodStage: number | null | undefined,
  moderateFloodStage: number | null | undefined,
  majorFloodStage: number | null | undefined,
): string | null {
  if (gageHeight == null) return null;

  if (majorFloodStage != null && gageHeight >= majorFloodStage) {
    return `Major flood stage (${majorFloodStage.toFixed(1)} ft)`;
  }
  if (moderateFloodStage != null && gageHeight >= moderateFloodStage) {
    return `Moderate flood stage (${moderateFloodStage.toFixed(1)} ft)`;
  }
  if (floodStage != null && gageHeight >= floodStage) {
    return `Flood stage (${floodStage.toFixed(1)} ft)`;
  }
  if (actionStage != null && gageHeight >= actionStage) {
    return `Action stage reached (${actionStage.toFixed(1)} ft)`;
  }
  if (floodStage != null) {
    const below = (floodStage - gageHeight).toFixed(1);
    return `${below} ft below flood stage`;
  }
  if (actionStage != null) {
    const below = (actionStage - gageHeight).toFixed(1);
    return `${below} ft below action stage`;
  }
  return null;
}

interface Toast {
  type: 'success' | 'error';
  message: string;
}

type RiverCheckin = CheckInWithMeta & { is_own: boolean };

interface RiverChartPoint {
  time: string;
  flow: number | null;
  temp: number | null;
}

interface RiverDetailData extends River {
  current_condition: Condition | null;
  conditions: Condition[];
  species: RiverSpecies[];
  is_favorite: boolean;
  user_note: UserNote | null;
  trend: FlowTrend | 'unknown';
  user: User | null;
  checkins: RiverCheckin[];
  eta: ReturnType<typeof calculateFlowEta>;
  weather: WeatherForecast | null;
  historical_last_year: HistoricalFlow | null;
  historical_two_years_ago: HistoricalFlow | null;
  hatches: HatchEvent[];
  nwmForecast: NWMForecast | null;
  is_in_roster: boolean;
  optimal_flow_min_override: number | null;
  optimal_flow_max_override: number | null;
  optimal_flow_min_global: number | null;
  optimal_flow_max_global: number | null;
}

export function RiverDetail({ riverData }: { riverData: RiverDetailData }) {
  const {
    id, name, region, description, usgs_station_id,
    latitude, longitude, optimal_flow_min, optimal_flow_max,
    action_stage, flood_stage, moderate_flood_stage, major_flood_stage,
    cwms_location_id, cwms_office, cwms_location_kind,
    reservoir_pool_ft, reservoir_release_cfs, reservoir_updated_at,
    current_condition, conditions, species, is_favorite, user_note, trend, user,
    checkins: initialCheckins = [],
    eta, weather,
    historical_last_year, historical_two_years_ago,
    hatches = [],
    nwmForecast = null,
    is_in_roster = false,
    optimal_flow_min_override = null,
    optimal_flow_max_override = null,
    optimal_flow_min_global = null,
    optimal_flow_max_global = null,
  } = riverData;

  const router = useRouter();
  const [isFavorite, setIsFavorite]       = useState(is_favorite);
  const [note, setNote]                   = useState(user_note?.note || '');
  const [isSavingNote, setIsSavingNote]   = useState(false);
  const [toast, setToast]                 = useState<Toast | null>(null);
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [checkins, setCheckins]           = useState<RiverCheckin[]>(initialCheckins);
  const [hatchList, setHatchList]         = useState<HatchEvent[]>(hatches as HatchEvent[]);
  const [hatchDrawer, setHatchDrawer]     = useState<
    | { mode: 'closed' }
    | { mode: 'create' }
    | { mode: 'edit'; entry: HatchEvent }
  >({ mode: 'closed' });
  const [hatchBusyId, setHatchBusyId]     = useState<string | null>(null);

  const status = current_condition?.status || 'low';
  const etaLabel = calculateFlowEta(conditions ?? [], optimal_flow_min, optimal_flow_max).label;

  const interpretation = interpretConditions({
    flow:                current_condition?.flow ?? null,
    temperature:         current_condition?.temperature ?? null,
    status:              current_condition?.status ?? null,
    trend:               trend ?? null,
    optimalMin:          optimal_flow_min,
    optimalMax:          optimal_flow_max,
    cwmsLocationKind:    cwms_location_kind ?? null,
    reservoirReleaseCfs: reservoir_release_cfs ?? null,
    reservoirPoolFt:     reservoir_pool_ft ?? null,
  });

  const handleHatchSaved = (saved: HatchEvent) => {
    setHatchList((prev) => {
      const idx = prev.findIndex((h) => h.id === saved.id);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setHatchDrawer({ mode: 'closed' });
  };

  const handleHatchDeleted = (deletedId: string) => {
    setHatchList((prev) => prev.filter((h) => h.id !== deletedId));
    setHatchDrawer({ mode: 'closed' });
  };

  const handleCustomizeHatch = async (seed: HatchEvent) => {
    setHatchBusyId(seed.id);
    try {
      const res = await fetch('/api/hatches/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_hatch_id: seed.id }),
      });
      if (!res.ok) return;
      const cloned = (await res.json()) as HatchEvent;
      setHatchList((prev) => [cloned, ...prev]);
      setHatchDrawer({ mode: 'edit', entry: cloned });
    } finally {
      setHatchBusyId(null);
    }
  };

  const handleDeleteHatch = async (hatchId: string) => {
    if (!confirm('Delete this hatch?')) return;
    setHatchBusyId(hatchId);
    try {
      const res = await fetch('/api/hatches', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: hatchId }),
      });
      if (res.ok) handleHatchDeleted(hatchId);
    } finally {
      setHatchBusyId(null);
    }
  };

  // Hide seed rows that the user has already customized.
  const visibleHatches = (() => {
    const clonedSeedIds = new Set(
      hatchList
        .filter((h) => h.user_id !== null && h.source_hatch_id != null)
        .map((h) => h.source_hatch_id as string)
    );
    return hatchList.filter((h) => !(h.user_id === null && clonedSeedIds.has(h.id)));
  })();

  const chartData: RiverChartPoint[] = conditions.map((c) => ({
    time: format(new Date(c.timestamp), 'HH:mm'),
    flow: c.flow,
    temp: c.temperature,
  }));

  const showToast = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 3500);
  };

  const handleToggleFavorite = async () => {
    if (!user) { router.push('/login'); return; }
    try {
      const res = await fetch('/api/favorites', {
        method: isFavorite ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ river_id: id }),
      });
      if (res.ok) setIsFavorite((f: boolean) => !f);
    } catch { /* silent */ }
  };

  const handleSaveNote = async () => {
    if (!user) { router.push('/login'); return; }
    setIsSavingNote(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          river_id: id,
          note,
          flow_at_save: current_condition?.flow ?? null,
          temp_at_save: current_condition?.temperature ?? null,
        }),
      });
      if (res.ok) {
        showToast({ type: 'success', message: 'Note saved successfully.' });
      } else {
        showToast({ type: 'error', message: 'Failed to save note. Try again.' });
      }
    } catch {
      showToast({ type: 'error', message: 'An error occurred.' });
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">

      {/* Toast notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`
            fixed bottom-20 right-5 md:bottom-5 z-50 flex items-center gap-3 px-4 py-3
            rounded-xl shadow-lg text-sm font-medium border
            ${toast.type === 'success'
              ? 'bg-emerald-600 border-emerald-500 text-white'
              : 'bg-red-600 border-red-500 text-white'}
          `}
        >
          {toast.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <AlertCircle   className="h-4 w-4 shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Back link */}
      <Link href="/rivers">
        <Button variant="ghost" size="sm" className="mb-5 gap-2 text-muted-foreground hover:text-foreground -ml-2">
          <ArrowLeft className="h-4 w-4" />
          All Rivers
        </Button>
      </Link>

      <div className="grid lg:grid-cols-3 gap-5">

        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Header card */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold leading-tight mb-1">{name}</h1>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />{region}
                    </span>
                    <span className="text-muted-foreground/60">&middot;</span>
                    <span>USGS {usgs_station_id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {user && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() =>
                        router.push(
                          `/trips?river_id=${encodeURIComponent(id)}&river_name=${encodeURIComponent(name)}`
                        )
                      }
                    >
                      <CalendarPlus className="h-4 w-4" />
                      Plan a Trip
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleToggleFavorite}
                    aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
                  >
                    <Heart className={`h-5 w-5 transition-colors ${
                      isFavorite ? 'fill-primary text-primary' : 'text-muted-foreground hover:text-primary'
                    }`} />
                  </Button>
                </div>
              </div>

              {description && (
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{description}</p>
              )}

              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <Badge className={`${getStatusColor(status)} px-3 py-1 text-sm font-semibold`}>
                  {getStatusLabel(status)}
                </Badge>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <TrendIcon trend={trend} />
                  <span className="capitalize">{trend}</span>
                </div>
                {eta?.label && (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${
                    ['rising_to_optimal','falling_to_optimal','optimal'].includes(eta.type)
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-amber-700 bg-amber-50 border-amber-200'
                  }`}>
                    <Clock className="h-3 w-3" />
                    {eta.label}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Conditions interpretation */}
          <ConditionsSummaryCard interpretation={interpretation} />

          {/* Current conditions */}
          <Card>
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-base font-semibold">Current Conditions</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {etaLabel && !nwmForecast && (
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                  <Clock className="h-4 w-4" />
                  {etaLabel}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    icon: Waves,
                    label: 'Flow',
                    value: formatFlow(current_condition?.flow ?? null),
                    // Optimal range moved to its own row below the tiles so the
                    // per-user override editor has room to expand inline.
                    sub: null,
                    subVariant: 'muted' as const,
                  },
                  {
                    icon: Thermometer,
                    label: 'Temperature',
                    value: formatTemperature(current_condition?.temperature ?? null),
                    sub: null,
                    subVariant: 'muted' as const,
                  },
                  {
                    icon: Gauge,
                    label: 'Gage Height',
                    value: current_condition?.gage_height
                      ? `${current_condition.gage_height.toFixed(2)} ft`
                      : 'N/A',
                    sub: floodStageSubtext(
                      current_condition?.gage_height,
                      action_stage,
                      flood_stage,
                      moderate_flood_stage,
                      major_flood_stage,
                    ),
                    subVariant: (() => {
                      const h = current_condition?.gage_height;
                      if (h == null) return 'muted' as const;
                      if (flood_stage != null && h >= flood_stage) return 'danger' as const;
                      if (action_stage != null && h >= action_stage) return 'warning' as const;
                      return 'muted' as const;
                    })(),
                  },
                ].map(({ icon: Icon, label, value, sub, subVariant }) => (
                  <div key={label} className="bg-secondary rounded-xl px-3 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </div>
                    <div className="text-xl font-bold">{value}</div>
                    {sub && (
                      <div className={cn('text-xs mt-0.5', {
                        'text-muted-foreground': subVariant === 'muted',
                        'text-amber-600 font-medium': subVariant === 'warning',
                        'text-red-600 font-medium': subVariant === 'danger',
                      })}>
                        {sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Optimal range row — shows current effective range and lets
                  roster users override it per-river. Collapsed by default. */}
              <div className="mt-3">
                <OptimalRangeEditor
                  riverId={id}
                  effectiveMin={optimal_flow_min}
                  effectiveMax={optimal_flow_max}
                  globalMin={optimal_flow_min_global}
                  globalMax={optimal_flow_max_global}
                  hasOverride={
                    optimal_flow_min_override != null ||
                    optimal_flow_max_override != null
                  }
                  isInRoster={is_in_roster}
                />
              </div>

              {current_condition && (() => {
                const ts = new Date(current_condition.timestamp);
                const hoursOld = differenceInHours(new Date(), ts);
                const isStale = hoursOld >= 2;
                return (
                  <div className={cn(
                    'flex items-center gap-1.5 text-xs mt-3',
                    isStale ? 'text-amber-600 font-medium' : 'text-muted-foreground'
                  )}>
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {isStale
                        ? `Data from ${formatDistanceToNow(ts, { addSuffix: true })} — may not reflect current conditions`
                        : `Updated ${format(ts, 'MMM d, h:mm a')}`}
                    </span>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Reservoir / dam panel — PROJECT rivers only */}
          {cwms_location_kind === 'PROJECT' && cwms_location_id && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-base font-semibold">Dam / Reservoir</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  USACE {cwms_office} · {cwms_location_id}
                </p>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary rounded-xl px-3 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Waves className="h-3.5 w-3.5" />
                      Pool Elevation
                    </div>
                    <div className="text-xl font-bold">
                      {reservoir_pool_ft != null
                        ? `${reservoir_pool_ft.toFixed(1)} ft`
                        : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">NGVD</div>
                  </div>
                  <div className="bg-secondary rounded-xl px-3 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Gauge className="h-3.5 w-3.5" />
                      Release Rate
                    </div>
                    <div className="text-xl font-bold">
                      {reservoir_release_cfs != null
                        ? formatFlow(reservoir_release_cfs)
                        : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">outflow</div>
                  </div>
                </div>
                {reservoir_updated_at && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
                    <Clock className="h-3.5 w-3.5" />
                    Updated {format(new Date(reservoir_updated_at), 'MMM d, yyyy h:mm a')}
                  </div>
                )}
                {!reservoir_updated_at && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Reservoir data fetched hourly — check back soon.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Historical flows */}
          {(historical_last_year || historical_two_years_ago) && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-base font-semibold">Historical Flows</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-2">
                {historical_last_year && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">This date last year</span>
                    <span className="font-semibold">
                      {historical_last_year.flow !== null
                        ? formatFlow(historical_last_year.flow)
                        : 'No data'}
                    </span>
                  </div>
                )}
                {historical_two_years_ago && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Two years ago</span>
                    <span className="font-semibold">
                      {historical_two_years_ago.flow !== null
                        ? formatFlow(historical_two_years_ago.flow)
                        : 'No data'}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 5-day NWM forecast */}
          {nwmForecast && nwmForecast.mediumRange.length > 0 && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-base font-semibold">5-Day Forecast</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  NOAA National Water Model · reach {nwmForecast.reachId}
                </p>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                <p className="text-sm font-medium">
                  {summarizeForecast(
                    nwmForecast.mediumRange,
                    optimal_flow_min,
                    optimal_flow_max
                  )}
                </p>
                <div className="w-full h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {(() => {
                      const flows = nwmForecast.mediumRange.map((p: NWMForecastPoint) => p.flow);
                      const maxFromData = flows.length > 0 ? Math.max(...flows) : 0;
                      const maxFromOptimal = optimal_flow_max != null ? optimal_flow_max * 1.5 : 0;
                      const yMax = Math.max(maxFromData, maxFromOptimal);
                      return (
                        <AreaChart
                          data={nwmForecast.mediumRange.map((p: NWMForecastPoint) => ({
                            label: format(new Date(p.timestamp), 'MMM d'),
                            time: new Date(p.timestamp).getTime(),
                            flow: p.flow,
                          }))}
                          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="label"
                            stroke="#6b7280"
                            fontSize={11}
                            tickLine={false}
                            interval="preserveStartEnd"
                            minTickGap={24}
                          />
                          <YAxis
                            stroke="#6b7280"
                            fontSize={11}
                            tickLine={false}
                            width={48}
                            domain={[0, yMax]}
                            label={{ value: 'CFS', angle: -90, position: 'insideLeft', offset: 8, fontSize: 10, fill: '#6b7280' }}
                          />
                          <Tooltip
                            formatter={(value) => [value != null ? `${Math.round(value as number).toLocaleString()} CFS` : 'N/A', 'Flow']}
                            labelStyle={{ color: '#111827' }}
                          />
                          {optimal_flow_min != null && optimal_flow_max != null && (
                            <ReferenceArea
                              y1={optimal_flow_min}
                              y2={optimal_flow_max}
                              fill="#10b981"
                              fillOpacity={0.15}
                              stroke="#10b981"
                              strokeOpacity={0.3}
                              ifOverflow="extendDomain"
                              label={{
                                value: 'Optimal',
                                position: 'insideTopRight',
                                fill: '#059669',
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                            />
                          )}
                          <Area
                            type="monotone"
                            dataKey="flow"
                            stroke="#2563eb"
                            strokeWidth={2}
                            fill="#2563eb"
                            fillOpacity={0.15}
                          />
                        </AreaChart>
                      );
                    })()}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hatches & Species */}
          {(species.length > 0 || visibleHatches.length > 0 || user) && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-base font-semibold">Hatches & Species</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-5">
                {species.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Species
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {species.map((s) => (
                        <Badge key={s.id} variant="secondary" className="text-xs">
                          <Fish className="h-3 w-3 mr-1" />
                          {s.species.charAt(0).toUpperCase() + s.species.slice(1)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Hatch calendar
                    </p>
                    {user && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => setHatchDrawer({ mode: 'create' })}
                      >
                        + Add
                      </Button>
                    )}
                  </div>
                  {visibleHatches.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No hatches recorded yet.
                      {user && ' Use + Add to capture what comes off this river.'}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {visibleHatches.map((h) => {
                        const active = isHatchActive(h, new Date());
                        const range = `${formatMonthDay(h.start_month, h.start_day)} – ${formatMonthDay(h.end_month, h.end_day)}`;
                        const peakStart = formatMonthDay(h.peak_start_month, h.peak_start_day);
                        const peakEnd = formatMonthDay(h.peak_end_month, h.peak_end_day);
                        const peak = peakStart && peakEnd ? `${peakStart} – ${peakEnd}` : null;
                        const isCustom = h.user_id != null;
                        const isSeed = h.user_id == null;
                        const subLabel = [h.stage, h.time_of_day].filter(Boolean).join(' · ');
                        const busy = hatchBusyId === h.id;
                        return (
                          <li
                            key={h.id}
                            className={`rounded-lg border border-border bg-card px-3 py-2 ${active ? 'border-l-4 border-l-emerald-500' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm">{h.insect}</span>
                                  {subLabel && (
                                    <span className="text-xs text-muted-foreground">{subLabel}</span>
                                  )}
                                  <span className="text-xs text-muted-foreground">{range}</span>
                                  {active && (
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] px-1.5 py-0">
                                      Active
                                    </Badge>
                                  )}
                                  {isCustom && h.source_hatch_id && (
                                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0">
                                      Customized
                                    </Badge>
                                  )}
                                </div>
                                {peak && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Peak: {peak}
                                  </p>
                                )}
                                {h.temp_trigger != null && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Starts ~{h.temp_trigger}°F
                                  </p>
                                )}
                                {h.fly_patterns && (
                                  <p className="text-xs mt-1">
                                    <span className="font-medium text-foreground">Flies: </span>
                                    <span className="text-muted-foreground">{h.fly_patterns}</span>
                                  </p>
                                )}
                                {h.notes && (
                                  <p className="text-xs text-foreground/80 mt-1">{h.notes}</p>
                                )}
                              </div>
                              {user && (
                                <div className="flex items-center gap-1 shrink-0">
                                  {isSeed && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={busy}
                                      className="h-7 px-2 text-xs"
                                      onClick={() => handleCustomizeHatch(h)}
                                    >
                                      Copy
                                    </Button>
                                  )}
                                  {isCustom && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={busy}
                                        className="h-7 px-2 text-xs"
                                        onClick={() => setHatchDrawer({ mode: 'edit', entry: h })}
                                      >
                                        Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={busy}
                                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                                        onClick={() => handleDeleteHatch(h.id)}
                                      >
                                        {h.source_hatch_id ? 'Reset' : 'Delete'}
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 24-hour chart */}
          <Card>
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-base font-semibold">24-Hour Flow Chart</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: 'hsl(220,12%,50%)' }}
                    interval="preserveStartEnd"
                    axisLine={{ stroke: 'hsl(220,15%,88%)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(220,12%,50%)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid hsl(220,15%,88%)',
                      borderRadius: '8px',
                      color: 'hsl(220,30%,18%)',
                      fontSize: 12,
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}
                    itemStyle={{ color: 'hsl(220,30%,18%)' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: 'hsl(220,12%,50%)', paddingTop: 8 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="flow"
                    name="Flow (CFS)"
                    stroke="hsl(200,65%,38%)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: 'hsl(200,65%,38%)' }}
                  />
                  {chartData.some((d) => d.temp !== null) && (
                    <Line
                      type="monotone"
                      dataKey="temp"
                      name="Temp (°F)"
                      stroke="hsl(155,30%,42%)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'hsl(155,30%,42%)' }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Guide notes */}
          {user && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-base font-semibold">My Notes</CardTitle>
                {user_note && (user_note.flow_at_save != null || user_note.temp_at_save != null) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {[
                      user_note.updated_at
                        ? format(new Date(user_note.updated_at), 'MMM d')
                        : null,
                      user_note.flow_at_save != null ? formatFlow(user_note.flow_at_save) : null,
                      user_note.temp_at_save != null ? formatTemperature(user_note.temp_at_save) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add fishing notes, tips, or observations for this river…"
                  className="min-h-[110px] mb-3 resize-none"
                />
                <Button onClick={handleSaveNote} disabled={isSavingNote} size="sm">
                  {isSavingNote ? 'Saving…' : 'Save Note'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Trip Reports */}
          <Card>
            <CardHeader className="pb-2 px-5 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Trip Reports</CardTitle>
                {!showCheckinForm && (
                  <Button
                    size="sm"
                    variant={user ? 'default' : 'outline'}
                    onClick={() => {
                      if (!user) { router.push('/login'); return; }
                      setShowCheckinForm(true);
                    }}
                    className="gap-1.5"
                  >
                    <Fish className="h-3.5 w-3.5" />
                    Log a Trip
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              {showCheckinForm && (
                <CheckinForm
                  riverId={id}
                  onCancel={() => setShowCheckinForm(false)}
                  onSuccess={(newCheckin) => {
                    setCheckins((prev) => [newCheckin, ...prev]);
                    setShowCheckinForm(false);
                    showToast({ type: 'success', message: 'Trip logged! Thanks for the report.' });
                  }}
                />
              )}
              <CheckinFeed
                checkins={checkins}
                riverId={id}
                onDelete={(idToDelete) => {
                  setCheckins((prev) => prev.filter((checkin) => checkin.id !== idToDelete));
                }}
              />
            </CardContent>
          </Card>

        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-5">

          {/* Species */}
          {species.length > 0 && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Fish className="h-4 w-4 text-primary" />
                  Species
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="flex flex-wrap gap-2">
                  {species.map((s) => (
                    <Badge key={s.id} variant="secondary" className="capitalize">
                      {s.species}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location */}
          {latitude && longitude && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-2 text-sm">
                <div className="text-muted-foreground">
                  {latitude}, {longitude}
                </div>
                <a
                  href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="gap-2 w-full mt-1">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in Maps
                  </Button>
                </a>
              </CardContent>
            </Card>
          )}

          {/* Weather forecast */}
          {weather && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-base font-semibold">5-Day Rain Forecast</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <WeatherStrip forecast={weather} variant="full" />
              </CardContent>
            </Card>
          )}

          {/* Resources */}
          <Card>
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-base font-semibold">Resources</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-2">
              <a
                href={`https://waterdata.usgs.gov/monitoring-location/${usgs_station_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <ExternalLink className="h-3.5 w-3.5" />
                  USGS Station Data
                </Button>
              </a>
              <a href={`/share/${riverData?.slug}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Share Conditions
                </Button>
              </a>
            </CardContent>
          </Card>

        </div>
      </div>

      {user && hatchDrawer.mode !== 'closed' && (
        <HatchEditorDrawer
          rivers={[{ id, name }]}
          entry={hatchDrawer.mode === 'edit' ? hatchDrawer.entry : null}
          defaultRiverId={id}
          onClose={() => setHatchDrawer({ mode: 'closed' })}
          onSaved={handleHatchSaved}
          onDeleted={handleHatchDeleted}
        />
      )}
    </div>
  );
}
