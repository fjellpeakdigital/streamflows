import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchWeatherForecast } from '@/lib/weather';
import { calculateFlowEta } from '@/lib/flow-eta';
import { calculateStatus, getStatusColor, getStatusLabel, formatFlow, formatTemperature } from '@/lib/river-utils';
import WeatherStrip from '@/components/weather-strip';
import { Badge } from '@/components/ui/badge';
import { Droplets, TrendingUp, TrendingDown, Minus, Clock, ExternalLink, Fish } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const ETA_STYLE: Record<string, string> = {
  rising_to_optimal:       'text-emerald-700 bg-emerald-50 border-emerald-200',
  falling_to_optimal:      'text-emerald-700 bg-emerald-50 border-emerald-200',
  leaving_optimal_rising:  'text-amber-700   bg-amber-50   border-amber-200',
  leaving_optimal_falling: 'text-amber-700   bg-amber-50   border-amber-200',
  optimal:                 'text-emerald-700 bg-emerald-50 border-emerald-200',
};

const ANGLER_BADGE: Record<string, string> = {
  poor:      'bg-red-50 text-red-600 border-red-200',
  fair:      'bg-amber-50 text-amber-600 border-amber-200',
  good:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  excellent: 'bg-primary/8 text-primary border-primary/20',
};

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: river } = await supabase.from('rivers').select('*').eq('slug', slug).single();
  if (!river) notFound();

  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const [{ data: conditions }, { data: checkinsRaw }] = await Promise.all([
    supabase
      .from('conditions').select('*').eq('river_id', river.id)
      .gte('timestamp', twentyFourHoursAgo.toISOString())
      .order('timestamp', { ascending: true }),
    supabase
      .from('river_checkins').select('*').eq('river_id', river.id).eq('is_public', true)
      .not('conditions_rating', 'is', null)
      .order('fished_at', { ascending: false }).limit(5),
  ]);

  const sorted = conditions ?? [];
  const current = sorted[sorted.length - 1] ?? null;

  if (current && !current.status) {
    current.status = calculateStatus(current.flow, river.optimal_flow_min, river.optimal_flow_max);
  }

  const eta = calculateFlowEta(sorted, river.optimal_flow_min, river.optimal_flow_max);
  const weather = river.latitude && river.longitude
    ? await fetchWeatherForecast(river.latitude, river.longitude)
    : null;

  // Angler rating from last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentRatings = (checkinsRaw ?? []).filter(
    (c) => new Date(c.fished_at) >= sevenDaysAgo
  );
  const SCORE: Record<string, number> = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const LABEL = ['poor', 'poor', 'fair', 'good', 'excellent'];
  let anglerRating: { label: string; count: number } | null = null;
  if (recentRatings.length > 0) {
    const total = recentRatings.reduce((s, c) => s + (SCORE[c.conditions_rating] ?? 0), 0);
    anglerRating = { label: LABEL[Math.round(total / recentRatings.length)], count: recentRatings.length };
  }

  const status = current?.status ?? 'unknown';

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header */}
      <div className="border-b border-border/60 bg-white/90 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm">Stream<span className="text-primary">Flows</span></span>
        </div>
        <Link
          href={`/rivers/${slug}`}
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
        >
          Full details <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

        {/* River name + status */}
        <div>
          <h1 className="text-2xl font-bold leading-tight mb-1">{river.name}</h1>
          <p className="text-sm text-muted-foreground mb-3">{river.region}</p>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${getStatusColor(status)} text-sm px-3 py-1 font-semibold`}>
              {getStatusLabel(status)}
            </Badge>
            {anglerRating && (
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full border ${ANGLER_BADGE[anglerRating.label] ?? ANGLER_BADGE.fair}`}>
                <Fish className="h-3.5 w-3.5" />
                Anglers say: {anglerRating.label}
              </span>
            )}
          </div>
        </div>

        {/* Current conditions */}
        <div className="bg-white border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary rounded-xl px-4 py-3">
              <div className="text-xs text-muted-foreground mb-1">Flow</div>
              <div className="text-2xl font-bold">{formatFlow(current?.flow ?? null)}</div>
              {river.optimal_flow_min && river.optimal_flow_max && (
                <div className="text-xs text-muted-foreground mt-1">
                  Optimal {river.optimal_flow_min}–{river.optimal_flow_max} CFS
                </div>
              )}
            </div>
            <div className="bg-secondary rounded-xl px-4 py-3">
              <div className="text-xs text-muted-foreground mb-1">Temperature</div>
              <div className="text-2xl font-bold">{formatTemperature(current?.temperature ?? null)}</div>
              {current?.trend && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  {current.trend === 'rising'  && <TrendingUp  className="h-3 w-3 text-amber-600" />}
                  {current.trend === 'falling' && <TrendingDown className="h-3 w-3 text-blue-600" />}
                  {current.trend === 'stable'  && <Minus        className="h-3 w-3" />}
                  <span className="capitalize">{current.trend}</span>
                </div>
              )}
            </div>
          </div>

          {/* ETA */}
          {eta.label && (
            <div className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border ${ETA_STYLE[eta.type] ?? ''}`}>
              <Clock className="h-4 w-4 shrink-0" />
              {eta.label}
            </div>
          )}

          {current?.timestamp && (
            <p className="text-xs text-muted-foreground">
              Gauge data updated {formatDistanceToNow(new Date(current.timestamp), { addSuffix: true })}
            </p>
          )}
        </div>

        {/* Weather */}
        {weather && (
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold mb-3">5-Day Upstream Rain Forecast</h2>
            <WeatherStrip forecast={weather} variant="full" />
          </div>
        )}

        {/* Recent reports */}
        {(checkinsRaw ?? []).length > 0 && (
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold mb-3">Recent Trip Reports</h2>
            <div className="space-y-3">
              {checkinsRaw!.slice(0, 3).map((c) => (
                <div key={c.id} className="text-sm border-b border-border/50 last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ANGLER_BADGE[c.conditions_rating] ?? ANGLER_BADGE.fair}`}>
                      {c.conditions_rating.charAt(0).toUpperCase() + c.conditions_rating.slice(1)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.fished_at), { addSuffix: true })}
                    </span>
                  </div>
                  {c.flies_working && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Flies: </span>{c.flies_working}
                    </p>
                  )}
                  {c.notes && <p className="text-xs text-muted-foreground mt-0.5">{c.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer CTA */}
        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground mb-3">
            Shared via StreamFlows · Live USGS gauge data for New England fly fishing
          </p>
          <Link
            href={`/rivers/${slug}`}
            className="text-sm text-primary hover:underline font-medium"
          >
            See full conditions + 24h chart →
          </Link>
        </div>

      </div>
    </div>
  );
}
