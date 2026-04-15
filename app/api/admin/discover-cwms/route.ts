/**
 * GET /api/admin/discover-cwms
 *
 * Discovery tool: finds which rivers in our database have nearby USACE CWMS
 * gauge locations, and reports what data parameters are available.
 *
 * Run from the deployed Vercel app (the CWMS API IP-allowlists known callers;
 * local/sandbox environments may be blocked).
 *
 * Query params:
 *   secret    — must match CRON_SECRET env var
 *   offices   — comma-separated CWMS office codes to scan
 *               default: "NAE,NAB,LRB,LRL,LRH,LRC,LRE,MVP,MVR"
 *   radius    — proximity match radius in degrees lat/lon (default 0.1 ≈ 7 mi)
 *   region    — filter our rivers by region substring (e.g. "connecticut")
 *   raw       — "true" to return raw first-page CWMS response for an office
 *               (use with ?office=NAE for debugging API shape)
 *
 * CWMS offices relevant to NE + Midwest fly fishing:
 *   NAE — New England         (CT, MA, VT, NH, ME, RI)
 *   NAB — Baltimore           (NY, PA, NJ, DE, MD)
 *   LRB — Buffalo             (western NY, PA)
 *   LRL — Louisville          (KY, IN, OH)
 *   LRH — Huntington          (WV, KY, OH, VA)
 *   LRC — Chicago             (IL, IN)
 *   LRE — Detroit             (MI)
 *   MVP — St. Paul            (MN, WI, ND, SD, IA)
 *   MVR — Rock Island         (IL, IA)
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CWMS_BASE = 'https://cwms-data.usace.army.mil/cwms-data';

/** Degrees → approximate miles (very rough, good enough for proximity matching) */
const DEG_TO_MILES = 69;

interface CwmsLocation {
  name: string;
  officeId: string;
  latitude: number | null;
  longitude: number | null;
  locationKind: string | null;
  stateInitial: string | null;
  description: string | null;
}

interface MatchedRiver {
  riverId: string;
  riverName: string;
  usgsStationId: string;
  riverLat: number;
  riverLon: number;
  cwmsName: string;
  cwmsOffice: string;
  cwmsKind: string | null;
  cwmsState: string | null;
  distanceMiles: number;
}

async function fetchCwmsLocations(
  office: string,
  timeoutMs = 20_000
): Promise<{ locations: CwmsLocation[]; raw: unknown; error: string | null }> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    // Try the /locations endpoint first (CWMS v2 API)
    const url = `${CWMS_BASE}/locations?office=${encodeURIComponent(office)}&pageSize=5000`;
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json;version=2' },
    });
    clearTimeout(t);

    if (!res.ok) {
      return {
        locations: [],
        raw: { status: res.status, url },
        error: `HTTP ${res.status} for office ${office}`,
      };
    }

    const body = await res.json();

    // Parse — handle both known response shapes
    const locations = parseCwmsLocations(body, office);

    return { locations, raw: body, error: null };
  } catch (err: any) {
    return {
      locations: [],
      raw: null,
      error: err?.name === 'AbortError' ? `Timeout for office ${office}` : String(err),
    };
  }
}

function parseCwmsLocations(body: unknown, office: string): CwmsLocation[] {
  if (!body || typeof body !== 'object') return [];
  const b = body as Record<string, unknown>;

  // Shape 1: { locations: { location: [...] } }  (CWMS v1/XML-mapped JSON)
  const v1 = (b as any)?.locations?.location;
  if (Array.isArray(v1)) {
    return v1.map((loc: any) => ({
      name: String(loc.name ?? loc['location-id'] ?? ''),
      officeId: String(loc['office-id'] ?? loc.officeId ?? office),
      latitude: toCoord(loc.latitude ?? loc.lat),
      longitude: toCoord(loc.longitude ?? loc.lon),
      locationKind: String(loc['location-kind'] ?? loc.locationKind ?? ''),
      stateInitial: String(loc['state-initial'] ?? loc.stateInitial ?? ''),
      description: loc.description ? String(loc.description) : null,
    })).filter(l => l.name);
  }

  // Shape 2: { entries: [...] }  (CWMS v2 catalog)
  const v2 = (b as any)?.entries;
  if (Array.isArray(v2)) {
    return v2.map((entry: any) => ({
      name: String(entry.name ?? entry['location-id'] ?? ''),
      officeId: String(entry.office ?? entry['office-id'] ?? office),
      latitude: toCoord(entry.latitude ?? entry.lat),
      longitude: toCoord(entry.longitude ?? entry.lon),
      locationKind: entry['location-kind'] ?? entry.locationKind ?? null,
      stateInitial: entry['state-initial'] ?? entry.stateInitial ?? null,
      description: entry.description ?? null,
    })).filter(l => l.name);
  }

  // Shape 3: top-level array
  if (Array.isArray(body)) {
    return (body as any[]).map((loc: any) => ({
      name: String(loc.name ?? loc['location-id'] ?? ''),
      officeId: String(loc['office-id'] ?? loc.officeId ?? office),
      latitude: toCoord(loc.latitude ?? loc.lat),
      longitude: toCoord(loc.longitude ?? loc.lon),
      locationKind: loc['location-kind'] ?? loc.locationKind ?? null,
      stateInitial: loc['state-initial'] ?? loc.stateInitial ?? null,
      description: loc.description ?? null,
    })).filter(l => l.name);
  }

  return [];
}

