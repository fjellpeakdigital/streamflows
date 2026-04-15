/**
 * NOAA National Water Prediction Service (NWPS) utilities.
 *
 * Two responsibilities:
 *  1. Parse the HADS flat file to build a USGS station ID → NWS LID mapping.
 *  2. Fetch flood stage thresholds for a gauge from the NWPS gauge API.
 *
 * HADS cross-reference: https://hads.ncep.noaa.gov/USGS/ALL_USGS-HADS_SITES.txt
 * NWPS gauge API:        https://api.water.noaa.gov/nwps/v1/gauges/{lid}
 */

export interface FloodStages {
  action: number | null;
  flood: number | null;
  moderate: number | null;
  major: number | null;
}

const NWPS_BASE = 'https://api.water.noaa.gov/nwps/v1';
const HADS_URL = 'https://hads.ncep.noaa.gov/USGS/ALL_USGS-HADS_SITES.txt';

async function fetchJson(url: string, timeoutMs = 10_000): Promise<any | null> {
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
  return Number.isFinite(n) ? n : null;
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
 * Fetch NWS flood stage thresholds for a gauge by its NWS LID.
 *
 * The NWPS gauge endpoint returns stage thresholds nested under various keys
 * depending on API version. This function checks the common shapes defensively.
 *
 * Returns null if the gauge has no stage thresholds or the request fails.
 */
export async function fetchFloodStages(nwsLid: string): Promise<FloodStages | null> {
  const body = await fetchJson(
    `${NWPS_BASE}/gauges/${encodeURIComponent(nwsLid)}`,
    10_000
  );
  if (!body || typeof body !== 'object') return null;

  // Stage thresholds may be nested under `flood`, `floodStages`, `stages`,
  // or as flat top-level fields — check all common shapes.
  const src = body.flood ?? body.floodStages ?? body.stages ?? body;

  const action   = toNum(src.action   ?? src.actionStage   ?? body.action   ?? null);
  const flood    = toNum(src.flood    ?? src.floodStage    ?? body.flood    ?? null);
  const moderate = toNum(src.moderate ?? src.moderateFloodStage ?? body.moderate ?? null);
  const major    = toNum(src.major    ?? src.majorFloodStage    ?? body.major    ?? null);

  // Only return a result if at least one threshold is present.
  if (action === null && flood === null && moderate === null && major === null) {
    return null;
  }

  return { action, flood, moderate, major };
}
