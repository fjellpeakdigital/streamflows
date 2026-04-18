import { createClient } from '@/lib/supabase/server';
import { RiverCard } from '@/components/river-card';
import { RiverWithCondition } from '@/lib/types/database';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getFavoriteRivers() {
  const supabase = await createClient();
  const user = await requireUser();

  const { data: favorites } = await supabase
    .from('user_favorites').select('river_id').eq('user_id', user.id);
  if (!favorites || favorites.length === 0) return [];

  const riverIds = favorites.map((f) => f.river_id);

  const { data: rivers } = await supabase
    .from('rivers').select('*').in('id', riverIds).order('name');
  if (!rivers) return [];

  const { data: conditions } = await supabase
    .from('conditions').select('*').in('river_id', riverIds).order('timestamp', { ascending: false });

  const { data: species } = await supabase
    .from('river_species').select('*').in('river_id', riverIds);

  const { data: notes } = await supabase
    .from('user_notes').select('*').eq('user_id', user.id).in('river_id', riverIds);

  const riversWithConditions: RiverWithCondition[] = rivers.map((river) => {
    const riverConditions = conditions?.filter((c) => c.river_id === river.id) || [];
    const currentCondition = riverConditions[0];
    const riverSpecies = species?.filter((s) => s.river_id === river.id) || [];
    const trend = currentCondition?.trend ?? 'unknown';
    const userNote = notes?.find((n) => n.river_id === river.id);
    return { ...river, current_condition: currentCondition, species: riverSpecies, trend, is_favorite: true, user_note: userNote };
  });

  return riversWithConditions;
}

export default async function FavoritesPage() {
  const rivers = await getFavoriteRivers();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
          <Heart className="h-7 w-7 text-primary" />
          Favorite Rivers
        </h1>
        <p className="text-muted-foreground text-sm">
          Your saved spots — conditions at a glance
        </p>
      </div>

      {rivers.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border rounded-2xl">
          <Heart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-semibold text-lg mb-1">No favorites yet</p>
          <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
            Browse rivers and tap the heart icon to save your go-to spots.
          </p>
          <Link href="/rivers">
            <Button>Browse Rivers</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rivers.map((river) => (
            <RiverCard key={river.id} river={river} showFavorite={false} />
          ))}
        </div>
      )}
    </div>
  );
}
