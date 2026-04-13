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
   Section 3 — Live River Snapshot
   ──────────────────────────────────────────── */

const snapshotRivers = [
  {
    name: 'Deerfield River',
    region: 'Western MA',
    flow: 342,
    temp: 54.2,
    status: 'optimal' as const,
    trend: 'stable' as const,
    optRange: '200–500 CFS',
    species: ['Trout', 'Salmon'],
  },
  {
    name: 'Farmington River',
    region: 'Northern CT',
    flow: 485,
    temp: 52.8,
    status: 'elevated' as const,
    trend: 'rising' as const,
    optRange: '180–400 CFS',
    species: ['Trout'],
  },
  {
    name: 'Swift River',
    region: 'Central MA',
    flow: 128,
    temp: 48.6,
    status: 'optimal' as const,
    trend: 'falling' as const,
    optRange: '80–200 CFS',
    species: ['Trout'],
  },
  {
    name: 'Battenkill River',
    region: 'Southern VT',
    flow: 215,
    temp: 50.4,
    status: 'optimal' as const,
    trend: 'stable' as const,
    optRange: '150–350 CFS',
    species: ['Trout', 'Bass'],
  },
];

const statusConfig = {
  optimal:  { label: 'Optimal',  color: 'bg-emerald-100 text-emerald-800 border-emerald-200', border: 'border-l-emerald-500', dot: 'bg-emerald-500' },
  elevated: { label: 'Elevated', color: 'bg-amber-100 text-amber-800 border-amber-200',     border: 'border-l-amber-500',   dot: 'bg-amber-500' },
  high:     { label: 'High',     color: 'bg-red-100 text-red-800 border-red-200',            border: 'border-l-red-500',     dot: 'bg-red-500' },
  low:      { label: 'Low',      color: 'bg-blue-100 text-blue-800 border-blue-200',         border: 'border-l-blue-500',    dot: 'bg-blue-500' },
};

function TrendDisplay({ trend }: { trend: 'rising' | 'falling' | 'stable' }) {
  if (trend === 'rising')  return <span className="flex items-center gap-1 text-xs text-amber-600"><TrendingUp className="h-3.5 w-3.5" />Rising</span>;
  if (trend === 'falling') return <span className="flex items-center gap-1 text-xs text-blue-600"><TrendingDown className="h-3.5 w-3.5" />Falling</span>;
  return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3.5 w-3.5" />Stable</span>;
}

