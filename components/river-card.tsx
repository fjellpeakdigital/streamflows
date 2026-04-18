'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Condition, RiverWithCondition } from '@/lib/types/database';
import {
  getStatusColor,
  getStatusLabel,
  getStatusBorderColor,
  formatFlow,
  formatTemperature,
} from '@/lib/river-utils';
import { calculateFlowEta } from '@/lib/flow-eta';
import { Heart, TrendingUp, TrendingDown, Minus, Thermometer, Waves, Clock, Fish } from 'lucide-react';

const ANGLER_BADGE: Record<string, string> = {
  poor:      'bg-red-50     text-red-600     border-red-200',
  fair:      'bg-amber-50   text-amber-600   border-amber-200',
  good:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  excellent: 'bg-primary/8  text-primary     border-primary/20',
};

interface RiverCardProps {
  river: RiverWithCondition;
  onToggleFavorite?: (riverId: string) => void;
  showFavorite?: boolean;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'rising')  return <TrendingUp  className="h-4 w-4 text-amber-600" aria-label="Rising" />;
  if (trend === 'falling') return <TrendingDown className="h-4 w-4 text-blue-600"  aria-label="Falling" />;
  return <Minus className="h-4 w-4 text-muted-foreground" aria-label="Stable" />;
}

export function RiverCard({
  river,
  onToggleFavorite,
  showFavorite = false,
}: RiverCardProps) {
  const condition = river.current_condition;
  const status = condition?.status || 'low';
  const trend = river.trend || 'stable';
  const anglerRating = river.angler_rating;
  const gaugeNotResponding = river.no_usable_data_72h ?? false;
  const conditionsHistory = (
    river as RiverWithCondition & { conditions?: Condition[] }
  ).conditions;
  const etaLabel = conditionsHistory
    ? calculateFlowEta(conditionsHistory, river.optimal_flow_min, river.optimal_flow_max).label
    : '';
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <Link href={`/rivers/${river.slug}`} className="group block h-full">
      <Card className={`
        hover-lift h-full overflow-hidden
        border-border bg-white hover:border-primary/30
        border-l-4 ${getStatusBorderColor(status)}
      `}>
        <CardContent className="p-4 space-y-3">

          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors line-clamp-1">
                {river.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">{river.region}</p>
            </div>

            {showFavorite && onToggleFavorite && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 -mt-1 -mr-1 h-8 w-8"
                onClick={(e) => {
                  e.preventDefault();
                  onToggleFavorite(river.id);
                }}
                aria-label={river.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  className={`h-4 w-4 transition-colors ${
                    river.is_favorite
                      ? 'fill-primary text-primary'
                      : 'text-muted-foreground hover:text-primary'
                  }`}
                />
              </Button>
            )}
          </div>

          {/* Status + trend */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${getStatusColor(status)} text-xs px-2 py-0.5 rounded-md font-semibold`}>
              {getStatusLabel(status)}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendIcon trend={trend} />
              <span className="capitalize">{trend}</span>
            </div>
            {anglerRating && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border ${ANGLER_BADGE[anglerRating.label] ?? ANGLER_BADGE.fair}`}
                title={`${anglerRating.count} angler report${anglerRating.count !== 1 ? 's' : ''} in the last 7 days`}
              >
                <Fish className="h-2.5 w-2.5" />
                {anglerRating.label.charAt(0).toUpperCase() + anglerRating.label.slice(1)}
              </span>
            )}
          </div>

          {etaLabel && (
            <div className="flex items-center gap-1 text-xs font-medium text-primary">
              <Clock className="h-3 w-3" />
              {etaLabel}
            </div>
          )}

          {gaugeNotResponding && (
            <p className="text-xs font-medium text-muted-foreground">
              Gauge isn&apos;t responding. No usable readings in 72h.
            </p>
          )}

          {/* Flow + Temp stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-secondary rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                <Waves className="h-3 w-3" />
                Flow
              </div>
              <div className="font-semibold text-sm text-foreground">
                {formatFlow(condition?.flow ?? null)}
              </div>
            </div>
            <div className="bg-secondary rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                <Thermometer className="h-3 w-3" />
                Temp
              </div>
              <div className="font-semibold text-sm text-foreground">
                {formatTemperature(condition?.temperature ?? null)}
              </div>
            </div>
          </div>

          {/* Optimal range */}
          {river.optimal_flow_min && river.optimal_flow_max && (
            <p className="text-xs text-muted-foreground">
              Optimal: {river.optimal_flow_min}–{river.optimal_flow_max} CFS
            </p>
          )}

          {/* Species badges */}
          {river.species && river.species.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {river.species.slice(0, 3).map((s) => (
                <Badge key={s.id} variant="secondary" className="text-xs px-2 py-0">
                  {s.species}
                </Badge>
              ))}
              {river.species.length > 3 && (
                <Badge variant="secondary" className="text-xs px-2 py-0">
                  +{river.species.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Last updated timestamp */}
          {condition?.timestamp && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 pt-1 border-t border-border/50">
              <Clock className="h-2.5 w-2.5" />
              <span>
                {(() => {
                  const age = now - new Date(condition.timestamp).getTime();
                  const mins = Math.floor(age / 60000);
                  if (mins < 60) return `${mins}m ago`;
                  const hours = Math.floor(mins / 60);
                  if (hours < 24) return `${hours}h ago`;
                  const days = Math.floor(hours / 24);
                  return `${days}d ago`;
                })()}
              </span>
            </div>
          )}

        </CardContent>
      </Card>
    </Link>
  );
}
