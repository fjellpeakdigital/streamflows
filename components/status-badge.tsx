import { cn } from '@/lib/utils';
import { RiverStatus } from '@/lib/types/database';
import { getStatusLabel } from '@/lib/river-utils';

interface StatusBadgeProps {
  status: RiverStatus;
  size?: 'sm' | 'md';
  className?: string;
}

const STATUS_STYLES: Record<RiverStatus, { dot: string; bg: string; text: string }> = {
  optimal: {
    dot: 'hsl(var(--status-optimal))',
    bg: 'hsl(var(--status-optimal) / 0.12)',
    text: 'hsl(148 45% 22%)',
  },
  elevated: {
    dot: 'hsl(var(--status-elevated))',
    bg: 'hsl(var(--status-elevated) / 0.12)',
    text: 'hsl(28 75% 30%)',
  },
  high: {
    dot: 'hsl(var(--status-high))',
    bg: 'hsl(var(--status-high) / 0.12)',
    text: 'hsl(8 62% 30%)',
  },
  low: {
    dot: 'hsl(var(--status-low))',
    bg: 'hsl(var(--status-low) / 0.12)',
    text: 'hsl(208 45% 28%)',
  },
  ice_affected: {
    dot: 'hsl(var(--muted-foreground))',
    bg: 'hsl(var(--muted))',
    text: 'hsl(var(--muted-foreground))',
  },
  no_data: {
    dot: 'hsl(var(--muted-foreground))',
    bg: 'hsl(var(--muted))',
    text: 'hsl(var(--muted-foreground))',
  },
  unknown: {
    dot: 'hsl(var(--muted-foreground))',
    bg: 'hsl(var(--muted))',
    text: 'hsl(var(--muted-foreground))',
  },
};

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const styles = STATUS_STYLES[status] ?? STATUS_STYLES.unknown;
  const isSmall = size === 'sm';

  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md font-semibold',
        isSmall ? 'gap-1 px-1.5 py-px text-[10px]' : 'gap-1.5 px-2.5 py-0.5 text-[11px]',
        className
      )}
      style={{
        background: styles.bg,
        color: styles.text,
        letterSpacing: '0.02em',
      }}
    >
      <span
        aria-hidden="true"
        className="rounded-full"
        style={{
          width: 6,
          height: 6,
          background: styles.dot,
          flexShrink: 0,
        }}
      />
      {getStatusLabel(status)}
    </span>
  );
}

/** Hex-ish HSL string usable as an SVG stroke/fill. Falls back to muted. */
export function getStatusDotCssColor(status: RiverStatus): string {
  return (STATUS_STYLES[status] ?? STATUS_STYLES.unknown).dot;
}
