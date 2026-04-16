export interface USGSResponse {
  value: {
    timeSeries: Array<{
      sourceInfo: {
        siteCode: Array<{
          value: string;
        }>;
      };
      variable: {
        variableCode: Array<{
          value: string;
        }>;
      };
      values: Array<{
        value: Array<{
          value: string;
          dateTime: string;
        }>;
      }>;
    }>;
  };
}

export interface SiteData {
  flow: number | null;
  temperature: number | null;
  gageHeight: number | null;
  timestamp: string;
  source: 'iv' | 'dv';
}

/** Split an array into chunks of a given size */
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Run async functions with limited concurrency */
export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p = task().then((result) => {
      results.push(result);
    });
    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((e) => e === p),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

/** Parse USGS timeSeries response into a map of site ID -> SiteData */
export function parseUSGSResponse(
  data: USGSResponse,
  source: 'iv' | 'dv'
): Map<string, SiteData> {
  const siteDataMap = new Map<string, SiteData>();

  if (!data.value?.timeSeries) return siteDataMap;

  const siteSeriesMap = new Map<string, typeof data.value.timeSeries>();
  for (const series of data.value.timeSeries) {
    const siteId = series.sourceInfo.siteCode[0].value;
    if (!siteSeriesMap.has(siteId)) {
      siteSeriesMap.set(siteId, []);
    }
    siteSeriesMap.get(siteId)!.push(series);
  }

  for (const [siteId, seriesList] of siteSeriesMap) {
    let flow: number | null = null;
    let temperature: number | null = null;
    let gageHeight: number | null = null;
    let timestamp = new Date().toISOString();

    for (const series of seriesList) {
      const paramCode = series.variable.variableCode[0].value;
      const values = series.values[0]?.value;
      if (!values || values.length === 0) continue;

      const latestValue = values[values.length - 1];
      timestamp = latestValue.dateTime;

      if (paramCode === '00060') {
        flow = parseFloat(latestValue.value);
      } else if (paramCode === '00010') {
        const celsius = parseFloat(latestValue.value);
        temperature = (celsius * 9) / 5 + 32;
      } else if (paramCode === '00065') {
        gageHeight = parseFloat(latestValue.value);
      }
    }

    siteDataMap.set(siteId, { flow, temperature, gageHeight, timestamp, source });
  }

  return siteDataMap;
}

/** Fetch a batch of sites from a USGS endpoint */
export async function fetchUSGSBatch(
  siteIds: string[],
  endpoint: 'iv' | 'dv',
  errors: string[],
  period?: string
): Promise<Map<string, SiteData>> {
  const sitesParam = siteIds.join(',');
  const baseUrl = `https://waterservices.usgs.gov/nwis/${endpoint}/`;
  const effectivePeriod = period ?? (endpoint === 'dv' ? 'P1D' : undefined);
  const periodParam = effectivePeriod ? `&period=${effectivePeriod}` : '';
  const params = `format=json&sites=${sitesParam}&parameterCd=00060,00065,00010&siteStatus=all${periodParam}`;
  const usgsUrl = `${baseUrl}?${params}`;

  try {
    console.log(`[cron] Fetching USGS ${endpoint.toUpperCase()} batch: ${siteIds.length} sites`);
    const response = await fetch(usgsUrl);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      errors.push(`USGS ${endpoint} batch failed (HTTP ${response.status}): ${body.slice(0, 200)}`);
      return new Map();
    }

    const data: USGSResponse = await response.json();
    const result = parseUSGSResponse(data, endpoint);
    console.log(`[cron] USGS ${endpoint.toUpperCase()} batch: ${result.size}/${siteIds.length} sites returned data`);
    return result;
  } catch (error: any) {
    errors.push(`USGS ${endpoint} batch error: ${error?.message ?? String(error)}`);
    return new Map();
  }
}

/** Fetch all sites in batched parallel requests */
export async function fetchAllSites(
  siteIds: string[],
  endpoint: 'iv' | 'dv',
  errors: string[],
  batchSize: number = 50,
  concurrency: number = 3,
  period?: string
): Promise<Map<string, SiteData>> {
  const batches = chunk(siteIds, batchSize);
  console.log(`[cron] ${endpoint.toUpperCase()}: ${siteIds.length} stations in ${batches.length} batch(es)${period ? ` (period=${period})` : ''}`);
  const start = Date.now();

  const batchResults = await runWithConcurrency(
    batches.map((batch) => () => fetchUSGSBatch(batch, endpoint, errors, period)),
    concurrency
  );

  const allData = new Map<string, SiteData>();
  for (const batchMap of batchResults) {
    for (const [siteId, data] of batchMap) {
      allData.set(siteId, data);
    }
  }

  console.log(`[cron] ${endpoint.toUpperCase()} complete in ${Date.now() - start}ms — ${allData.size}/${siteIds.length} sites`);
  return allData;
}
