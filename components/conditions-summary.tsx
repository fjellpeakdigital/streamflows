'use client';

import { Waves, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConditionsInterpretation, ConditionRating, SignalSentiment, SignalCategory } from '@/lib/conditions-interpreter';

// ── Rating badge ───────────────────────────────────────────────────────────────

const RATING_STYLES: Record<ConditionRating, { badge: string; border: string; bg: string }> = {
  excellent: { badge: 'bg-emerald-600 text-white', border: 'border-emerald-200', bg: 'bg-emerald-50' },
  good:      { badge: 'bg-teal-600 text-white',    border: 'border-teal-200',    bg: 'bg-teal-50'    },
  fair:      { badge: 'bg-amber-500 text-white',   border: 'border-amber-200',   bg: 'bg-amber-50'   },
  poor:      { badge: 'bg-red-600 text-white',     border: 'border-red-200',     bg: 'bg-red-50'     },
  warning:   { badge: 'bg-red-700 text-white',     border: 'border-red-300',     bg: 'bg-red-50'     },
};

const RATING_LABEL: Record<ConditionRating, string> = {
  excellent: 'Prime',
  good:      'Good',
  fair:      'Fair',
  poor:      'Tough',
  warning:   'Advisory',
};

// ── Signal row ─────────────────────────────────────────────────────────────────

const SENTIMENT_DOT: Record<SignalSentiment, string> = {
  positive: 'bg-emerald-500',
  neutral:  'bg-gray-400',
  caution:  'bg-amber-500',
  negative: 'bg-red-500',
};

const CATEGORY_ICON: Record<SignalCategory, typeof Waves> = {
  current: Waves,
  outlook: Clock,
  safety:  AlertTriangle,
};

// ── Component ──────────────────────────────────────────────────────────────────

export function ConditionsSummaryCard({
  interpretation,
}: {
  interpretation: ConditionsInterpretation;
}) {
  const { rating, headline, signals, actionTip } = interpretation;
  const styles = RATING_STYLES[rating];

  return (
    <div className={cn('rounded-xl border p-4', styles.border, styles.bg)}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-foreground leading-snug flex-1">
          {headline}
        </p>
        <span className={cn('shrink-0 text-xs font-bold px-2.5 py-1 rounded-full', styles.badge)}>
          {RATING_LABEL[rating]}
        </span>
      </div>

      {/* Signals */}
      <div className="space-y-2.5 mb-3">
        {signals.map((signal, i) => {
          const CategoryIcon = CATEGORY_ICON[signal.category];
          return (
            <div key={i} className="flex items-start gap-2.5">
              <CategoryIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', SENTIMENT_DOT[signal.sentiment])} />
                  <span className="text-xs font-semibold text-foreground">{signal.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{signal.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action tip */}
      <div className="flex items-start gap-2 pt-2.5 border-t border-current/10">
        <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0 text-foreground/60" />
        <p className="text-xs text-foreground/80 leading-relaxed">
          <span className="font-semibold">Approach: </span>
          {actionTip}
        </p>
      </div>

    </div>
  );
}
