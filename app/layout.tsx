import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";

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
        <Footer />
      </body>
    </html>
  );
}
