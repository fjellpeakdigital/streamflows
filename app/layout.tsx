import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { SidebarLoader } from "@/components/sidebar-loader";
import { MobileNav } from "@/components/mobile-nav";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { cache, Suspense } from "react";

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

  return (
    <html lang="en">
      <body className={`${openSans.variable} font-sans antialiased`}>
        {showSidebar ? (
          <>
            <Suspense fallback={
              <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-64 flex-col border-r border-border bg-white">
                <div className="px-4 py-5 border-b border-border">
                  <div className="h-6 w-32 rounded bg-muted animate-pulse" />
                </div>
                <div className="flex-1 p-3 space-y-2">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-7 rounded-md bg-muted animate-pulse" />
                  ))}
                </div>
              </aside>
            }>
              <SidebarLoader userId={user!.id} userEmail={user?.email ?? null} />
            </Suspense>
            <MobileNav activeAlertCount={0} />
            <main className="min-h-screen bg-background md:ml-64 pb-16 md:pb-0">
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
