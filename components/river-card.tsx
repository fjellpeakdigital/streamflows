'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RiverWithCondition } from '@/lib/types/database';
import {
  getStatusColor,
  getStatusLabel,
  getStatusBorderColor,
  formatFlow,
  formatTemperature,
} from '@/lib/river-utils';
import { Heart, TrendingUp, TrendingDown, Minus, Thermometer, Waves } from 'lucide-react';

interface RiverCardProps {
  river: RiverWithCondition;
  onToggleFavorite?: (riverId: string) => void;
  showFavorite?: boolean;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'rising')  return <TrendingUp  className="h-4 w-4 text-amber-400" aria-label="Rising" />;
  if (trend === 'falling') return <TrendingDown className="h-4 w-4 text-blue-400"  aria-label="Falling" />;
  return <Minus className="h-4 w-4 text-muted-foreground" aria-label="Stable" />;
}

export function RiverCard({
  river,
  onToggleFavorite,
  showFavorite = false,
}: RiverCardProps) {
  const condition = river.current_condition;
  const status = condition?.status || 'unknown';
  const trend = river.trend || 'stable';

  return (
    <Link href={`/rivers/${river.slug}`} className="group block h-full">
      <Card className={`
        h-full overflow-hidden transition-all duration-200
        hover:shadow-lg hover:shadow-black/30 hover:-translate-y-0.5
        border-border bg-card
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
          <div className="flex items-center gap-2">
            <Badge className={`${getStatusColor(status)} text-xs px-2 py-0.5 rounded-md font-semibold`}>
              {getStatusLabel(status)}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendIcon trend={trend} />
              <span className="capitalize">{trend}</span>
            </div>
          </div>

          {/* Flow + Temp stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-secondary/40 rounded-md px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                <Waves className="h-3 w-3" />
                Flow
              </div>
              <div className="font-semibold text-sm text-foreground">
                {formatFlow(condition?.flow ?? null)}
              </div>
            </div>
            <div className="bg-secondary/40 rounded-md px-3 py-2">
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

        </CardContent>
      </Card>
    </Link>
  );
}
