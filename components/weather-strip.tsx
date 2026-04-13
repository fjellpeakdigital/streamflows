import type { WeatherForecast } from '@/lib/weather';
import { CloudRain, Sun } from 'lucide-react';

interface WeatherStripProps {
  forecast: WeatherForecast;
  /** 'compact' = small strip for dashboard rows; 'full' = sidebar card */
  variant?: 'compact' | 'full';
}

function precipColor(pct: number) {
  if (pct >= 70) return 'bg-blue-500';
  if (pct >= 40) return 'bg-blue-400';
  if (pct >= 20) return 'bg-blue-300';
  return 'bg-blue-200';
}

function precipTextColor(pct: number) {
  if (pct >= 40) return 'text-blue-700';
  return 'text-muted-foreground';
}

export default function WeatherStrip({ forecast, variant = 'compact' }: WeatherStripProps) {
  if (!forecast?.days?.length) return null;

  if (variant === 'compact') {
    return (
      <div className="flex items-end gap-1" title={forecast.summary}>
        {forecast.days.map((day) => (
          <div key={day.date} className="flex flex-col items-center gap-0.5 w-7">
            <span className={`text-[9px] font-medium ${precipTextColor(day.precipPct)}`}>
              {day.precipPct > 0 ? `${day.precipPct}%` : ''}
            </span>
            <div className="w-4 bg-secondary rounded-sm overflow-hidden h-8 flex items-end">
              <div
                className={`w-full rounded-sm transition-all ${precipColor(day.precipPct)}`}
                style={{ height: `${Math.max(4, day.precipPct)}%` }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground leading-none">{day.dayLabel.slice(0, 3)}</span>
          </div>
        ))}
      </div>
    );
  }

  // Full variant for sidebar
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {forecast.hasRain
          ? <CloudRain className="h-3.5 w-3.5 text-blue-500" />
          : <Sun className="h-3.5 w-3.5 text-amber-500" />
        }
        <span className="text-xs">{forecast.summary}</span>
      </div>

      <div className="flex items-end gap-2">
        {forecast.days.map((day) => (
          <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
            <span className={`text-[10px] font-medium ${precipTextColor(day.precipPct)}`}>
              {day.precipPct > 0 ? `${day.precipPct}%` : '—'}
            </span>
            <div className="w-full bg-secondary rounded-sm overflow-hidden h-12 flex items-end">
              <div
                className={`w-full rounded-sm ${precipColor(day.precipPct)}`}
                style={{ height: `${Math.max(4, day.precipPct)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground leading-none font-medium">
              {day.dayLabel.slice(0, 3)}
            </span>
            {day.precipMm > 0 && (
              <span className="text-[9px] text-blue-600 leading-none">{day.precipMm}mm</span>
            )}
          </div>
        ))}
      </div>

      {forecast.hasRain && (
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Rain upstream may raise flows 12–48h after precipitation.
        </p>
      )}
    </div>
  );
}
