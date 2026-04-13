import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { createClient } from "@/lib/supabase/server";

const openSans = Open_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "StreamFlows — Real-time River Conditions for Fly Fishing",
  description:
    "Track real-time river conditions, flows, and temperatures for New England fly fishing. Get alerts when conditions are optimal.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unavailable — render without auth state
  }

  return (
    <html lang="en">
      <body className={`${openSans.variable} font-sans antialiased`}>
        <Navigation user={user} />
        <main className="min-h-screen bg-background">
          {children}
        </main>
      </body>
    </html>
  );
}
