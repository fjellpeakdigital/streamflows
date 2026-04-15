/**
 * GET /api/admin/populate-nws-lids?secret=<CRON_SECRET>&limit=500&stages=true
 *
 * Two-phase admin route:
 *
 * Phase 1 — LID mapping (always runs):
 *   Downloads the NOAA HADS flat file once, parses it into a USGS ID → NWS LID
 *   map, then batch-updates rivers that have a usgs_station_id match but no
 *   nws_lid yet.
 *
 * Phase 2 — Flood stage fetch (runs when ?stages=true, default true):
 *   For every river that now has an nws_lid but is missing flood_stage data,
 *   calls the NWPS gauge endpoint to fetch action/flood/moderate/major stage
 *   thresholds and writes them back to the rivers row.
 *
 * Query params:
 *   secret  — must match CRON_SECRET env var
 *   limit   — max rivers to process in Phase 1 (default: all)
 *   stages  — "true" (default) to also fetch flood stage thresholds
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchHadsMapping, fetchFloodStages } from '@/lib/nwps';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const startTime = Date.now();

  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get('secret');
  const validAuth =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    querySecret === process.env.CRON_SECRET;
  if (process.env.CRON_SECRET && !validAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limitParam = Number(searchParams.get('limit') ?? '0');
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 0;
  const fetchStages = searchParams.get('stages') !== 'false'; // default true

  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── Phase 1: LID mapping ────────────────────────────────────────────────

    console.log('[populate-nws-lids] Downloading HADS flat file…');
    const hadsMap = await fetchHadsMapping();
    if (!hadsMap) {
      return NextResponse.json(
        { success: false, error: 'Failed to download HADS cross-reference file' },
        { status: 502 }
      );
    }
    console.log(`[populate-nws-lids] HADS file parsed — ${hadsMap.size} entries`);

    // Fetch rivers that still need an NWS LID.
    let rivQuery = supabase
      .from('rivers')
      .select('id, name, usgs_station_id')
      .is('nws_lid', null)
      .not('usgs_station_id', 'is', null);
    if (limit > 0) rivQuery = rivQuery.limit(limit);

    const { data: rivers, error: rivErr } = await rivQuery;
    if (rivErr) throw new Error(rivErr.message);

    let lidsPopulated = 0;
    let lidsNotFound = 0;
    const lidsNotFoundSamples: string[] = [];

    for (const river of rivers ?? []) {
      const nwsLid = hadsMap.get(river.usgs_station_id);
      if (!nwsLid) {
        lidsNotFound++;
        if (lidsNotFoundSamples.length < 20) lidsNotFoundSamples.push(river.name);
        continue;
      }

      const { error: upErr } = await supabase
        .from('rivers')
        .update({ nws_lid: nwsLid })
        .eq('id', river.id);

      if (upErr) {
        lidsNotFound++;
        continue;
      }
      lidsPopulated++;
    }

    console.log(
      `[populate-nws-lids] Phase 1 done — ${lidsPopulated} LIDs populated, ${lidsNotFound} not matched`
    );

    // ── Phase 2: Flood stage fetch ──────────────────────────────────────────

    let stagesPopulated = 0;
    let stagesNotFound = 0;

    if (fetchStages) {
      // Rivers that have an nws_lid but no flood_stage data yet.
      const { data: stageRivers, error: stageErr } = await supabase
        .from('rivers')
        .select('id, name, nws_lid')
        .not('nws_lid', 'is', null)
        .is('flood_stage', null);

      if (stageErr) throw new Error(stageErr.message);

      for (const river of stageRivers ?? []) {
        if (!river.nws_lid) continue;

        const stages = await fetchFloodStages(river.nws_lid);
        if (!stages) {
          stagesNotFound++;
          continue;
        }

        const { error: upErr } = await supabase
          .from('rivers')
          .update({
            action_stage: stages.action,
            flood_stage: stages.flood,
            moderate_flood_stage: stages.moderate,
            major_flood_stage: stages.major,
          })
          .eq('id', river.id);

        if (upErr) {
          stagesNotFound++;
          continue;
        }
        stagesPopulated++;
      }

      console.log(
        `[populate-nws-lids] Phase 2 done — ${stagesPopulated} stage sets populated, ${stagesNotFound} without stage data`
      );
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      hads_entries: hadsMap.size,
      lids: {
        scanned: rivers?.length ?? 0,
        populated: lidsPopulated,
        not_matched: lidsNotFound,
        not_matched_samples: lidsNotFoundSamples,
      },
      stages: fetchStages
        ? { populated: stagesPopulated, not_found: stagesNotFound }
        : 'skipped (pass ?stages=true to enable)',
      duration_ms: duration,
    });
  } catch (err: any) {
    console.error('[populate-nws-lids] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message, duration_ms: Date.now() - startTime },
      { status: 500 }
    );
  }
}
