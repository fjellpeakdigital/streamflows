'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Globe, Lock } from 'lucide-react';
import type { FishingRating } from '@/lib/types/database';

interface CheckinEntry {
  id: string;
  user_id: string;
  fished_at: string;
  conditions_rating: FishingRating;
  flow_confirmed: string;
  species_caught: string[] | null;
  flies_working: string | null;
  notes: string | null;
  is_public: boolean;
  is_own: boolean;
  display_name: string;
}

interface CheckinFeedProps {
  initialCheckins: CheckinEntry[];
  riverId: string;
}

const RATING_STYLES: Record<FishingRating, { label: string; badge: string }> = {
  poor:      { label: 'Poor',      badge: 'bg-red-100 text-red-700 border-red-200' },
  fair:      { label: 'Fair',      badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  good:      { label: 'Good',      badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  excellent: { label: 'Excellent', badge: 'bg-primary/10 text-primary border-primary/20' },
};

const FLOW_LABELS: Record<string, string> = {
  accurate:   'Gauge looked accurate',
  inaccurate: 'Gauge seemed off',
  unsure:     '',
};

export default function CheckinFeed({ initialCheckins, riverId }: CheckinFeedProps) {
  const [checkins, setCheckins] = useState<CheckinEntry[]>(initialCheckins);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch('/api/checkins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setCheckins((prev) => prev.filter((c) => c.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  if (checkins.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No trip reports yet — be the first to log one.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {checkins.map((c) => {
        const style = RATING_STYLES[c.conditions_rating] ?? RATING_STYLES.fair;
        const flowNote = FLOW_LABELS[c.flow_confirmed] ?? '';
        const date = formatDistanceToNow(new Date(c.fished_at), { addSuffix: true });

        return (
          <div key={c.id} className="bg-white border border-border rounded-xl p-4 shadow-sm">
            {/* Top row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${style.badge}`}>
                  {style.label}
                </span>
                <span className="text-xs text-muted-foreground">{date}</span>
                {flowNote && (
                  <span className="text-xs text-muted-foreground">· {flowNote}</span>
                )}
                {c.is_own && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    · {c.is_public
                      ? <><Globe className="h-3 w-3" /> Public</>
                      : <><Lock className="h-3 w-3" /> Private</>
                    }
                  </span>
                )}
              </div>
              {c.is_own && (
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  className="text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                  title="Delete this check-in"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Species */}
            {c.species_caught && c.species_caught.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {c.species_caught.map((s) => (
                  <span key={s} className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
            )}

            {/* Flies */}
            {c.flies_working && (
              <p className="text-sm mb-1.5">
                <span className="font-medium text-foreground">Flies: </span>
                <span className="text-muted-foreground">{c.flies_working}</span>
              </p>
            )}

            {/* Notes */}
            {c.notes && (
              <p className="text-sm text-muted-foreground leading-relaxed">{c.notes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
