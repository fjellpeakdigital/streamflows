import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Bell,
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Droplets,
  Waves,
  Thermometer,
  Clock,
  Target,
  BarChart3,
  BookOpen,
  Shield,
  Users,
  Map,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Radio,
  SlidersHorizontal,
  Gauge,
  Star,
} from 'lucide-react';

/* ────────────────────────────────────────────
   Section 1 — Hero
   ──────────────────────────────────────────── */

function HeroMockupCard({
  name,
  region,
  flow,
  status,
  statusColor,
  trend,
  trendIcon,
  temp,
}: {
  name: string;
  region: string;
  flow: string;
  status: string;
  statusColor: string;
  trend: string;
  trendIcon: React.ReactNode;
  temp: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-4 space-y-3">
      <div>
        <div className="font-semibold text-sm text-foreground leading-tight">{name}</div>
        <div className="text-xs text-muted-foreground">{region}</div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${statusColor}`}>
          {status}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {trendIcon}
          {trend}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-secondary rounded-md px-2.5 py-1.5">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Waves className="h-2.5 w-2.5" />Flow</div>
          <div className="text-xs font-semibold text-foreground">{flow}</div>
        </div>
        <div className="bg-secondary rounded-md px-2.5 py-1.5">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Thermometer className="h-2.5 w-2.5" />Temp</div>
          <div className="text-xs font-semibold text-foreground">{temp}</div>
        </div>
      </div>
      {/* Mini sparkline mockup */}
      <div className="h-8 w-full rounded bg-secondary flex items-end px-1 gap-px">
        {[40, 45, 42, 50, 55, 52, 48, 53, 58, 55, 60, 57].map((v, i) => (
          <div
            key={i}
            className="flex-1 bg-primary/40 rounded-t-sm"
            style={{ height: `${v}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-background to-background">
      {/* Subtle decorative gradient */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(ellipse_at_top_right,hsl(200,65%,38%,0.06),transparent_60%)] pointer-events-none" />

      <div className="relative container mx-auto px-4 pt-12 pb-16 md:pt-20 md:pb-24 lg:pt-24 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left — Copy */}
          <div className="max-w-xl">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 bg-primary/8 border border-primary/15 rounded-full px-3.5 py-1 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-primary tracking-wide uppercase">
                Live Data &middot; Updated Every 15 Min
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.08] tracking-tight text-foreground mb-5">
              Real-Time River Intelligence for{' '}
              <span className="text-primary">New England</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed">
              Stop guessing. StreamFlows translates raw USGS gauge data into clear,
              fishable-or-not conditions for 50+ rivers across 6 states — so you know
              exactly where to go before you load the truck.
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
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>

          {/* Right — Product Mockup */}
          <div className="relative">
            {/* Glow behind mockup */}
            <div className="absolute -inset-4 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 rounded-3xl blur-2xl pointer-events-none" />

            <div className="relative bg-secondary/50 border border-border rounded-2xl p-4 sm:p-5 shadow-lg">
              {/* Mockup header bar */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                    <Droplets className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">River Conditions</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Just now</span>
                </div>
              </div>

              {/* Mocked river cards */}
              <div className="grid sm:grid-cols-2 gap-3">
                <HeroMockupCard
                  name="Deerfield River"
                  region="Western MA"
                  flow="342 CFS"
                  status="Optimal"
                  statusColor="bg-emerald-100 text-emerald-800 border-emerald-200"
                  trend="Stable"
                  trendIcon={<Minus className="h-3 w-3 text-muted-foreground" />}
                  temp="54.2°F"
                />
                <HeroMockupCard
                  name="Farmington River"
                  region="Northern CT"
                  flow="485 CFS"
                  status="Elevated"
                  statusColor="bg-amber-100 text-amber-800 border-amber-200"
                  trend="Rising"
                  trendIcon={<TrendingUp className="h-3 w-3 text-amber-500" />}
                  temp="52.8°F"
                />
                <HeroMockupCard
                  name="Swift River"
                  region="Central MA"
                  flow="128 CFS"
                  status="Optimal"
                  statusColor="bg-emerald-100 text-emerald-800 border-emerald-200"
                  trend="Falling"
                  trendIcon={<TrendingDown className="h-3 w-3 text-blue-500" />}
                  temp="48.6°F"
                />
                <HeroMockupCard
                  name="White River"
                  region="Central VT"
                  flow="1,240 CFS"
                  status="High"
                  statusColor="bg-red-100 text-red-800 border-red-200"
                  trend="Rising"
                  trendIcon={<TrendingUp className="h-3 w-3 text-amber-500" />}
                  temp="46.1°F"
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   Section 2 — Trust / Proof Bar
   ──────────────────────────────────────────── */

const trustItems = [
  { icon: Map, value: '50+', label: 'New England Rivers' },
  { icon: Shield, value: '6', label: 'States Covered' },
  { icon: Radio, value: '15 min', label: 'Update Frequency' },
  { icon: Activity, value: 'USGS', label: 'Powered by Live Data' },
  { icon: SlidersHorizontal, value: 'Tuned', label: 'River-Specific Ranges' },
];

function TrustBar() {
  return (
    <section className="bg-white border-y border-border">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 lg:gap-8">
          {trustItems.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/8 shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-lg font-bold text-foreground leading-tight">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   Sections 3-8 — Placeholders (to be built)
   ──────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <TrustBar />
    </div>
  );
}
