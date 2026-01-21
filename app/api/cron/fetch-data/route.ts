import { createClient } from '@/lib/supabase/server';
import { calculateStatus } from '@/lib/river-utils';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    // Get all rivers
    const { data: rivers, error: riversError } = await supabase
      .from('rivers')
      .select('*');

    if (riversError || !rivers) {
      throw new Error('Failed to fetch rivers');
    }

    console.log(`Fetching data for ${rivers.length} rivers`);

    const results = [];

    for (const river of rivers) {
      try {
        // Fetch flow, temperature, and gage height data from USGS
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

        // Calculate status using utility function
        const status = calculateStatus(
          flow,
          river.optimal_flow_min,
          river.optimal_flow_max
        );

        // Insert condition
        const { error: insertError } = await supabase.from('conditions').insert({
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

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Error in fetch-data cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
