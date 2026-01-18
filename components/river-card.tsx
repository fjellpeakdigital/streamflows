'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RiverWithCondition } from '@/lib/types/database';
import {
  getStatusColor,
  getStatusLabel,
  formatFlow,
  formatTemperature,
  getTrendIcon,
} from '@/lib/river-utils';
import { Heart } from 'lucide-react';

interface RiverCardProps {
  river: RiverWithCondition;
  onToggleFavorite?: (riverId: string) => void;
  showFavorite?: boolean;
}

export function RiverCard({
  river,
  onToggleFavorite,
  showFavorite = false,
}: RiverCardProps) {
  const condition = river.current_condition;
  const status = condition?.status || 'low';
  const trend = river.trend || 'stable';

  return (
    <Link href={`/rivers/${river.slug}`}>
      <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-1">
                {river.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {river.region}
              </p>
            </div>
            {showFavorite && onToggleFavorite && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  onToggleFavorite(river.id);
                }}
              >
                <Heart
                  className={`h-5 w-5 ${
                    river.is_favorite
                      ? 'fill-primary text-primary'
                      : 'text-muted-foreground'
                  }`}
                />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(status)}>
              {getStatusLabel(status)}
            </Badge>
            <span className="text-lg">{getTrendIcon(trend)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">Flow</div>
              <div className="font-semibold">
                {formatFlow(condition?.flow || null)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Temp</div>
              <div className="font-semibold">
                {formatTemperature(condition?.temperature || null)}
              </div>
            </div>
          </div>

          {river.optimal_flow_min && river.optimal_flow_max && (
            <div className="text-xs text-muted-foreground">
              Optimal: {river.optimal_flow_min}-{river.optimal_flow_max} CFS
            </div>
          )}

          {river.species && river.species.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {river.species.slice(0, 3).map((s) => (
                <Badge key={s.id} variant="outline" className="text-xs">
                  {s.species}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
