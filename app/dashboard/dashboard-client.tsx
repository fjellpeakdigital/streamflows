'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import WeatherStrip from '@/components/weather-strip';
import {
  getStatusColor, getStatusLabel, getStatusBorderColor, formatFlow,
} from '@/lib/river-utils';
import type { FlowEta } from '@/lib/flow-eta';
import type { WeatherForecast } from '@/lib/weather';
import {
  TrendingUp, TrendingDown, Minus, ArrowRight, Share2,
  MapPin, Fish, Clock, Droplets, LayoutDashboard,
} from 'lucide-react';
import { format } from 'date-fns';

const ANGLER_BADGE: Record<string, string> = {
  poor:      'bg-red-50 text-red-600 border-red-200',
  fair:      'bg-amber-50 text-amber-600 border-amber-200',
  good:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  excellent: 'bg-primary/8 text-primary border-primary/20',
};

const ETA_STYLE: Record<string, string> = {
  rising_to_optimal:       'text-emerald-700 bg-emerald-50 border-emerald-200',
  falling_to_optimal:      'text-emerald-700 bg-emerald-50 border-emerald-200',
  leaving_optimal_rising:  'text-amber-700   bg-amber-50   border-amber-200',
  leaving_optimal_falling: 'text-amber-700   bg-amber-50   border-amber-200',
  optimal:                 'text-emerald-700 bg-emerald-50 border-emerald-200',
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'rising')  return <TrendingUp  className="h-3.5 w-3.5 text-amber-600" />;
  if (trend === 'falling') return <TrendingDown className="h-3.5 w-3.5 text-blue-600" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

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

export function GuideDashboard({ rivers, user }: { rivers: DashboardRiver[]; user: any }) {
  if (rivers.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-2xl font-bold mb-2">Guide Dashboard</h1>
        <p className="text-muted-foreground mb-6">
          Save rivers to your favorites to see them here with weather forecasts and flow ETAs.
        </p>
        <Link href="/rivers">
          <Button>Browse Rivers</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Guide Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {rivers.length} saved river{rivers.length !== 1 ? 's' : ''} · Updated {format(new Date(), 'MMM d, h:mm a')}
          </p>
        </div>
        <Link href="/rivers">
          <Button variant="outline" size="sm" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            All Rivers
          </Button>
        </Link>
      </div>

      {/* River cards */}
      <div className="space-y-3">
        {rivers.map((river) => {
          const status = river.current_condition?.status ?? 'unknown';
          const flow = river.current_condition?.flow ?? null;

          return (
            <div
              key={river.id}
              className={`
                bg-white border border-border rounded-2xl overflow-hidden shadow-sm
                border-l-4 ${getStatusBorderColor(status)}
              `}
            >
              {/* Main row */}
              <div className="p-4 grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center">

                {/* River name + status */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-base leading-tight">{river.name}</h2>
                    <span className="text-xs text-muted-foreground">{river.region}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`${getStatusColor(status)} text-xs px-2 py-0 rounded-md font-semibold`}>
                      {getStatusLabel(status)}
                    </Badge>
                    {river.angler_rating && (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border ${ANGLER_BADGE[river.angler_rating.label] ?? ANGLER_BADGE.fair}`}>
                        <Fish className="h-2.5 w-2.5" />
                        {river.angler_rating.label.charAt(0).toUpperCase() + river.angler_rating.label.slice(1)}
                        <span className="opacity-60">({river.angler_rating.count})</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Flow + trend */}
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Droplets className="h-3 w-3" />Flow
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-lg leading-none">{formatFlow(flow)}</span>
                    <TrendIcon trend={river.trend} />
                  </div>
                  {river.optimal_flow_min && river.optimal_flow_max && (
                    <div className="text-xs text-muted-foreground">
                      Optimal {river.optimal_flow_min}–{river.optimal_flow_max}
                    </div>
                  )}
                </div>

                {/* Flow ETA */}
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />Outlook
                  </div>
                  {river.eta.label ? (
                    <span className={`inline-block text-xs font-medium px-2 py-1 rounded-lg border ${ETA_STYLE[river.eta.type] ?? 'text-muted-foreground bg-secondary border-border'}`}>
                      {river.eta.label}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  {river.current_condition?.timestamp && (
                    <div className="text-[10px] text-muted-foreground/70">
                      Updated {format(new Date(river.current_condition.timestamp), 'h:mm a')}
                    </div>
                  )}
                </div>

                {/* Weather strip */}
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">5-Day Rain</div>
                  {river.weather ? (
                    <WeatherStrip forecast={river.weather} variant="compact" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No location data</span>
                  )}
                  {river.weather?.hasRain && (
                    <p className="text-[10px] text-blue-600 leading-tight">
                      {river.weather.summary}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 lg:flex-col lg:items-end">
                  <Link href={`/rivers/${river.slug}`}>
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
                      Details <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                  <Link href={`/share/${river.slug}`} target="_blank">
                    <Button size="sm" variant="ghost" className="gap-1.5 h-8 text-xs text-muted-foreground">
                      <Share2 className="h-3 w-3" />
                      Share
                    </Button>
                  </Link>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-6 text-center">
        Weather from Open-Meteo · Gauge data from USGS · Flow outlook based on current trend
      </p>
    </div>
  );
}
