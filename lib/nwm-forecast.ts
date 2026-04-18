export interface NWMForecastPoint {
  timestamp: string;
  flow: number;
}

export interface NWMForecast {
  reachId: string;
  shortRange: NWMForecastPoint[];
  mediumRange: NWMForecastPoint[];
}

const GAUGE_URL = (id: string) =>
  `https://api.water.noaa.gov/nwps/v1/gauges/${encodeURIComponent(id)}`;
const REACH_FLOW_URL = (reachId: string, series: 'short_range' | 'medium_range') =>
  `https://api.water.noaa.gov/nwps/v1/reaches/${encodeURIComponent(reachId)}/streamflow?series=${series}`;

async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function getObjectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function extractReachId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const raw = getObjectRecord(body)?.reachId;
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  return null;
}

function parseForecastPoints(body: unknown): NWMForecastPoint[] {
  const record = getObjectRecord(body);
  if (!record) return [];
  // NWPS streamflow payloads usually live under `.data` or the series key itself.
  const shortRange = getObjectRecord(record.shortRange);
  const shortRangeSeries = getObjectRecord(shortRange?.series);
  const mediumRange = getObjectRecord(record.mediumRange);
  const mediumRangeMean = getObjectRecord(mediumRange?.mean);
  const series = getObjectRecord(record.series);
  const container =
    (Array.isArray(record.data) && record.data) ||
    (Array.isArray(record.values) && record.values) ||
    (Array.isArray(shortRangeSeries?.data) && shortRangeSeries.data) ||
    (Array.isArray(mediumRangeMean?.data) && mediumRangeMean.data) ||
    (Array.isArray(series?.data) && series.data) ||
    (Array.isArray(body) ? body : null);
  if (!container) return [];

  const out: NWMForecastPoint[] = [];
  for (const raw of container) {
    const rawRecord = getObjectRecord(raw);
    if (!rawRecord) continue;
    const timestamp =
      rawRecord.validTime ?? rawRecord.timestamp ?? rawRecord.time ?? rawRecord.valid_time ?? null;
    const flowRaw = rawRecord.flow ?? rawRecord.value ?? rawRecord.primary ?? null;
    const flow = typeof flowRaw === 'string' ? Number(flowRaw) : flowRaw;
    if (typeof timestamp !== 'string') continue;
    if (typeof flow !== 'number' || !Number.isFinite(flow)) continue;
    out.push({ timestamp, flow });
  }
  return out;
}

export async function resolveNWMReachId(
  usgsStationId: string
): Promise<string | null> {
  const body = await fetchJson(GAUGE_URL(usgsStationId));
  return extractReachId(body);
}

export async function fetchNWMForecast(
  usgsStationId: string
): Promise<NWMForecast | null> {
  const reachId = await resolveNWMReachId(usgsStationId);
  if (!reachId) return null;

  const [shortBody, mediumBody] = await Promise.all([
    fetchJson(REACH_FLOW_URL(reachId, 'short_range')),
    fetchJson(REACH_FLOW_URL(reachId, 'medium_range')),
  ]);

  return {
    reachId,
    shortRange: parseForecastPoints(shortBody),
    mediumRange: parseForecastPoints(mediumBody),
  };
}
