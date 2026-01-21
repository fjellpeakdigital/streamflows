import { createClient } from '@/lib/supabase/server';
import { RiversList } from './rivers-list';
import { RiverWithCondition, RiverStatus } from '@/lib/types/database';
import { calculateTrend } from '@/lib/river-utils';

export const dynamic = 'force-dynamic';

async function getRivers() {
  const supabase = await createClient();

  // Get all rivers
  const { data: rivers, error: riversError } = await supabase
    .from('rivers')
    .select('*')
    .order('name');

  if (riversError) {
    console.error('Error fetching rivers:', riversError);
    return [];
  }

  // Get current conditions for all rivers (most recent per river)
  const { data: conditions, error: conditionsError } = await supabase
    .from('conditions')
    .select('*')
    .order('timestamp', { ascending: false });

  if (conditionsError) {
    console.error('Error fetching conditions:', conditionsError);
  }

  // Get species for all rivers
  const { data: species, error: speciesError } = await supabase
    .from('river_species')
    .select('*');

  if (speciesError) {
    console.error('Error fetching species:', speciesError);
  }

  // Get user favorites if logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let favorites: any[] = [];
  if (user) {
    const { data: favData } = await supabase
      .from('user_favorites')
      .select('river_id')
      .eq('user_id', user.id);
    favorites = favData || [];
  }

  // Combine data
  const riversWithConditions: RiverWithCondition[] = rivers.map((river) => {
    // Get most recent condition for this river
    const riverConditions = conditions?.filter((c) => c.river_id === river.id) || [];
    const currentCondition = riverConditions[0];

    // Get species for this river
    const riverSpecies = species?.filter((s) => s.river_id === river.id) || [];

    // Calculate trend
    const trend = calculateTrend(riverConditions.slice(0, 10));

    // Check if favorite
    const is_favorite = favorites.some((f) => f.river_id === river.id);

    return {
      ...river,
      current_condition: currentCondition,
      species: riverSpecies,
      trend,
      is_favorite,
    };
  });

  return riversWithConditions;
}

// Get stats for dashboard
async function getStats(rivers: RiverWithCondition[]) {
  const statusCounts: Record<RiverStatus, number> = {
    optimal: 0,
    elevated: 0,
    high: 0,
    low: 0,
    ice_affected: 0,
  };

  rivers.forEach((river) => {
    const status = river.current_condition?.status;
    if (status) {
      statusCounts[status]++;
    } else {
      statusCounts.low++;
    }
  });

  return {
    total: rivers.length,
    statusCounts,
  };
}

export default async function RiversPage() {
  const rivers = await getRivers();
  const stats = await getStats(rivers);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">River Conditions</h1>
        <p className="text-muted-foreground">
          Real-time flow data for {stats.total} New England rivers
        </p>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700">
            {stats.statusCounts.optimal}
          </div>
          <div className="text-sm text-green-600">Optimal</div>
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-700">
            {stats.statusCounts.elevated}
          </div>
          <div className="text-sm text-yellow-600">Elevated</div>
        </div>
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-700">
            {stats.statusCounts.high}
          </div>
          <div className="text-sm text-red-600">High</div>
        </div>
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-700">
            {stats.statusCounts.low}
          </div>
          <div className="text-sm text-blue-600">Low</div>
        </div>
        <div className="bg-sky-50 border-2 border-sky-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-sky-700">
            {stats.statusCounts.ice_affected}
          </div>
          <div className="text-sm text-sky-600">Ice Affected</div>
        </div>
      </div>

      <RiversList rivers={rivers} />
    </div>
  );
}
