/**
 * NOAA National Water Prediction Service (NWPS) utilities.
 *
 * Two responsibilities:
 *  1. Parse the HADS flat file to build a USGS station ID → NWS LID mapping.
 *  2. Fetch flood stage thresholds and NWS LID from the NWPS gauge API using
 *     a USGS station ID (the API accepts USGS IDs directly).
 *
 * HADS cross-reference: https://hads.ncep.noaa.gov/USGS/ALL_USGS-HADS_SITES.txt
 * NWPS gauge API:        https://api.water.noaa.gov/nwps/v1/gauges/{usgsStationId}
 *
 * Actual response shape (confirmed against live API):
 *   body.lid                              — NWS Location ID (e.g. "TMVC3")
 *   body.flood.categories.action.stage   — action stage (ft)
 *   body.flood.categories.minor.stage    — flood/minor stage (ft)
 *   body.flood.categories.moderate.stage — moderate flood stage (ft)
 *   body.flood.categories.major.stage    — major flood stage (ft)
 */

export interface FloodStages {
  action: number | null;
  flood: number | null;
  moderate: number | null;
  major: number | null;
}

export interface GaugeData {
  /** NWS Location ID extracted from the NWPS response (e.g. "TMVC3") */
  nwsLid: string | null;
  stages: FloodStages | null;
}

const NWPS_BASE = 'https://api.water.noaa.gov/nwps/v1';
const HADS_URL = 'https://hads.ncep.noaa.gov/USGS/ALL_USGS-HADS_SITES.txt';

async function fetchJson(url: string, timeoutMs = 10_000): Promise<unknown | null> {
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

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '' || v === 'NaN') return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  // Treat NOAA's -9999 sentinel as missing
  if (!Number.isFinite(n) || n <= -9999) return null;
  return n;
}

/**
 * Download and parse the NOAA HADS flat file.
 *
 * Returns a Map<usgsStationId, nwsLid> for every USGS station that has a
 * corresponding NWS Location ID. Returns null if the download fails.
 *
 * File format (pipe-delimited, may have trailing spaces):
 *   NWSLI   |USGSID    |GOESID |NWS|LAT      |LON       |LOCATION NAME
 *   CTLT2   |01184000  |...    |BOX|41 45 31 |072 15 10 |CONNECTICUT R AT THOMPSONVILLE CT
 */
export async function fetchHadsMapping(
  timeoutMs = 30_000
): Promise<Map<string, string> | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(HADS_URL, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!res.ok) return null;

    const text = await res.text();
    const map = new Map<string, string>();

    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('NWS') || trimmed.startsWith('#')) continue;

      const parts = trimmed.split('|');
      if (parts.length < 2) continue;

      const nwsLid = parts[0].trim();
      const usgsId = parts[1].trim();
      if (nwsLid && usgsId) {
        map.set(usgsId, nwsLid);
      }
    }

    return map;
  } catch {
    return null;
  }
}

/**
 * Fetch gauge metadata from the NWPS API using a USGS station ID.
 *
 * Returns the NWS LID (from body.lid) and flood stage thresholds
 * (from body.flood.categories). Either may be null if the gauge has no
 * NWS designation or no published flood stages.
 */
export async function fetchGaugeData(usgsStationId: string): Promise<GaugeData> {
  const body = await fetchJson(
    `${NWPS_BASE}/gauges/${encodeURIComponent(usgsStationId)}`,
    10_000
  );

  if (!body || typeof body !== 'object') {
    return { nwsLid: null, stages: null };
  }

  const bodyRecord = body as Record<string, unknown>;

  // NWS LID lives at body.lid
  const nwsLid = typeof bodyRecord.lid === 'string' && bodyRecord.lid.length > 0
    ? bodyRecord.lid
    : null;

  // Flood stages live at body.flood.categories.{action|minor|moderate|major}.stage
  const flood = bodyRecord.flood as Record<string, unknown> | undefined;
  const cats = flood?.categories as Record<string, unknown> | undefined;
  if (!cats || typeof cats !== 'object') {
    return { nwsLid, stages: null };
  }

  const actionCategory = cats.action as Record<string, unknown> | undefined;
  const minorCategory = cats.minor as Record<string, unknown> | undefined;
  const moderateCategory = cats.moderate as Record<string, unknown> | undefined;
  const majorCategory = cats.major as Record<string, unknown> | undefined;

  const action = toNum(actionCategory?.stage ?? null);
  const floodStage = toNum(minorCategory?.stage ?? null);
  const moderate = toNum(moderateCategory?.stage ?? null);
  const major = toNum(majorCategory?.stage ?? null);

  const stages: FloodStages | null =
    action !== null || floodStage !== null || moderate !== null || major !== null
      ? { action, flood: floodStage, moderate, major }
      : null;

  return { nwsLid, stages };
}

/**
 * Convenience wrapper — returns only flood stages for a USGS station ID.
 */
export async function fetchFloodStages(usgsStationId: string): Promise<FloodStages | null> {
  const { stages } = await fetchGaugeData(usgsStationId);
  return stages;
}
