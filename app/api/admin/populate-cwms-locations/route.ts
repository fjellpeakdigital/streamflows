/**
 * GET /api/admin/populate-cwms-locations
 *
 * One-time (or periodic) admin route that assigns a CWMS location ID,
 * office, and location kind to each river in the database.
 *
 * Steps:
 *  1. Fetch CWMS location lists for the specified offices.
 *  2. Load rivers with lat/lon from the database.
 *  3. For each river, find the nearest CWMS location using a tiered
 *     distance threshold and kind priority:
 *       PROJECT        ≤ 5 mi  (dam structures — reservoir data)
 *       STREAM_LOCATION ≤ 2 mi (tailwater / downstream gauges)
 *       STREAM_GAGE    ≤ 2 mi
 *       SITE           ≤ 0.3 mi (co-located monitoring sites)
 *     WEATHER_GAGE and BASIN are skipped entirely.
 *  4. Write cwms_location_id, cwms_office, cwms_location_kind to the river.
 *
 * Query params:
 *   secret   — must match CRON_SECRET
 *   offices  — comma-separated district codes
 *              default: "NAE,NAB,LRB,LRL,LRH,LRC,LRE,MVP,MVR"
 *   overwrite — "true" to re-assign rivers that already have a CWMS location
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  fetchCwmsLocations,
  haversineApproxMiles,
  type CwmsLocation,
} from '@/lib/cwms';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Max distance (miles) per kind for a match to be accepted */
const KIND_RADIUS: Record<string, number> = {
  PROJECT:         5,
  STREAM_LOCATION: 2,
  STREAM_GAGE:     2,
  SITE:            0.3,
};

/** Priority score — higher wins when a river matches multiple kinds */
const KIND_PRIORITY: Record<string, number> = {
  PROJECT:         4,
  STREAM_LOCATION: 3,
  STREAM_GAGE:     3,
  SITE:            2,
};

interface Candidate {
  location: CwmsLocation;
  distanceMiles: number;
  priority: number;
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

  const officesParam =
    searchParams.get('offices') ?? 'NAE,NAB,LRB,LRL,LRH,LRC,LRE,MVP,MVR';
  const offices = officesParam
    .split(',')
    .map(o => o.trim().toUpperCase())
    .filter(Boolean);
  const overwrite = searchParams.get('overwrite') === 'true';

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Fetch CWMS locations for all offices ────────────────────────────────────
  console.log(`[populate-cwms] Fetching CWMS locations for offices: ${offices.join(', ')}`);

  const allLocations: CwmsLocation[] = [];
  const officeResults: Record<string, { count: number; error: string | null }> = {};

  for (const office of offices) {
    const { locations, error } = await fetchCwmsLocations(office);
    officeResults[office] = { count: locations.length, error };
    allLocations.push(...locations);
    console.log(`[populate-cwms] ${office}: ${locations.length} locations${error ? ` (${error})` : ''}`);
  }

  // Only keep location kinds we care about
  const usableLocations = allLocations.filter(
    l => l.latitude !== null && l.longitude !== null && KIND_RADIUS[l.locationKind ?? '']
  );
  console.log(`[populate-cwms] ${usableLocations.length} usable locations (with coords + known kind)`);

  // ── Load our rivers ─────────────────────────────────────────────────────────
  let query = supabase
    .from('rivers')
    .select('id, name, usgs_station_id, latitude, longitude, cwms_location_id')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (!overwrite) {
    query = query.is('cwms_location_id', null);
  }

  const { data: rivers, error: rivErr } = await query;
  if (rivErr) {
    return NextResponse.json({ error: rivErr.message }, { status: 500 });
  }

  const ourRivers = (rivers ?? []) as Array<{
    id: string;
    name: string;
    usgs_station_id: string;
    latitude: number;
    longitude: number;
    cwms_location_id: string | null;
  }>;

  console.log(`[populate-cwms] ${ourRivers.length} rivers to process`);

  // ── Match rivers to CWMS locations ──────────────────────────────────────────
  let populated = 0;
  let skipped = 0;

  for (const river of ourRivers) {
    let best: Candidate | null = null;

    for (const loc of usableLocations) {
      const maxRadius = KIND_RADIUS[loc.locationKind!];
      if (!maxRadius) continue;

      const dist = haversineApproxMiles(
        river.latitude, river.longitude,
        loc.latitude!, loc.longitude!
      );
      if (dist > maxRadius) continue;

      const priority = KIND_PRIORITY[loc.locationKind!] ?? 0;

      if (
        !best ||
        priority > best.priority ||
        (priority === best.priority && dist < best.distanceMiles)
      ) {
        best = { location: loc, distanceMiles: dist, priority };
      }
    }

    if (!best) {
      skipped++;
      continue;
    }

    const { error: upErr } = await supabase
      .from('rivers')
      .update({
        cwms_location_id:   best.location.name,
        cwms_office:        best.location.officeId,
        cwms_location_kind: best.location.locationKind,
      })
      .eq('id', river.id);

    if (upErr) {
      console.error(`[populate-cwms] Failed to update ${river.name}: ${upErr.message}`);
      skipped++;
    } else {
      populated++;
    }
  }

  console.log(`[populate-cwms] Done — ${populated} assigned, ${skipped} skipped/no-match`);

  // Count how many PROJECT kinds we populated (the highest-value ones)
  const { count: projectCount } = await supabase
    .from('rivers')
    .select('*', { count: 'exact', head: true })
    .eq('cwms_location_kind', 'PROJECT');

  return NextResponse.json({
    success: true,
    cwms_locations_fetched: allLocations.length,
    usable_locations: usableLocations.length,
    rivers_processed: ourRivers.length,
    assigned: populated,
    skipped,
    project_rivers_total: projectCount ?? 0,
    offices: officeResults,
  });
}
