import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface USGSResponse {
  value: {
    timeSeries: Array<{
      variable: {
        variableCode: Array<{ value: string }>;
      };
      values: Array<{
        value: Array<{ value: string; dateTime: string }>;
      }>;
    }>;
  };
}

function calculateStatus(
  flow: number | null,
  optimalMin: number | null,
  optimalMax: number | null
): string {
  if (flow === null || flow <= -999000) return 'ice_affected';
  if (optimalMin === null || optimalMax === null) return 'unknown';
  if (flow < optimalMin * 0.5)                    return 'low';
  if (flow >= optimalMin && flow <= optimalMax)    return 'optimal';
  if (flow > optimalMax && flow <= optimalMax * 1.5) return 'elevated';
  if (flow > optimalMax * 1.5)                    return 'high';
  return 'unknown';
}

function calculateTrend(currentFlow: number, flowThreeHoursAgo: number): string {
  if (currentFlow > flowThreeHoursAgo * 1.10) return 'rising';
  if (currentFlow < flowThreeHoursAgo * 0.90) return 'falling';
  return 'stable';
}

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: rivers, error: riversError } = await supabase
      .from('rivers')
      .select('*');

    if (riversError) throw riversError;

    console.log(`Fetching data for ${rivers.length} rivers`);

    const results = [];

    for (const river of rivers) {
      try {
        const usgsUrl = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${river.usgs_station_id}&parameterCd=00060,00065,00010&siteStatus=all`;
        const response = await fetch(usgsUrl);
        const data: USGSResponse = await response.json();

        if (!data.value?.timeSeries) {
          console.log(`No data for ${river.name}`);
          continue;
        }

        let flow: number | null = null;
        let temperature: number | null = null;
        let gageHeight: number | null = null;
        let timestamp = new Date().toISOString();

        for (const series of data.value.timeSeries) {
          const paramCode = series.variable.variableCode[0].value;
          const values = series.values[0]?.value;
          if (!values || values.length === 0) continue;

          const latest = values[values.length - 1];
          timestamp = latest.dateTime;

          if (paramCode === '00060') {
            flow = parseFloat(latest.value);
          } else if (paramCode === '00010') {
            temperature = (parseFloat(latest.value) * 9) / 5 + 32;
          } else if (paramCode === '00065') {
            gageHeight = parseFloat(latest.value);
          }
        }

        const status = calculateStatus(flow, river.optimal_flow_min, river.optimal_flow_max);

        // Calculate trend from 3-hour-ago reading
        let trend = 'unknown';
        if (flow !== null && flow > -999000) {
          const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
          const { data: oldCondition } = await supabase
            .from('conditions')
            .select('flow')
            .eq('river_id', river.id)
            .lte('timestamp', threeHoursAgo)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

          if (oldCondition?.flow != null && oldCondition.flow > -999000) {
            trend = calculateTrend(flow, oldCondition.flow);
          }
        }

        const { error: insertError } = await supabase
          .from('conditions')
          .insert({ river_id: river.id, timestamp, flow, temperature, gage_height: gageHeight, status, trend });

        if (insertError) {
          console.error(`Insert error for ${river.name}:`, insertError);
        } else {
          results.push({ river: river.name, flow, status, trend });
        }

        // Avoid USGS rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`Error processing ${river.name}:`, err);
      }
    }

    console.log(`Processed ${results.length} rivers`);
    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Fatal error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
