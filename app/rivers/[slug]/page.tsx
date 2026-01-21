import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RiverDetail } from './river-detail';
import { calculateTrend } from '@/lib/river-utils';

export const dynamic = 'force-dynamic';

async function getRiver(slug: string) {
  const supabase = await createClient();

  // Get river
  const { data: river, error: riverError } = await supabase
    .from('rivers')
    .select('*')
    .eq('slug', slug)
    .single();

  if (riverError || !river) {
    return null;
  }

  // Get last 24 hours of conditions
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const { data: conditions, error: conditionsError } = await supabase
    .from('conditions')
    .select('*')
    .eq('river_id', river.id)
    .gte('timestamp', twentyFourHoursAgo.toISOString())
    .order('timestamp', { ascending: true });

  if (conditionsError) {
    console.error('Error fetching conditions:', conditionsError);
  }

  // Get species
  const { data: species, error: speciesError } = await supabase
    .from('river_species')
    .select('*')
    .eq('river_id', river.id);

  if (speciesError) {
    console.error('Error fetching species:', speciesError);
  }

  // Get user data if logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let is_favorite = false;
  let user_note = null;

  if (user) {
    // Check if favorite
    const { data: favData } = await supabase
      .from('user_favorites')
      .select('*')
      .eq('user_id', user.id)
      .eq('river_id', river.id)
      .single();

    is_favorite = !!favData;

    // Get user note
    const { data: noteData } = await supabase
      .from('user_notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('river_id', river.id)
      .single();

    user_note = noteData;
  }

  // Calculate trend
  const allConditions = conditions || [];
  const trend = calculateTrend(allConditions.slice(-10));
  const currentCondition = allConditions[allConditions.length - 1];

  return {
    ...river,
    current_condition: currentCondition,
    conditions: allConditions,
    species: species || [],
    is_favorite,
    user_note,
    trend,
    user,
  };
}

export default async function RiverPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const riverData = await getRiver(slug);

  if (!riverData) {
    notFound();
  }

  return <RiverDetail riverData={riverData} />;
}
