import { format, parseISO } from 'date-fns';

export interface DayForecast {
  date: string;       // "2024-04-13"
  dayLabel: string;   // "Mon"
  precipMm: number;   // total precipitation in mm
  precipPct: number;  // max probability 0-100
}

export interface WeatherForecast {
  days: DayForecast[];
  /** True if any day in the window has ≥40% rain probability */
  hasRain: boolean;
  /** Human-readable upstream outlook, e.g. "Rain expected Wed–Thu" */
  summary: string;
  /** Total precipitation over the past 3 days in mm */
  recentPrecipMm: number;
}

export async function fetchWeatherForecast(
  lat: number,
  lon: number,
  days = 5
): Promise<WeatherForecast | null> {
  try {
    // past_days=3 gives us 3 days of observed precip for ungauged river context
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&daily=precipitation_sum,precipitation_probability_max` +
      `&forecast_days=${days}&past_days=3&timezone=auto`;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    clearTimeout(t);

    if (!res.ok) return null;
    const json = await res.json();

    const times: string[]  = json.daily?.time ?? [];
    const precip: number[] = json.daily?.precipitation_sum ?? [];
    const prob: number[]   = json.daily?.precipitation_probability_max ?? [];

    const todayStr = new Date().toISOString().slice(0, 10);

    // Split into past (observed) and forecast (today + future) buckets
    let recentPrecipMm = 0;
    const forecast: DayForecast[] = [];

    times.forEach((date, i) => {
      if (date < todayStr) {
        // Past days — accumulate observed precip
        recentPrecipMm += precip[i] ?? 0;
      } else {
        // Today and forward — include in the forecast strip
        forecast.push({
          date,
          dayLabel: date === todayStr ? 'Today' : format(parseISO(date), 'EEE'),
          precipMm:  Math.round((precip[i] ?? 0) * 10) / 10,
          precipPct: Math.round(prob[i] ?? 0),
        });
      }
    });

    recentPrecipMm = Math.round(recentPrecipMm * 10) / 10;

    // Build a plain-English summary of rainy days
    const rainDays = forecast.filter((d) => d.precipPct >= 40);
    let summary = 'Dry week ahead';
    if (rainDays.length === 1) {
      summary = `Rain expected ${rainDays[0].dayLabel}`;
    } else if (rainDays.length >= 2) {
      summary = `Rain expected ${rainDays[0].dayLabel}–${rainDays[rainDays.length - 1].dayLabel}`;
    }

    return { days: forecast, hasRain: rainDays.length > 0, summary, recentPrecipMm };
  } catch {
    return null;
  }
}

/**
 * Fetch weather for multiple rivers in parallel (max 5 concurrent).
 * Returns a Map of river_id → WeatherForecast | null.
 */
export async function fetchWeatherForRivers(
  rivers: Array<{ id: string; latitude: number | null; longitude: number | null }>
): Promise<Map<string, WeatherForecast | null>> {
  const results = new Map<string, WeatherForecast | null>();
  const eligible = rivers.filter((r) => r.latitude && r.longitude);

  // Process in batches of 5 to avoid hammering the API
  const BATCH = 5;
  for (let i = 0; i < eligible.length; i += BATCH) {
    const batch = eligible.slice(i, i + BATCH);
    const fetches = batch.map((r) =>
      fetchWeatherForecast(r.latitude!, r.longitude!).then((w) => ({ id: r.id, w }))
    );
    const settled = await Promise.all(fetches);
    for (const { id, w } of settled) results.set(id, w);
  }

  return results;
}
