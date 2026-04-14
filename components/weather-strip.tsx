import type { WeatherForecast, DayForecast } from '@/lib/weather';
import { CloudRain, Sun, CloudDrizzle, Zap } from 'lucide-react';

interface WeatherStripProps {
  forecast: WeatherForecast;
  variant?: 'compact' | 'full';
}

function precipIntensity(pct: number, mm: number): 'none' | 'light' | 'moderate' | 'heavy' {
  if (pct < 20) return 'none';
  if (pct < 40 || mm < 5)  return 'light';
  if (pct < 70 || mm < 15) return 'moderate';
  return 'heavy';
}

function DayBar({ day, maxMm }: { day: DayForecast; maxMm: number }) {
  const intensity = precipIntensity(day.precipPct, day.precipMm);
  const barPct    = maxMm > 0 ? Math.max(4, (day.precipMm / maxMm) * 100) : 4;

  const barColor = {
    none:     'bg-slate-200',
    light:    'bg-blue-300',
    moderate: 'bg-blue-500',
    heavy:    'bg-blue-700',
  }[intensity];

  const textColor = {
    none:     'text-muted-foreground',
    light:    'text-blue-500',
    moderate: 'text-blue-600',
    heavy:    'text-blue-800 font-bold',
  }[intensity];

  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      {/* Probability label */}
      <span className={`text-[11px] font-semibold leading-none ${textColor}`}>
        {day.precipPct > 5 ? `${day.precipPct}%` : '—'}
      </span>
      {/* Bar */}
      <div className="w-full bg-slate-100 rounded-md overflow-hidden h-16 flex items-end">
        <div
          className={`w-full rounded-md transition-all ${barColor}`}
          style={{ height: `${barPct}%` }}
        />
      </div>
      {/* mm */}
      <span className={`text-[11px] leading-none ${day.precipMm > 0 ? textColor : 'text-muted-foreground'}`}>
        {day.precipMm > 0 ? `${day.precipMm}mm` : ''}
      </span>
      {/* Day label */}
      <span className="text-[11px] font-medium text-muted-foreground leading-none">
        {day.dayLabel}
      </span>
    </div>
  );
}

// Compact variant — small bars for dashboard rows
export function WeatherStripCompact({ forecast }: { forecast: WeatherForecast }) {
  if (!forecast?.days?.length) return null;
  const maxMm = Math.max(...forecast.days.map((d) => d.precipMm), 1);

  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-1.5">
        {forecast.days.map((day) => {
          const intensity = precipIntensity(day.precipPct, day.precipMm);
          const barPct = Math.max(4, (day.precipMm / maxMm) * 100);
          const barColor = {
            none:     'bg-slate-200',
            light:    'bg-blue-300',
            moderate: 'bg-blue-500',
            heavy:    'bg-blue-700',
          }[intensity];

          return (
            <div key={day.date} className="flex flex-col items-center gap-0.5 flex-1">
              <span className={`text-[9px] leading-none font-medium ${day.precipPct > 20 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                {day.precipPct > 5 ? `${day.precipPct}%` : ''}
              </span>
              <div className="w-full bg-slate-100 rounded-sm overflow-hidden h-8 flex items-end">
                <div className={`w-full rounded-sm ${barColor}`} style={{ height: `${barPct}%` }} />
              </div>
              <span className="text-[9px] text-muted-foreground leading-none">{day.dayLabel.slice(0, 3)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Full variant — prominent sidebar/card display
export default function WeatherStrip({ forecast, variant = 'compact' }: WeatherStripProps) {
  if (!forecast?.days?.length) return null;

  if (variant === 'compact') {
    return <WeatherStripCompact forecast={forecast} />;
  }

  const maxMm = Math.max(...forecast.days.map((d) => d.precipMm), 1);
  const heavyRain = forecast.days.some((d) => precipIntensity(d.precipPct, d.precipMm) === 'heavy');
  const modRain   = forecast.days.some((d) => precipIntensity(d.precipPct, d.precipMm) === 'moderate');

  const SummaryIcon = heavyRain ? Zap : modRain ? CloudRain : forecast.hasRain ? CloudDrizzle : Sun;
  const summaryColor = heavyRain
    ? 'bg-blue-950 text-white border-blue-800'
    : modRain
    ? 'bg-blue-800 text-white border-blue-700'
    : forecast.hasRain
    ? 'bg-blue-100 text-blue-800 border-blue-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';

  return (
    <div className="space-y-3">
      {/* Summary callout */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${summaryColor}`}>
        <SummaryIcon className="h-4 w-4 shrink-0" />
        {forecast.summary}
      </div>

      {/* Bars */}
      <div className="flex items-end gap-2">
        {forecast.days.map((day) => (
          <DayBar key={day.date} day={day} maxMm={maxMm} />
        ))}
      </div>

      {forecast.hasRain && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Rain upstream typically raises flows 12–48h after precipitation,
          depending on watershed size.
        </p>
      )}
    </div>
  );
}