function toCoord(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function haversineApprox(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = lat1 - lat2;
  const dLon = (lon1 - lon2) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.sqrt(dLat * dLat + dLon * dLon) * DEG_TO_MILES;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const authHeader = request.headers.get('authorization');
  const querySecret = searchParams.get('secret');
  const validAuth =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    querySecret === process.env.CRON_SECRET;
  if (process.env.CRON_SECRET && !validAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const officesParam = searchParams.get('offices') ?? 'NAE,NAB,LRB,LRL,LRH,LRC,LRE,MVP,MVR';
  const offices = officesParam.split(',').map(o => o.trim().toUpperCase()).filter(Boolean);
  const radiusDeg = parseFloat(searchParams.get('radius') ?? '0.1');
  const radius = Number.isFinite(radiusDeg) && radiusDeg > 0 ? radiusDeg : 0.1;
  const regionFilter = searchParams.get('region')?.toLowerCase() ?? null;
  const rawMode = searchParams.get('raw') === 'true';

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Raw debug mode: return first-page CWMS response for one office ──────────
  if (rawMode && offices.length === 1) {
    const { locations, raw, error } = await fetchCwmsLocations(offices[0]);
    return NextResponse.json({
      office: offices[0],
      error,
      locationsFound: locations.length,
      firstThree: locations.slice(0, 3),
      raw: raw,
    });
  }

  // ── Load our rivers with lat/lon ─────────────────────────────────────────────
  let query = supabase
    .from('rivers')
    .select('id, name, usgs_station_id, region, latitude, longitude')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (regionFilter) {
    query = query.ilike('region', `%${regionFilter}%`);
  }

  const { data: rivers, error: rivErr } = await query;
  if (rivErr) {
    return NextResponse.json({ error: rivErr.message }, { status: 500 });
  }

  const ourRivers = (rivers ?? []) as Array<{
    id: string;
    name: string;
    usgs_station_id: string;
    region: string;
    latitude: number;
    longitude: number;
  }>;

  console.log(`[discover-cwms] ${ourRivers.length} rivers with coordinates, scanning offices: ${offices.join(', ')}`);

  // ── Query CWMS offices ───────────────────────────────────────────────────────
  const officeResults: Record<string, { locationCount: number; error: string | null }> = {};
  const allMatches: MatchedRiver[] = [];
  const allCwmsLocations: CwmsLocation[] = [];

  for (const office of offices) {
    console.log(`[discover-cwms] Fetching ${office}…`);
    const { locations, error } = await fetchCwmsLocations(office);
    officeResults[office] = { locationCount: locations.length, error };
    allCwmsLocations.push(...locations);

    if (locations.length === 0) continue;

    // Proximity-match each CWMS location against our rivers
    for (const loc of locations) {
      if (loc.latitude === null || loc.longitude === null) continue;

      for (const river of ourRivers) {
        const dist = haversineApprox(river.latitude, river.longitude, loc.latitude, loc.longitude);
        if (dist <= radius * DEG_TO_MILES) {
          allMatches.push({
            riverId: river.id,
            riverName: river.name,
            usgsStationId: river.usgs_station_id,
            riverLat: river.latitude,
            riverLon: river.longitude,
            cwmsName: loc.name,
            cwmsOffice: office,
            cwmsKind: loc.locationKind,
            cwmsState: loc.stateInitial,
            distanceMiles: Math.round(dist * 10) / 10,
          });
        }
      }
    }
  }

  // De-duplicate: keep closest CWMS location per river
  const byRiver = new Map<string, MatchedRiver>();
  for (const m of allMatches) {
    const existing = byRiver.get(m.riverId);
    if (!existing || m.distanceMiles < existing.distanceMiles) {
      byRiver.set(m.riverId, m);
    }
  }

  const matches = Array.from(byRiver.values()).sort((a, b) => a.distanceMiles - b.distanceMiles);

  // Summary by location kind
  const kindCounts: Record<string, number> = {};
  for (const m of matches) {
    const k = m.cwmsKind ?? 'unknown';
    kindCounts[k] = (kindCounts[k] ?? 0) + 1;
  }

  console.log(`[discover-cwms] Done. ${matches.length} rivers matched across ${allCwmsLocations.length} total CWMS locations.`);

  return NextResponse.json({
    summary: {
      ourRiversScanned: ourRivers.length,
      cwmsLocationsTotal: allCwmsLocations.length,
      matchedRivers: matches.length,
      radiusMiles: Math.round(radius * DEG_TO_MILES),
      byLocationKind: kindCounts,
    },
    offices: officeResults,
    matches,
  });
}
