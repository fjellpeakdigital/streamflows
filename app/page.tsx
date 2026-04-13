import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Activity, Bell, Heart, TrendingUp, ChevronRight, Droplets } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-secondary/30 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(0,55%,52%,0.12),transparent_60%)] pointer-events-none" />

        <div className="relative container mx-auto px-4 py-16 md:py-24 lg:py-32">
          <div className="max-w-3xl">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-semibold text-primary tracking-wider uppercase">
                Live Data · Updated Every 15 Min
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
              Know Your
              <span className="block text-primary">River.</span>
              <span className="block text-foreground/70 text-4xl sm:text-5xl lg:text-6xl font-semibold mt-1">
                Fish Smarter.
              </span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl mb-8 leading-relaxed">
              Real-time flow data for 50+ New England rivers — built for fly fishing guides who
              can't afford to show up to blown-out conditions.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/rivers">
                <Button size="lg" className="gap-2 text-base h-12 px-6">
                  View Live Conditions
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="lg" variant="outline" className="gap-2 text-base h-12 px-6">
                  Get Flow Alerts
                </Button>
              </Link>
            </div>

            {/* Inline social proof */}
            <div className="flex items-center gap-6 mt-10 pt-8 border-t border-border">
              <div>
                <div className="text-2xl font-bold text-foreground">50+</div>
                <div className="text-xs text-muted-foreground">NE Rivers</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div>
                <div className="text-2xl font-bold text-foreground">6</div>
                <div className="text-xs text-muted-foreground">States</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div>
                <div className="text-2xl font-bold text-foreground">15 min</div>
                <div className="text-xs text-muted-foreground">Updates</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">
          Everything a guide needs
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Activity,
              title: 'Real-time Data',
              desc: 'Live USGS flow and temperature data refreshed every 15 minutes.',
            },
            {
              icon: Heart,
              title: 'Favorite Rivers',
              desc: 'Pin your go-to spots and check conditions at a glance.',
            },
            {
              icon: Bell,
              title: 'Smart Alerts',
              desc: 'Get notified the moment your river hits optimal fishing conditions.',
            },
            {
              icon: TrendingUp,
              title: 'Flow Trends',
              desc: 'See whether conditions are rising, falling, or holding steady.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group bg-card border border-border rounded-xl p-6 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Strip ── */}
      <section className="container mx-auto px-4 pb-20">
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-8 md:p-12 text-center">
          <Droplets className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-3">Ready to fish smarter?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Join guides across New England who rely on StreamFlows before every trip.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/rivers">
              <Button size="lg" className="gap-2">
                Browse All Rivers
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" variant="outline">
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
