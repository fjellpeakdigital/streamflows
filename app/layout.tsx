import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { Sidebar } from "@/components/sidebar";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { cache } from "react";
import type { Condition, River, RiverWithCondition } from "@/lib/types/database";

/**
 * Cached per-request Supabase user lookup. Import from this module anywhere
 * a server-side RSC needs the current user — the result is memoized for the
 * duration of a single render, so layout + page don't issue duplicate calls.
 */
export const getCachedUser = cache(async () => {
  try {
    const supabase = await createClient();
    return await supabase.auth.getUser();
  } catch {
    return { data: { user: null }, error: null } as const;
  }
});


const openSans = Open_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "StreamFlows — Real-Time River Intelligence for Fly Fishing",
  description:
    "Real-time river conditions for 50+ New England rivers. StreamFlows translates live USGS gauge data into actionable fishing intelligence — optimal flows, trends, alerts, and more.",
};

async function getUpcomingTripCount(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const todayIso = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'upcoming')
      .gte('trip_date', todayIso);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function getActiveAlertCount(userId: string, riverIds: string[]): Promise<number> {
  if (riverIds.length === 0) return 0;
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from('user_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true)
      .in('river_id', riverIds);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function getRosterRivers(userId: string): Promise<{
  rivers: RiverWithCondition[];
  lastSyncedAt: string | null;
}> {
  try {
    const supabase = await createClient();

    const { data: roster } = await supabase
      .from('user_roster')
      .select('river_id, sort_order, rivers(*)')
      .eq('user_id', userId)
      .eq('archived', false)
      .order('sort_order', { ascending: true });

    if (!roster || roster.length === 0) {
      return { rivers: [], lastSyncedAt: null };
    }

    const rivers = roster
      .map((r: any) => r.rivers as River | null)
      .filter((r): r is River => r !== null);

    const riverIds = rivers.map((r) => r.id);

    const seventyTwoHoursAgo = new Date();
    seventyTwoHoursAgo.setHours(seventyTwoHoursAgo.getHours() - 72);

    const { data: conditions } = await supabase
      .from('conditions')
      .select('*')
      .in('river_id', riverIds)
      .gte('timestamp', seventyTwoHoursAgo.toISOString())
      .order('timestamp', { ascending: false });

    const latestByRiver = new Map<string, Condition>();
    if (conditions) {
      for (const c of conditions as Condition[]) {
        if (!latestByRiver.has(c.river_id)) {
          latestByRiver.set(c.river_id, c);
        }
      }
    }

    let lastSyncedAt: string | null = null;
    for (const c of latestByRiver.values()) {
      if (!lastSyncedAt || c.timestamp > lastSyncedAt) {
        lastSyncedAt = c.timestamp;
      }
    }

    const withConditions: RiverWithCondition[] = rivers.map((r) => ({
      ...r,
      current_condition: latestByRiver.get(r.id),
    }));

    return { rivers: withConditions, lastSyncedAt };
  } catch {
    return { rivers: [], lastSyncedAt: null };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let user: { id: string; email?: string | null } | null = null;
  const { data, error } = await getCachedUser();
  if (!error && data?.user && typeof data.user.id === 'string' && data.user.id.length > 0) {
    user = data.user;
  }

  const isAuthenticated = user !== null;
  const pathname = (await headers()).get('x-pathname') ?? '/';
  const showSidebar = isAuthenticated && pathname !== '/';

  let rosterData: { rivers: RiverWithCondition[]; lastSyncedAt: string | null } | null = null;
  let activeAlertCount = 0;
  let upcomingTripCount = 0;

  if (showSidebar) {
    const rosterPromise = getRosterRivers(user!.id);
    const alertPromise = rosterPromise.then((rd) =>
      getActiveAlertCount(user!.id, rd.rivers.map((r) => r.id))
    );
    const tripPromise = getUpcomingTripCount(user!.id);

    const [rd, ac, uc] = await Promise.all([rosterPromise, alertPromise, tripPromise]);
    rosterData = rd;
    activeAlertCount = ac;
    upcomingTripCount = uc;
  }

  return (
    <html lang="en">
      <body className={`${openSans.variable} font-sans antialiased`}>
        {showSidebar ? (
          <>
            <Sidebar
              rivers={rosterData?.rivers ?? []}
              lastSyncedAt={rosterData?.lastSyncedAt ?? null}
              activeAlertCount={activeAlertCount}
              upcomingTripCount={upcomingTripCount}
              userEmail={user?.email ?? null}
            />
            <main className="min-h-screen bg-background md:ml-64">
              {children}
            </main>
          </>
        ) : (
          <>
            <Navigation user={user} />
            <main className="min-h-screen bg-background">{children}</main>
            <Footer />
          </>
        )}
      </body>
    </html>
  );
}
