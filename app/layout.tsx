import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { createClient } from "@/lib/supabase/server";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StreamFlows - Real-time River Conditions for Fly Fishing",
  description: "Track real-time river conditions, flows, and temperatures for New England fly fishing. Get alerts when conditions are optimal.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Navigation user={user} />
        <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
          {children}
        </main>
      </body>
    </html>
  );
}
