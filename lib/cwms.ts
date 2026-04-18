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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function parseLocations(body: unknown, office: string): CwmsLocation[] {
  if (!body || typeof body !== 'object') return [];
  const b = body as Record<string, unknown>;

  // Shape 1: { locations: { location: [...] } }
  const locationsRecord = asRecord(b.locations);
  const v1 = locationsRecord?.location;
  if (Array.isArray(v1)) {
    return v1
      .map((loc) => {
        const locRecord = asRecord(loc);
        return {
          name: String(locRecord?.name ?? locRecord?.['location-id'] ?? ''),
          officeId: String(locRecord?.['office-id'] ?? locRecord?.officeId ?? office),
          latitude: toCoord(locRecord?.latitude ?? locRecord?.lat),
          longitude: toCoord(locRecord?.longitude ?? locRecord?.lon),
          locationKind: String(locRecord?.['location-kind'] ?? locRecord?.locationKind ?? ''),
          stateInitial: String(locRecord?.['state-initial'] ?? locRecord?.stateInitial ?? ''),
          description: locRecord?.description ? String(locRecord.description) : null,
        };
      })
      .filter(l => l.name);
  }

  // Shape 2: { entries: [...] }  (CWMS v2 catalog)
  const v2 = b.entries;
  if (Array.isArray(v2)) {
    return v2
      .map((entry) => {
        const entryRecord = asRecord(entry);
        return {
          name: String(entryRecord?.name ?? entryRecord?.['location-id'] ?? ''),
          officeId: String(entryRecord?.office ?? entryRecord?.['office-id'] ?? office),
          latitude: toCoord(entryRecord?.latitude ?? entryRecord?.lat),
          longitude: toCoord(entryRecord?.longitude ?? entryRecord?.lon),
          locationKind: typeof entryRecord?.['location-kind'] === 'string'
            ? entryRecord['location-kind']
            : typeof entryRecord?.locationKind === 'string'
              ? entryRecord.locationKind
              : null,
          stateInitial: typeof entryRecord?.['state-initial'] === 'string'
            ? entryRecord['state-initial']
            : typeof entryRecord?.stateInitial === 'string'
              ? entryRecord.stateInitial
              : null,
          description: entryRecord?.description ? String(entryRecord.description) : null,
        };
      })
      .filter(l => l.name);
  }

  // Shape 3: top-level array
  if (Array.isArray(body)) {
    return body
      .map((loc) => {
        const locRecord = asRecord(loc);
        return {
          name: String(locRecord?.name ?? locRecord?.['location-id'] ?? ''),
          officeId: String(locRecord?.['office-id'] ?? locRecord?.officeId ?? office),
          latitude: toCoord(locRecord?.latitude ?? locRecord?.lat),
          longitude: toCoord(locRecord?.longitude ?? locRecord?.lon),
          locationKind: typeof locRecord?.['location-kind'] === 'string'
            ? locRecord['location-kind']
            : typeof locRecord?.locationKind === 'string'
              ? locRecord.locationKind
              : null,
          stateInitial: typeof locRecord?.['state-initial'] === 'string'
            ? locRecord['state-initial']
            : typeof locRecord?.stateInitial === 'string'
              ? locRecord.stateInitial
              : null,
          description: locRecord?.description ? String(locRecord.description) : null,
        };
      })
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
  if (Array.isArray(b.values)) {
    rawValues = b.values;
  }

  // Shape B: { regular-interval-values: { values: [...] } }
  const riv = asRecord(b['regular-interval-values']);
  if (!rawValues && riv && Array.isArray(riv.values)) {
    rawValues = riv.values;
  }

  // Shape C: { irregular-interval-values: { values: [...] } }
  const iiv = asRecord(b['irregular-interval-values']);
  if (!rawValues && iiv && Array.isArray(iiv.values)) {
    rawValues = iiv.values;
  }

  // Shape D: nested entry array
  const timeSeries = asRecord(b['time-series']);
  const entry = timeSeries?.entry;
  if (!rawValues && Array.isArray(entry) && entry.length > 0) {
    const nested = asRecord(entry[0]);
    const nriv = asRecord(nested?.['regular-interval-values']);
    const niiv = asRecord(nested?.['irregular-interval-values']);
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
  const begin = new Date(end.getTime() - 24 * 60 * 60 * 1000); // 24 hours back

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

// ── Reservoir data (catalog-first approach) ────────────────────────────────────
//
// CWMS TSID naming and units vary by office/dam — we cannot assume a fixed
// parameter pattern. Instead we:
//   1. Query /catalog/TIMESERIES for the location to discover actual TSIDs.
//   2. Score each entry as a pool-elevation or release-flow candidate.
//   3. Fetch the highest-scoring TSID for each.
//   4. Convert units to imperial (m → ft, cms → CFS).

export interface ReservoirData {
  poolElevationFt: number | null;
  releaseCfs: number | null;
  /** Which TSID succeeded for pool elevation (for debugging) */
  poolTsid: string | null;
  /** Which TSID succeeded for release (for debugging) */
  releaseTsid: string | null;
}

interface TsCatalogEntry {
  name: string;
  units: string;
  interval: string;
}

/** Smaller intervals = more frequent data = higher score */
const INTERVAL_PRIORITY: Record<string, number> = {
  '5Minutes':  6,
  '15Minutes': 5,
  '1Hour':     4,
  '6Hours':    3,
  '12Hours':   2,
  '1Day':      1,
};

/**
 * Score a TSID as a pool-elevation candidate.
 * Returns -1 if disqualified, otherwise a positive score (higher = better).
 */
function scorePoolTsid(name: string, interval: string): number {
  // Piezometer readings (Elev-PZxx) measure embedded instrument pressure, not pool level
  if (/\.Elev-PZ/.test(name)) return -1;
  let score = 0;
  if (name.includes('.Stage-Pool.'))    score += 10;
  else if (/\.Elev\./.test(name))       score += 8;
  else return -1;
  if (name.endsWith('DCP-rev'))         score += 3;
  else if (name.endsWith('DCP-raw'))    score += 1;
  score += (INTERVAL_PRIORITY[interval] ?? 0);
  return score;
}

/**
 * Score a TSID as a release-flow candidate.
 * Returns -1 if disqualified, otherwise a positive score (higher = better).
 */
function scoreReleaseTsid(name: string, interval: string): number {
  // Exclude inflow — we want outflow / release
  if (name.includes('.Flow-Inflow.') || name.includes('-Inflow.')) return -1;
  let score = 0;
  if (name.includes('.Flow-Out.'))      score += 10;
  else if (name.includes('.Flow.Inst.'))score += 9;
  else if (name.includes('.Flow.Ave.')) score += 7;
  else return -1;
  if (name.endsWith('DCP-rev'))         score += 3;
  else if (name.endsWith('DCP-raw'))    score += 1;
  score += (INTERVAL_PRIORITY[interval] ?? 0);
  return score;
}

function metersToFeet(m: number): number { return m * 3.28084; }
function cmsToCfs(cms: number): number   { return cms * 35.3147; }

function toImperialElevation(value: number, units: string): number {
  return units === 'm' ? metersToFeet(value) : value;
}
function toImperialFlow(value: number, units: string): number {
  return units === 'cms' ? cmsToCfs(value) : value;
}

/** Fetch the timeseries catalog for a single CWMS location. */
async function fetchTsCatalog(
  locationId: string,
  office: string,
  timeoutMs = 15_000
): Promise<TsCatalogEntry[]> {
  const url =
    `${CWMS_BASE}/catalog/TIMESERIES` +
    `?office=${encodeURIComponent(office)}` +
    `&like=${encodeURIComponent(locationId + '.*')}` +
    `&pageSize=200`;
  const body = await fetchJson(url, timeoutMs);
  if (!body || typeof body !== 'object') return [];
  const bodyRecord = body as Record<string, unknown>;
  const entries = bodyRecord.entries;
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      const entryRecord = asRecord(entry);
      return {
        name: String(entryRecord?.name ?? ''),
        units: String(entryRecord?.units ?? ''),
        interval: String(entryRecord?.interval ?? ''),
      };
    })
    .filter(e => e.name);
}

/**
 * Fetch current reservoir pool elevation and release rate for a USACE PROJECT location.
 *
 * Uses a catalog-first strategy: discovers the actual TSIDs published for this
 * location before fetching, so naming differences across offices are handled
 * automatically. Converts metric units (m, cms) to imperial (ft, CFS).
 */
export async function fetchReservoirData(
  locationId: string,
  office: string
): Promise<ReservoirData> {
  const catalog = await fetchTsCatalog(locationId, office);

  // Pick best pool elevation and release flow TSIDs
  let bestPool:    TsCatalogEntry | null = null;
  let bestRelease: TsCatalogEntry | null = null;
  let bestPoolScore    = -1;
  let bestReleaseScore = -1;

  for (const entry of catalog) {
    const ps = scorePoolTsid(entry.name, entry.interval);
    if (ps > bestPoolScore) { bestPoolScore = ps; bestPool = entry; }

    const rs = scoreReleaseTsid(entry.name, entry.interval);
    if (rs > bestReleaseScore) { bestReleaseScore = rs; bestRelease = entry; }
  }

  // Fetch both in parallel
  const [poolReading, releaseReading] = await Promise.all([
    bestPool    ? fetchLatestTsValue(bestPool.name, office)    : Promise.resolve(null),
    bestRelease ? fetchLatestTsValue(bestRelease.name, office) : Promise.resolve(null),
  ]);

  return {
    poolElevationFt: poolReading && bestPool
      ? toImperialElevation(poolReading.value, bestPool.units)
      : null,
    releaseCfs: releaseReading && bestRelease
      ? toImperialFlow(releaseReading.value, bestRelease.units)
      : null,
    poolTsid:    bestPool?.name    ?? null,
    releaseTsid: bestRelease?.name ?? null,
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
