/**
 * GET /api/admin/discover-cwms
 *
 * Discovery tool: finds which rivers in our database have nearby USACE CWMS
 * gauge locations, and reports what data parameters are available.
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchCwmsLocations, haversineApproxMiles } from '@/lib/cwms';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const APPROX_RADIUS_TO_MILES = 69;

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
  const offices = officesParam.split(',').map((office) => office.trim().toUpperCase()).filter(Boolean);
  const radiusDeg = parseFloat(searchParams.get('radius') ?? '0.1');
  const radius = Number.isFinite(radiusDeg) && radiusDeg > 0 ? radiusDeg : 0.1;
  const regionFilter = searchParams.get('region')?.toLowerCase() ?? null;
  const rawMode = searchParams.get('raw') === 'true';

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (rawMode && offices.length === 1) {
    const { locations, error } = await fetchCwmsLocations(offices[0]);
    return NextResponse.json({
      office: offices[0],
      error,
      locationsFound: locations.length,
      firstThree: locations.slice(0, 3),
      raw: null,
    });
  }

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

  const officeResults: Record<string, { locationCount: number; error: string | null }> = {};
  const allMatches: MatchedRiver[] = [];
  let cwmsLocationsTotal = 0;

  for (const office of offices) {
    console.log(`[discover-cwms] Fetching ${office}...`);
    const { locations, error } = await fetchCwmsLocations(office);
    officeResults[office] = { locationCount: locations.length, error };
    cwmsLocationsTotal += locations.length;

    if (locations.length === 0) continue;

    for (const loc of locations) {
      if (loc.latitude === null || loc.longitude === null) continue;

      for (const river of ourRivers) {
        const dist = haversineApproxMiles(
          river.latitude,
          river.longitude,
          loc.latitude,
          loc.longitude
        );
        if (dist <= radius * APPROX_RADIUS_TO_MILES) {
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

  const byRiver = new Map<string, MatchedRiver>();
  for (const match of allMatches) {
    const existing = byRiver.get(match.riverId);
    if (!existing || match.distanceMiles < existing.distanceMiles) {
      byRiver.set(match.riverId, match);
    }
  }

  const matches = Array.from(byRiver.values()).sort((a, b) => a.distanceMiles - b.distanceMiles);

  const kindCounts: Record<string, number> = {};
  for (const match of matches) {
    const kind = match.cwmsKind ?? 'unknown';
    kindCounts[kind] = (kindCounts[kind] ?? 0) + 1;
  }

  console.log(`[discover-cwms] Done. ${matches.length} rivers matched across ${cwmsLocationsTotal} total CWMS locations.`);

  return NextResponse.json({
    summary: {
      ourRiversScanned: ourRivers.length,
      cwmsLocationsTotal,
      matchedRivers: matches.length,
      radiusMiles: Math.round(radius * APPROX_RADIUS_TO_MILES),
      byLocationKind: kindCounts,
    },
    offices: officeResults,
    matches,
  });
}
