import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { FlowTrend } from '@/lib/types/database';
import { cn } from '@/lib/utils';

interface TrendChipProps {
  trend: FlowTrend;
  className?: string;
}

const TREND_CFG: Record<
  FlowTrend,
  { icon: typeof TrendingUp; label: string; color: string }
> = {
  rising: {
    icon: TrendingUp,
    label: 'Rising',
    color: 'hsl(var(--status-elevated))',
  },
  falling: {
    icon: TrendingDown,
    label: 'Falling',
    color: 'hsl(var(--status-low))',
  },
  stable: {
    icon: Minus,
    label: 'Stable',
    color: 'hsl(var(--muted-foreground))',
  },
  unknown: {
    icon: Minus,
    label: 'Unknown',
    color: 'hsl(var(--muted-foreground))',
  },
};

export function TrendChip({ trend, className }: TrendChipProps) {
  const cfg = TREND_CFG[trend] ?? TREND_CFG.unknown;
  const Icon = cfg.icon;
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-xs font-medium', className)}
      style={{ color: cfg.color }}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