function LiveSnapshotSection() {
  return (
    <section className="container mx-auto px-4 py-16 md:py-20">
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
          What&apos;s fishing right now
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          A quick look at conditions across some of New England&apos;s top fly fishing rivers.
          Updated every 15 minutes from live USGS gauges.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {snapshotRivers.map((river) => {
          const cfg = statusConfig[river.status];
          return (
            <div
              key={river.name}
              className={`bg-white rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow border-l-4 ${cfg.border} p-4 space-y-3`}
            >
              {/* Name + region */}
              <div>
                <h3 className="font-semibold text-foreground leading-tight">{river.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{river.region}</p>
              </div>

              {/* Status + trend */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${cfg.color}`}>
                  {cfg.label}
                </span>
                <TrendDisplay trend={river.trend} />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-secondary rounded-lg px-2.5 py-2">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                    <Waves className="h-2.5 w-2.5" />Flow
                  </div>
                  <div className="text-sm font-semibold text-foreground">{river.flow.toLocaleString()} CFS</div>
                </div>
                <div className="bg-secondary rounded-lg px-2.5 py-2">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                    <Thermometer className="h-2.5 w-2.5" />Temp
                  </div>
                  <div className="text-sm font-semibold text-foreground">{river.temp.toFixed(1)}&deg;F</div>
                </div>
              </div>

              {/* Optimal range */}
              <p className="text-xs text-muted-foreground">
                Optimal: {river.optRange}
              </p>

              {/* Species */}
              <div className="flex gap-1 flex-wrap">
                {river.species.map((s) => (
                  <span key={s} className="inline-flex items-center px-2 py-0 rounded-full text-xs bg-secondary text-muted-foreground font-medium">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center mt-8">
        <Link href="/rivers">
          <Button variant="outline" className="gap-2">
            Browse All 50+ Rivers
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   Section 4 — How It Works
   ──────────────────────────────────────────── */

const howItWorksSteps = [
  {
    number: '01',
    icon: Radio,
    title: 'Live USGS gauge data',
    description:
      'We pull discharge, temperature, and gage height directly from USGS Water Services stations every 15 minutes.',
  },
  {
    number: '02',
    icon: SlidersHorizontal,
    title: 'River-specific thresholds',
    description:
      'Each river has hand-tuned optimal flow ranges based on real fishing conditions — not generic defaults.',
  },
  {
    number: '03',
    icon: Target,
    title: 'Actionable status labels',
    description:
      'Raw CFS numbers become clear conditions: Optimal, Elevated, High, Low, or Ice-Affected. No interpretation needed.',
  },
  {
    number: '04',
    icon: BarChart3,
    title: 'Trends and context',
    description:
      'See whether flows are rising, falling, or stable — plus 24-hour charts so you can spot the window before it closes.',
  },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-white border-y border-border">
      <div className="container mx-auto px-4 py-16 md:py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            How StreamFlows works
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            We turn raw government gauge data into fishing intelligence you can act on in seconds.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {howItWorksSteps.map(({ number, icon: Icon, title, description }) => (
            <div key={number} className="relative">
              {/* Step number */}
              <div className="text-5xl font-bold text-primary/10 leading-none mb-3">
                {number}
              </div>
              <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-primary/8 mb-3">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground text-base mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   Section 5 — Feature Deep-Dives
   ──────────────────────────────────────────── */

const features = [
  {
    icon: Gauge,
    title: 'Know what\u2019s fishable right now',
    description:
      'Every river shows a clear status — Optimal, Elevated, High, Low, or Ice-Affected. No more squinting at raw CFS numbers trying to decide if conditions are worth the drive.',
    detail: 'Status is calculated from river-specific optimal ranges, not generic thresholds.',
  },
  {
    icon: BarChart3,
    title: 'See where conditions are headed',
    description:
      'Trend arrows and 24-hour flow charts show whether a river is rising, falling, or holding steady. Spot the window opening — or closing — before anyone else does.',
    detail: 'Trends compare current flow against 3-hour-ago readings for reliable direction.',
  },
  {
    icon: Heart,
    title: 'Watch your home waters',
    description:
      'Pin your go-to rivers and see them all in one view. No more bookmarking five USGS pages and checking them one by one before every trip.',
    detail: 'Your favorites dashboard shows status, flow, temp, and trend at a glance.',
  },
  {
    icon: Bell,
    title: 'Get alerts when the river turns on',
    description:
      'Set thresholds for optimal flow, specific CFS levels, or temperature targets. StreamFlows watches the gauges so you don\u2019t have to.',
    detail: 'Alerts trigger on real-time data checks every 15 minutes.',
  },
  {
    icon: BookOpen,
    title: 'Keep private notes on every river',
    description:
      'Record what worked, where you put in, which flies produced. Your notes stay private and attached to each river for next time.',
    detail: 'Build a personal field guide that\u2019s always connected to live conditions.',
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="container mx-auto px-4 py-16 md:py-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
          Built for how guides actually work
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Every feature exists because someone needed it on the water — not because it looked good on a feature list.
        </p>
      </div>

      <div className="space-y-6">
        {features.map(({ icon: Icon, title, description, detail }, i) => (
          <div
            key={title}
            className={`flex flex-col md:flex-row gap-6 md:gap-10 items-start bg-white border border-border rounded-2xl p-6 md:p-8 ${
              i % 2 === 1 ? 'md:flex-row-reverse' : ''
            }`}
          >
            {/* Icon block */}
            <div className="shrink-0">
              <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-primary/8">
                <Icon className="h-7 w-7 text-primary" />
              </div>
            </div>

            {/* Copy */}
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
              <p className="text-muted-foreground leading-relaxed mb-3">{description}</p>
              <p className="text-sm text-primary/80 font-medium">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   Section 6 — Audience (For Guides / For Anglers)
   ──────────────────────────────────────────── */

const guidesBenefits = [
  'Check conditions across multiple rivers before planning a client day',
  'See at a glance which rivers are fishing well right now',
  'Get alerts when your backup rivers hit optimal windows',
  'Keep private notes on access points, hatches, and patterns',
  'Stop wasting client time driving to blown-out water',
];

const anglersBenefits = [
  'Track your favorite rivers in one dashboard instead of multiple USGS tabs',
  'Understand whether a river is fishable without interpreting raw CFS',
  'See flow trends so you can plan trips around rising or falling water',
  'Get notified when your home water hits the sweet spot',
  'Spend less time researching conditions and more time fishing',
];

function AudienceSection() {
  return (
    <section id="for-guides" className="bg-white border-y border-border">
      <div className="container mx-auto px-4 py-16 md:py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Built for people who take fishing seriously
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Whether you&apos;re running trips or chasing your own fish, StreamFlows saves you time and puts you on better water.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* For Guides */}
          <div className="bg-background rounded-2xl border border-border p-6 md:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-primary/8">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">For Guides</h3>
                <p className="text-sm text-muted-foreground">Make better decisions for your clients</p>
              </div>
            </div>
            <ul className="space-y-3">
              {guidesBenefits.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* For Anglers */}
          <div className="bg-background rounded-2xl border border-border p-6 md:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-accent/10">
                <Star className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">For Serious Anglers</h3>
                <p className="text-sm text-muted-foreground">Stop guessing, start catching</p>
              </div>
            </div>
            <ul className="space-y-3">
              {anglersBenefits.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4.5 w-4.5 text-accent shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   Section 7 — "Why Not Just Use USGS?" Comparison
   ──────────────────────────────────────────── */

const withoutItems = [
  'Open multiple USGS pages for each river',
  'Interpret raw CFS numbers yourself',
  'Guess whether conditions are fishable',
  'No trend context — just a single snapshot',
  'Miss optimal windows because you weren\u2019t checking',
  'No way to save rivers or take notes',
];

const withItems = [
  'One dashboard for all 50+ rivers',
  'Clear status labels: Optimal, Elevated, High, Low',
  'Know instantly which rivers are fishing well',
  'Trend arrows and 24-hour charts show direction',
  'Alerts notify you the moment conditions change',
  'Favorites, notes, and alerts — all in one place',
];

function ComparisonSection() {
  return (
    <section className="container mx-auto px-4 py-16 md:py-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
          Why not just use USGS directly?
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          USGS provides great raw data. StreamFlows makes it useful for fishing.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Without */}
        <div className="bg-white rounded-2xl border border-border p-6 md:p-8">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-red-100">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Without StreamFlows</h3>
          </div>
          <ul className="space-y-3">
            {withoutItems.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* With */}
        <div className="bg-white rounded-2xl border-2 border-primary/20 p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground">With StreamFlows</h3>
          </div>
          <ul className="space-y-3">
            {withItems.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-foreground leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   Section 8 — Final CTA
   ──────────────────────────────────────────── */

function FinalCTASection() {
  return (
    <section className="bg-white border-t border-border">
      <div className="container mx-auto px-4 py-16 md:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-primary/10 mx-auto mb-5">
            <Droplets className="h-7 w-7 text-primary" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Ready to know your rivers?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            Join guides and anglers across New England who check StreamFlows before
            every trip. Browse live conditions now, or create a free account to
            save favorites and set alerts.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/rivers">
              <Button size="lg" className="gap-2 text-base h-12 px-6">
                Browse Live Conditions
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" variant="outline" className="gap-2 text-base h-12 px-6">
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   Page Export
   ──────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <TrustBar />
      <LiveSnapshotSection />
      <HowItWorksSection />
      <FeaturesSection />
      <AudienceSection />
      <ComparisonSection />
      <FinalCTASection />
    </div>
  );
}
