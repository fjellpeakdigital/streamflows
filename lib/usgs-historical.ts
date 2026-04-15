export interface HistoricalFlow {
  date: string;
  flow: number | null;
}

/**
 * Fetch the USGS daily-value (DV) flow (parameter 00060, CFS) for a single date.
 * Best-effort: returns { date, flow: null } on any failure so callers can render a fallback.
 */
export async function fetchHistoricalFlow(
  stationId: string,
  date: string
): Promise<HistoricalFlow | null> {
  const url = `https://waterservices.usgs.gov/nwis/dv/?format=json&sites=${encodeURIComponent(
    stationId
  )}&startDT=${date}&endDT=${date}&parameterCd=00060`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const body = await res.json();
    const series = body?.value?.timeSeries?.[0];
    const values = series?.values?.[0]?.value ?? [];
    const raw = values[0]?.value;
    if (raw == null) return { date, flow: null };

    const flow = Number(raw);
    if (!Number.isFinite(flow) || flow <= -999000) return { date, flow: null };

    return { date, flow };
  } catch {
    return null;
  }
}
