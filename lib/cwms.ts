/**
 * USACE CWMS (Corps Water Management System) Data API utilities.
 *
 * API base: https://cwms-data.usace.army.mil/cwms-data
 * Swagger:  https://cwms-data.usace.army.mil/cwms-data/swagger-ui.html
 *
 * Two responsibilities:
 *  1. Fetch location lists per CWMS office district (for discovery / populate).
 *  2. Fetch time series data for specific locations (for hourly cron).
 *
 * Time series IDs follow the convention:
 *   {LOCATION_ID}.{PARAMETER}.{PARAM_TYPE}.{INTERVAL}.{DURATION}.{VERSION}
 *   e.g. "TLD.Elev.Inst.1Hour.0.raw"   — Tully Dam pool elevation
 *        "TLD.Flow-Out.Inst.1Hour.0.raw" — Tully Dam release rate
 *        "FRN.Stage.Inst.1Hour.0.raw"   — Merrimack @ Franklin stage
 *
 * Quality codes:
 *   0            — good / screened
 *   > 100 000    — missing / estimated — treat as null
 */

const CWMS_BASE = 'https://cwms-data.usace.army.mil/cwms-data';

// ── Shared JSON fetch helper ───────────────────────────────────────────────────

async function fetchJson(
  url: string,
  timeoutMs = 20_000,
  accept = '*/*'
): Promise<unknown> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: accept },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(t);
    return null;
  }
}

// ── Location catalogue ─────────────────────────────────────────────────────────

export interface CwmsLocation {
  name: string;
  officeId: string;
  latitude: number | null;
  longitude: number | null;
  locationKind: string | null;
  stateInitial: string | null;
  description: string | null;
}

function toCoord(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseLocations(body: unknown, office: string): CwmsLocation[] {
  if (!body || typeof body !== 'object') return [];
  const b = body as Record<string, unknown>;

  // Shape 1: { locations: { location: [...] } }
  const v1 = (b as any)?.locations?.location;
  if (Array.isArray(v1)) {
    return v1
      .map((loc: any) => ({
        name: String(loc.name ?? loc['location-id'] ?? ''),
        officeId: String(loc['office-id'] ?? loc.officeId ?? office),
        latitude: toCoord(loc.latitude ?? loc.lat),
        longitude: toCoord(loc.longitude ?? loc.lon),
        locationKind: String(loc['location-kind'] ?? loc.locationKind ?? ''),
        stateInitial: String(loc['state-initial'] ?? loc.stateInitial ?? ''),
        description: loc.description ? String(loc.description) : null,
      }))
      .filter(l => l.name);
  }

  // Shape 2: { entries: [...] }  (CWMS v2 catalog)
  const v2 = (b as any)?.entries;
  if (Array.isArray(v2)) {
    return v2
      .map((entry: any) => ({
        name: String(entry.name ?? entry['location-id'] ?? ''),
        officeId: String(entry.office ?? entry['office-id'] ?? office),
        latitude: toCoord(entry.latitude ?? entry.lat),
        longitude: toCoord(entry.longitude ?? entry.lon),
        locationKind: entry['location-kind'] ?? entry.locationKind ?? null,
        stateInitial: entry['state-initial'] ?? entry.stateInitial ?? null,
        description: entry.description ?? null,
      }))
      .filter(l => l.name);
  }

  // Shape 3: top-level array
  if (Array.isArray(body)) {
    return (body as any[])
      .map((loc: any) => ({
        name: String(loc.name ?? loc['location-id'] ?? ''),
        officeId: String(loc['office-id'] ?? loc.officeId ?? office),
        latitude: toCoord(loc.latitude ?? loc.lat),
        longitude: toCoord(loc.longitude ?? loc.lon),
        locationKind: loc['location-kind'] ?? loc.locationKind ?? null,
        stateInitial: loc['state-initial'] ?? loc.stateInitial ?? null,
        description: loc.description ?? null,
      }))
      .filter(l => l.name);
  }

  return [];
}

/**
 * Fetch all locations for a single CWMS office.
 * Returns an empty array on network error or non-200 response.
 */
export async function fetchCwmsLocations(
  office: string,
  timeoutMs = 20_000
): Promise<{ locations: CwmsLocation[]; error: string | null }> {
  const url = `${CWMS_BASE}/locations?office=${encodeURIComponent(office)}&pageSize=5000`;
  const body = await fetchJson(url, timeoutMs, 'application/json;version=2');
  if (!body) {
    return { locations: [], error: `No response from CWMS for office ${office}` };
  }
  const locations = parseLocations(body, office);
  return { locations, error: null };
}

// ── Time series ────────────────────────────────────────────────────────────────

export interface TsReading {
  timestamp: Date;
  value: number;
}

/**
 * Parse a CWMS timeseries response body into an array of {timestamp, value} pairs.
 * Skips entries where quality_code > 100_000 (missing / estimated).
 */
function parseTsValues(body: unknown): TsReading[] {
  if (!body || typeof body !== 'object') return [];
  const b = body as Record<string, unknown>;

  // Locate the values array — try several known shapes
  let rawValues: unknown[] | null = null;

  // Shape A: { values: [[epoch_ms, val, qc], ...] }
  if (Array.isArray((b as any).values)) {
    rawValues = (b as any).values;
  }

  // Shape B: { regular-interval-values: { values: [...] } }
  const riv = (b as any)['regular-interval-values'];
  if (!rawValues && riv && Array.isArray(riv.values)) {
    rawValues = riv.values;
  }

  // Shape C: { irregular-interval-values: { values: [...] } }
  const iiv = (b as any)['irregular-interval-values'];
  if (!rawValues && iiv && Array.isArray(iiv.values)) {
    rawValues = iiv.values;
  }

  // Shape D: nested entry array
  const entry = (b as any)?.['time-series']?.entry;
  if (!rawValues && Array.isArray(entry) && entry.length > 0) {
    const nested = entry[0];
    const nriv = nested?.['regular-interval-values'];
    const niiv = nested?.['irregular-interval-values'];
    if (nriv && Array.isArray(nriv.values)) rawValues = nriv.values;
    else if (niiv && Array.isArray(niiv.values)) rawValues = niiv.values;
  }

  if (!rawValues) return [];

  const readings: TsReading[] = [];
  for (const row of rawValues) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const epochMs = Number(row[0]);
    const val = row[1] === null ? NaN : Number(row[1]);
    const qc = Number(row[2] ?? 0);
    if (!Number.isFinite(epochMs) || !Number.isFinite(val)) continue;
    if (qc > 100_000) continue; // missing / estimated
    readings.push({ timestamp: new Date(epochMs), value: val });
  }
  return readings;
}

