/**
 * GET /api/admin/populate-nws-lids
 *
 * Query params:
 *   secret       — must match CRON_SECRET env var
 *   skip_hads    — "true" to skip Phase 1 (LID mapping); use on re-runs
 *   stages       — "false" to skip Phase 2 (flood stage fetch); default true
 *   limit        — max rivers to process in Phase 2 (default 500 per run)
 *   concurrency  — parallel NWPS requests in Phase 2 (default 8)
 *   inspect      — return raw NWPS response for a single USGS station ID (debug)
 *
 * Phase 1 — LID mapping (skippable with ?skip_hads=true):
 *   Downloads the NOAA HADS flat file, matches rivers by USGS station ID,
 *   writes nws_lid. Already ran — skip on subsequent invocations.
 *
 * Phase 2 — Flood stage fetch (concurrent):
 *   Calls NWPS gauge API with USGS station IDs in parallel batches.
 *   Writes action/flood/moderate/major stage thresholds. Also backfills
 *   nws_lid from body.lid for rivers the HADS file missed.
 *   Run multiple times with ?limit=500 until stages.remaining hits 0.
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchHadsMapping, fetchGaugeData } from '@/lib/nwps';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Run up to `concurrency` async tasks at a time. */
async function runConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

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

  // Debug: return raw NWPS response for one USGS station ID.
  // Usage: ?secret=...&inspect=01184000
  const inspectId = searchParams.get('inspect');
  if (inspectId) {
    const raw = await fetch(
      `https://api.water.noaa.gov/nwps/v1/gauges/${encodeURIComponent(inspectId)}`,
      { cache: 'no-store' }
    );
    const body = raw.ok ? await raw.json() : { error: `HTTP ${raw.status}` };
    return NextResponse.json({ id: inspectId, status: raw.status, body });
  }

  const skipHads    = searchParams.get('skip_hads') === 'true';
  const fetchStages = searchParams.get('stages') !== 'false';
  const limitParam  = Number(searchParams.get('limit') ?? '500');
  const stagesLimit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 500;
  const concParam   = Number(searchParams.get('concurrency') ?? '8');
  const concurrency = Number.isFinite(concParam) && concParam > 0 ? Math.min(concParam, 20) : 8;

  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── Phase 1: LID mapping (skip with ?skip_hads=true on re-runs) ──────────

    let hadsSize = 0;
    let lidsPopulated = 0;
    let lidsNotFound = 0;
    const lidsNotFoundSamples: string[] = [];

    if (!skipHads) {
      console.log('[populate-nws-lids] Downloading HADS flat file…');
      const hadsMap = await fetchHadsMapping();
      if (!hadsMap) {
        return NextResponse.json(
          { success: false, error: 'Failed to download HADS cross-reference file' },
          { status: 502 }
        );
      }
      hadsSize = hadsMap.size;
      console.log(`[populate-nws-lids] HADS parsed — ${hadsSize} entries`);

      const { data: rivers, error: rivErr } = await supabase
        .from('rivers')
        .select('id, name, usgs_station_id')
        .is('nws_lid', null)
        .not('usgs_station_id', 'is', null);
      if (rivErr) throw new Error(rivErr.message);

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
        if (upErr) { lidsNotFound++; continue; }
        lidsPopulated++;
      }
      console.log(`[populate-nws-lids] Phase 1 done — ${lidsPopulated} populated, ${lidsNotFound} unmatched`);
    }

    // ── Phase 2: Flood stage fetch (concurrent) ───────────────────────────────

    let stagesPopulated = 0;
    let stagesNotFound = 0;
    let stagesRemaining = 0;

    if (fetchStages) {
      const { count: totalNeedingStages } = await supabase
        .from('rivers')
        .select('*', { count: 'exact', head: true })
        .not('usgs_station_id', 'is', null)
        .is('nwps_checked_at', null);

      const { data: stageRivers, error: stageErr } = await supabase
        .from('rivers')
        .select('id, name, usgs_station_id, nws_lid')
        .not('usgs_station_id', 'is', null)
        .is('nwps_checked_at', null)
        .limit(stagesLimit);
      if (stageErr) throw new Error(stageErr.message);

      const batch = stageRivers ?? [];
      stagesRemaining = Math.max(0, (totalNeedingStages ?? 0) - batch.length);

      console.log(`[populate-nws-lids] Phase 2: ${batch.length} rivers, concurrency ${concurrency}`);

      await runConcurrent(batch, concurrency, async (river) => {
        if (!river.usgs_station_id) { stagesNotFound++; return; }

        const { nwsLid, stages } = await fetchGaugeData(river.usgs_station_id);

        const update: Record<string, unknown> = {
          nwps_checked_at: new Date().toISOString(),
        };

        if (stages) {
          update.action_stage         = stages.action;
          update.flood_stage          = stages.flood;
          update.moderate_flood_stage = stages.moderate;
          update.major_flood_stage    = stages.major;
        }
        if (nwsLid && !river.nws_lid) {
          update.nws_lid = nwsLid;
        }

        const { error: upErr } = await supabase
          .from('rivers')
          .update(update)
          .eq('id', river.id);

        if (upErr || (!stages && !nwsLid)) { stagesNotFound++; return; }
        if (stages) stagesPopulated++;
      });

      console.log(`[populate-nws-lids] Phase 2 done — ${stagesPopulated} populated, ${stagesNotFound} no data`);
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      ...(skipHads ? { phase1: 'skipped' } : {
        hads_entries: hadsSize,
        lids: { populated: lidsPopulated, not_matched: lidsNotFound, samples: lidsNotFoundSamples },
      }),
      stages: fetchStages
        ? { populated: stagesPopulated, no_data: stagesNotFound, remaining: stagesRemaining }
        : 'skipped',
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
