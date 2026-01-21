import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface USGSResponse {
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

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all rivers
    const { data: rivers, error: riversError } = await supabaseClient
      .from('rivers')
      .select('*');

    if (riversError) {
      throw riversError;
    }

    console.log(`Fetching data for ${rivers.length} rivers`);

    // Fetch data for each river
    const results = [];

    for (const river of rivers) {
      try {
        // Fetch flow, temperature, and gage height data
        const usgsUrl = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${river.usgs_station_id}&parameterCd=00060,00065,00010&siteStatus=all`;

        const response = await fetch(usgsUrl);
        const data: USGSResponse = await response.json();

        if (!data.value?.timeSeries) {
          console.log(`No data for ${river.name}`);
          continue;
        }

        let flow = null;
        let temperature = null;
        let gageHeight = null;
        let timestamp = new Date().toISOString();

        // Parse USGS data
        for (const series of data.value.timeSeries) {
          const paramCode = series.variable.variableCode[0].value;
          const values = series.values[0]?.value;

          if (!values || values.length === 0) continue;

          const latestValue = values[values.length - 1];
          timestamp = latestValue.dateTime;

          // 00060 = Discharge (flow in CFS)
          if (paramCode === '00060') {
            flow = parseFloat(latestValue.value);
          }
          // 00010 = Temperature (Celsius - convert to Fahrenheit)
          else if (paramCode === '00010') {
            const celsius = parseFloat(latestValue.value);
            temperature = (celsius * 9) / 5 + 32;
          }
          // 00065 = Gage height (feet)
          else if (paramCode === '00065') {
            gageHeight = parseFloat(latestValue.value);
          }
        }

        // Calculate status
        let status = 'low';
        if (flow && river.optimal_flow_min && river.optimal_flow_max) {
          // Check for ice-affected (winter months + very low flow)
          const date = new Date();
          const month = date.getMonth();
          if ((month === 0 || month === 1 || month === 11) && flow < river.optimal_flow_min * 0.5) {
            status = 'ice_affected';
          } else if (flow >= river.optimal_flow_min && flow <= river.optimal_flow_max) {
            status = 'optimal';
          } else if (flow > river.optimal_flow_max && flow <= river.optimal_flow_max * 1.5) {
            status = 'elevated';
          } else if (flow > river.optimal_flow_max * 1.5) {
            status = 'high';
          } else {
            status = 'low';
          }
        }

        // Insert condition
        const { error: insertError } = await supabaseClient
          .from('conditions')
          .insert({
            river_id: river.id,
            timestamp,
            flow,
            temperature,
            gage_height: gageHeight,
            status,
          });

        if (insertError) {
          console.error(`Error inserting condition for ${river.name}:`, insertError);
        } else {
          results.push({
            river: river.name,
            flow,
            temperature,
            status,
          });
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing ${river.name}:`, error);
      }
    }

    // Check for alerts and send notifications (simplified version)
    // In production, you'd integrate with an email service like Resend or SendGrid
    const { data: activeAlerts } = await supabaseClient
      .from('user_alerts')
      .select('*, rivers(*), conditions!inner(*)')
      .eq('is_active', true);

    console.log(`Processed ${results.length} rivers`);
    console.log(`Found ${activeAlerts?.length || 0} active alerts`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        alerts: activeAlerts?.length || 0,
        results,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in fetch-usgs-data:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