/**
 * Fetch the most recent value for a specific CWMS time series ID.
 *
 * @param tsid  Full time series ID, e.g. "TLD.Elev.Inst.1Hour.0.raw"
 * @param office CWMS office code, e.g. "NAE"
 * @returns The most recent reading, or null if unavailable.
 */
export async function fetchLatestTsValue(
  tsid: string,
  office: string
): Promise<TsReading | null> {
  const end = new Date();
  const begin = new Date(end.getTime() - 6 * 60 * 60 * 1000); // 6 hours back

  const url =
    `${CWMS_BASE}/timeseries` +
    `?name=${encodeURIComponent(tsid)}` +
    `&office=${encodeURIComponent(office)}` +
    `&begin=${begin.toISOString()}` +
    `&end=${end.toISOString()}` +
    `&format=json`;

  const body = await fetchJson(url, 10_000);
  if (!body) return null;

  const readings = parseTsValues(body);
  if (readings.length === 0) return null;

  // Return the most recent non-null reading
  return readings[readings.length - 1];
}

// ── Reservoir data ─────────────────────────────────────────────────────────────

export interface ReservoirData {
  poolElevationFt: number | null;
  releaseCfs: number | null;
  /** Which TSID succeeded for pool elevation (for debugging) */
  poolTsid: string | null;
  /** Which TSID succeeded for release (for debugging) */
  releaseTsid: string | null;
}

// Parameter name candidates to try, in priority order
const POOL_PARAMS = [
  'Elev.Inst.1Hour.0.raw',
  'Elev.Inst.15Minutes.0.raw',
  'Elev-Pool.Inst.1Hour.0.raw',
  'Elev-Pool.Inst.15Minutes.0.raw',
  'Elev.Ave.1Hour.0.raw',
];

const RELEASE_PARAMS = [
  'Flow-Out.Inst.1Hour.0.raw',
  'Flow-Out.Inst.15Minutes.0.raw',
  'Flow.Inst.1Hour.0.raw',
  'Flow.Inst.15Minutes.0.raw',
  'Flow-Out.Ave.1Hour.0.raw',
];

async function tryParams(
  locationId: string,
  office: string,
  params: string[]
): Promise<{ value: number; tsid: string } | null> {
  for (const param of params) {
    const tsid = `${locationId}.${param}`;
    const reading = await fetchLatestTsValue(tsid, office);
    if (reading !== null) {
      return { value: reading.value, tsid };
    }
  }
  return null;
}

/**
 * Fetch current reservoir pool elevation and release rate for a USACE PROJECT location.
 * Tries multiple TSID parameter variations and returns the first that has data.
 */
export async function fetchReservoirData(
  locationId: string,
  office: string
): Promise<ReservoirData> {
  const [poolResult, releaseResult] = await Promise.all([
    tryParams(locationId, office, POOL_PARAMS),
    tryParams(locationId, office, RELEASE_PARAMS),
  ]);

  return {
    poolElevationFt: poolResult?.value ?? null,
    releaseCfs: releaseResult?.value ?? null,
    poolTsid: poolResult?.tsid ?? null,
    releaseTsid: releaseResult?.tsid ?? null,
  };
}

// ── Distance helper ────────────────────────────────────────────────────────────

const DEG_TO_MILES = 69;

export function haversineApproxMiles(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const dLat = lat1 - lat2;
  const dLon = (lon1 - lon2) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.sqrt(dLat * dLat + dLon * dLon) * DEG_TO_MILES;
}
