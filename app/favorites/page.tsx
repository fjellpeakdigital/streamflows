import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RiverCard } from '@/components/river-card';
import { RiverWithCondition } from '@/lib/types/database';
import { calculateTrend } from '@/lib/river-utils';

export const dynamic = 'force-dynamic';

async function getFavoriteRivers() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's favorite river IDs
  const { data: favorites } = await supabase
    .from('user_favorites')
    .select('river_id')
    .eq('user_id', user.id);

  if (!favorites || favorites.length === 0) {
    return [];
  }

  const riverIds = favorites.map((f) => f.river_id);

  // Get rivers
  const { data: rivers } = await supabase
    .from('rivers')
    .select('*')
    .in('id', riverIds)
    .order('name');

  if (!rivers) {
    return [];
  }

  // Get current conditions
  const { data: conditions } = await supabase
    .from('conditions')
    .select('*')
    .in('river_id', riverIds)
    .order('timestamp', { ascending: false });

  // Get species
  const { data: species } = await supabase
    .from('river_species')
    .select('*')
    .in('river_id', riverIds);

  // Get user notes
  const { data: notes } = await supabase
    .from('user_notes')
    .select('*')
    .eq('user_id', user.id)
    .in('river_id', riverIds);

  // Combine data
  const riversWithConditions: RiverWithCondition[] = rivers.map((river) => {
    const riverConditions =
      conditions?.filter((c) => c.river_id === river.id) || [];
    const currentCondition = riverConditions[0];
    const riverSpecies = species?.filter((s) => s.river_id === river.id) || [];
    const trend = calculateTrend(riverConditions.slice(0, 10));
    const userNote = notes?.find((n) => n.river_id === river.id);

    return {
      ...river,
      current_condition: currentCondition,
      species: riverSpecies,
      trend,
      is_favorite: true,
      user_note: userNote,
    };
  });

  return riversWithConditions;
}

export default async function FavoritesPage() {
  const rivers = await getFavoriteRivers();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">My Favorite Rivers</h1>
        <p className="text-muted-foreground">
          Track conditions for your go-to fishing spots
        </p>
      </div>

      {rivers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg mb-4">
            You haven't added any favorite rivers yet.
          </p>
          <a
            href="/rivers"
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/90"
          >
            Browse Rivers
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rivers.map((river) => (
            <RiverCard key={river.id} river={river} showFavorite={false} />
          ))}
        </div>
      )}
    </div>
  );
}
