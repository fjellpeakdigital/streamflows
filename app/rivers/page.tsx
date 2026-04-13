import { createClient } from '@/lib/supabase/server';
import { RiversList } from './rivers-list';
import { RiverWithCondition, RiverStatus } from '@/lib/types/database';
import { getStatusDotColor, getStatusLabel, calculateStatus } from '@/lib/river-utils';

export const dynamic = 'force-dynamic';

async function getRivers() {
  const supabase = await createClient();

  const { data: rivers, error: riversError } = await supabase
    .from('rivers')
    .select('*')
    .order('name');

  if (riversError) {
    console.error('Error fetching rivers:', riversError);
    return [];
  }

  const { data: conditions } = await supabase
    .from('conditions')
    .select('*')
    .order('timestamp', { ascending: false });

  const { data: species } = await supabase
    .from('river_species')
    .select('*');

  const { data: { user } } = await supabase.auth.getUser();

  let favorites: any[] = [];
  if (user) {
    const { data: favData } = await supabase
      .from('user_favorites')
      .select('river_id')
      .eq('user_id', user.id);
    favorites = favData || [];
  }

  const riversWithConditions: RiverWithCondition[] = rivers.map((river) => {
    const riverConditions = conditions?.filter((c) => c.river_id === river.id) || [];
    const currentCondition = riverConditions[0];
    const riverSpecies = species?.filter((s) => s.river_id === river.id) || [];
    const trend = currentCondition?.trend ?? 'unknown';
    const is_favorite = favorites.some((f) => f.river_id === river.id);

    // If status wasn't stored by the Edge Function, calculate it from raw flow data
    if (currentCondition && !currentCondition.status) {
      currentCondition.status = calculateStatus(
        currentCondition.flow,
        river.optimal_flow_min,
        river.optimal_flow_max
      );
    }

    return { ...river, current_condition: currentCondition, species: riverSpecies, trend, is_favorite };
  });

  return riversWithConditions;
}

async function getStats(rivers: RiverWithCondition[]) {
  const statusCounts: Record<RiverStatus, number> = {
    optimal: 0, elevated: 0, high: 0, low: 0, ice_affected: 0, unknown: 0,
  };
  rivers.forEach((river) => {
    const status = river.current_condition?.status ?? 'unknown';
    statusCounts[status as RiverStatus]++;
  });
  return { total: rivers.length, statusCounts };
}

const STATUS_ORDER: RiverStatus[] = ['optimal', 'elevated', 'high', 'low', 'ice_affected'];

export default async function RiversPage() {
  const rivers = await getRivers();
  const stats = await getStats(rivers);

  return (
    <div className="container mx-auto px-4 py-8">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">River Conditions</h1>
        <p className="text-muted-foreground text-sm">
          Real-time flow data for {stats.total} New England rivers
        </p>
      </div>

      {/* Status summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">
        {STATUS_ORDER.map((status) => {
          const count = stats.statusCounts[status];
          return (
            <div
              key={status}
              className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3"
            >
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${getStatusDotColor(status)}`} />
              <div className="min-w-0">
                <div className="text-xl font-bold leading-tight">{count}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {getStatusLabel(status)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <RiversList rivers={rivers} />
    </div>
  );
}
