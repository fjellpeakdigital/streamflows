import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AlertsList } from './alerts-list';

export const dynamic = 'force-dynamic';

async function getUserAlerts() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's alerts with river information
  const { data: alerts } = await supabase
    .from('user_alerts')
    .select('*, rivers(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Get all rivers for the add alert form
  const { data: rivers } = await supabase
    .from('rivers')
    .select('id, name, slug')
    .order('name');

  return {
    alerts: alerts || [],
    rivers: rivers || [],
  };
}

export default async function AlertsPage() {
  const { alerts, rivers } = await getUserAlerts();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">River Alerts</h1>
        <p className="text-muted-foreground">
          Get notified when your rivers hit optimal conditions
        </p>
      </div>

      <AlertsList alerts={alerts} rivers={rivers} />
    </div>
  );
}
