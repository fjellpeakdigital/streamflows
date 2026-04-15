/**
 * GET /api/cron/fetch-cwms-data
 *
 * Hourly cron: fetches current pool elevation and release rate for every river
 * whose cwms_location_kind = 'PROJECT' (USACE flood-control dams).
 *
 * Writes to rivers:
 *   reservoir_pool_ft      — current pool elevation in feet NGVD
 *   reservoir_release_cfs  — current outflow / release rate in CFS
 *   reservoir_updated_at   — timestamp of this fetch
 *
 * Rivers where both readings are null are still stamped with reservoir_updated_at
 * so we can distinguish "tried and got nothing" from "never tried".
 *
 * Protected by CRON_SECRET (Authorization: Bearer or ?secret= param).
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchReservoirData } from '@/lib/cwms';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CWMS_BASE = 'https://cwms-data.usace.army.mil/cwms-data';

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

  // ── Debug: inspect raw CWMS timeseries response for one location ────────────
  // Usage: ?secret=...&inspect=TLD&office=NAE
  // Also queries the timeseries catalog to discover what TSIDs actually exist.
  const inspectId = searchParams.get('inspect');
  const inspectOffice = searchParams.get('office');
  if (inspectId && inspectOffice) {
    // 1. Query the CWMS timeseries catalog to discover available TSIDs
    const catalogUrl =
      `${CWMS_BASE}/catalog/TIMESERIES` +
      `?office=${encodeURIComponent(inspectOffice)}` +
      `&like=${encodeURIComponent(inspectId + '.*')}` +
      `&pageSize=50`;
    let catalog: unknown = null;
    try {
      const catalogRes = await fetch(catalogUrl, {
        cache: 'no-store',
        headers: { Accept: '*/*' },
      });
      catalog = catalogRes.ok
        ? await catalogRes.json()
        : { _httpStatus: catalogRes.status, _url: catalogUrl };
    } catch (err: any) {
      catalog = { error: err.message };
    }

    // 2. Probe each candidate TSID
    const end = new Date();
    const begin = new Date(end.getTime() - 6 * 60 * 60 * 1000);
    const probes: Record<string, unknown> = {};

    for (const param of [...POOL_PARAMS, ...RELEASE_PARAMS]) {
      const tsid = `${inspectId}.${param}`;
      const url =
        `${CWMS_BASE}/timeseries` +
        `?name=${encodeURIComponent(tsid)}` +
        `&office=${encodeURIComponent(inspectOffice)}` +
        `&begin=${begin.toISOString()}` +
        `&end=${end.toISOString()}`;
      try {
        const res = await fetch(url, {
          cache: 'no-store',
          headers: { Accept: '*/*' },
        });
        const body = res.ok ? await res.json() : { _httpStatus: res.status, _url: url };
        probes[param] = { status: res.status, body };
      } catch (err: any) {
        probes[param] = { error: err.message, url };
      }
    }

    return NextResponse.json({ location: inspectId, office: inspectOffice, catalog, probes });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Load all PROJECT rivers that have a CWMS location assigned
  const { data: rivers, error: rivErr } = await supabase
    .from('rivers')
    .select('id, name, cwms_location_id, cwms_office')
    .eq('cwms_location_kind', 'PROJECT')
    .not('cwms_location_id', 'is', null)
    .not('cwms_office', 'is', null);

  if (rivErr) {
    return NextResponse.json({ error: rivErr.message }, { status: 500 });
  }

  const projectRivers = (rivers ?? []) as Array<{
    id: string;
    name: string;
    cwms_location_id: string;
    cwms_office: string;
  }>;

  console.log(`[fetch-cwms-data] ${projectRivers.length} PROJECT rivers to update`);

  let updated = 0;
  let noData = 0;
  const errors: string[] = [];

  for (const river of projectRivers) {
    try {
      const { poolElevationFt, releaseCfs, poolTsid, releaseTsid } =
        await fetchReservoirData(river.cwms_location_id, river.cwms_office);

      const { error: upErr } = await supabase
        .from('rivers')
        .update({
          reservoir_pool_ft:     poolElevationFt,
          reservoir_release_cfs: releaseCfs,
          reservoir_updated_at:  new Date().toISOString(),
        })
        .eq('id', river.id);

      if (upErr) {
        errors.push(`${river.name}: ${upErr.message}`);
        continue;
      }

      if (poolElevationFt !== null || releaseCfs !== null) {
        updated++;
        console.log(
          `[fetch-cwms-data] ${river.name} (${river.cwms_location_id}): ` +
          `pool=${poolElevationFt?.toFixed(2) ?? 'null'} ft via ${poolTsid ?? '—'}, ` +
          `release=${releaseCfs?.toFixed(0) ?? 'null'} CFS via ${releaseTsid ?? '—'}`
        );
      } else {
        noData++;
        console.log(`[fetch-cwms-data] ${river.name} (${river.cwms_location_id}): no data`);
      }
    } catch (err: any) {
      errors.push(`${river.name}: ${err.message}`);
    }
  }

  console.log(
    `[fetch-cwms-data] Done — ${updated} updated, ${noData} no data, ${errors.length} errors`
  );

  return NextResponse.json({
    success: true,
    project_rivers: projectRivers.length,
    updated,
    no_data: noData,
    errors: errors.length > 0 ? errors : undefined,
  });
}
