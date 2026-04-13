import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchWeatherForecast } from '@/lib/weather';
import { calculateFlowEta } from '@/lib/flow-eta';
import { RiverDetail } from './river-detail';

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

  // Get recent check-ins (public + user's own if logged in)
  let checkinsQuery = supabase
    .from('river_checkins')
    .select('*')
    .eq('river_id', river.id)
    .order('fished_at', { ascending: false })
    .limit(20);

  if (user) {
    checkinsQuery = checkinsQuery.or(`is_public.eq.true,user_id.eq.${user.id}`);
  } else {
    checkinsQuery = checkinsQuery.eq('is_public', true);
  }

  const { data: checkinsRaw } = await checkinsQuery;

  const checkins = (checkinsRaw ?? []).map((c) => ({
    ...c,
    is_own: user?.id === c.user_id,
    display_name: user?.id === c.user_id ? 'You' : 'Angler',
  }));

  const allConditions = conditions || [];
  const currentCondition = allConditions[allConditions.length - 1];
  // Read trend from the most recent condition (stored by the cron job)
  const trend = currentCondition?.trend ?? 'unknown';

  const eta = calculateFlowEta(allConditions, river.optimal_flow_min, river.optimal_flow_max);

  const weather = river.latitude && river.longitude
    ? await fetchWeatherForecast(river.latitude, river.longitude)
    : null;

  return {
    ...river,
    current_condition: currentCondition,
    conditions: allConditions,
    species: species || [],
    is_favorite,
    user_note,
    trend,
    user,
    checkins,
    eta,
    weather,
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
