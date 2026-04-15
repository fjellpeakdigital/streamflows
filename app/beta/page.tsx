'use client';

import { useState, useRef } from 'react';
import { DM_Serif_Display } from 'next/font/google';
import Link from 'next/link';
import { BookMarked, Bell, Activity, Map } from 'lucide-react';

const dmSerif = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
});

// ---------------------------------------------------------------------------
// Topographic SVG background
// ---------------------------------------------------------------------------

function TopoBackground() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="topo" x="0" y="0" width="320" height="200" patternUnits="userSpaceOnUse">
          {/* Wave 1 */}
          <path
            d="M0,30 C40,22 80,38 120,30 C160,22 200,38 240,30 C280,22 310,36 320,30"
            fill="none"
            stroke="#c8973a"
            strokeOpacity="0.06"
            strokeWidth="0.8"
          />
          {/* Wave 2 */}
          <path
            d="M0,58 C50,48 90,66 140,58 C190,50 230,68 280,58 C300,54 314,62 320,58"
            fill="none"
            stroke="#c8973a"
            strokeOpacity="0.06"
            strokeWidth="0.8"
          />
          {/* Wave 3 */}
          <path
            d="M0,90 C35,80 75,100 120,90 C165,80 205,100 255,90 C280,84 305,96 320,90"
            fill="none"
            stroke="#c8973a"
            strokeOpacity="0.06"
            strokeWidth="0.8"
          />
          {/* Wave 4 */}
          <path
            d="M0,122 C45,112 85,132 130,122 C175,112 215,132 265,122 C290,116 308,128 320,122"
            fill="none"
            stroke="#c8973a"
            strokeOpacity="0.06"
            strokeWidth="0.8"
          />
          {/* Wave 5 */}
          <path
            d="M0,155 C55,145 95,165 145,155 C195,145 235,165 285,155 C300,151 312,159 320,155"
            fill="none"
            stroke="#c8973a"
            strokeOpacity="0.06"
            strokeWidth="0.8"
          />
          {/* Wave 6 */}
          <path
            d="M0,185 C40,175 80,195 130,185 C180,175 225,195 275,185 C295,180 312,190 320,185"
            fill="none"
            stroke="#c8973a"
            strokeOpacity="0.06"
            strokeWidth="0.8"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#topo)" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Feature card data
// ---------------------------------------------------------------------------

const features = [
  {
    Icon: BookMarked,
    label: 'River Roster',
    description:
      'Your northeast rivers in one place with live condition status and flow trend, updated hourly from USGS.',
  },
  {
    Icon: Bell,
    label: 'Trip Window Alerts',
    description:
      'Get notified when your target river enters optimal range in the days before a scheduled trip.',
  },
  {
    Icon: Activity,
    label: 'Flow Charts',
    description:
      '24-hour and 5-day forecast charts per river so you can see the pattern, not just the current number.',
  },
  {
    Icon: Map,
    label: 'Guide Dashboard',
    description:
      "All your rivers and upcoming trips at a glance, built around how a guide actually plans their week.",
  },
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BetaPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rivers, setRivers] = useState('');
  const [currentMethod, setCurrentMethod] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const signupRef = useRef<HTMLElement>(null);

  const scrollToSignup = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    signupRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/beta-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          rivers: rivers || null,
          current_method: currentMethod || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Please check your connection and try again.');
    }
  };

  return (
    <div style={{ backgroundColor: '#0d1810', color: '#ede8dc' }} className="min-h-screen">
      {/* ------------------------------------------------------------------ */}
      {/* Hero */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center overflow-hidden"
        style={{ backgroundColor: '#0d1810' }}
      >
        <TopoBackground />

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Label */}
          <p
            className="text-xs font-semibold tracking-[0.2em] uppercase mb-8"
            style={{ color: '#c8973a' }}
          >
            Beta Access · Back Alley Fly
          </p>

          {/* H1 */}
          <h1
            className={`${dmSerif.className} text-4xl sm:text-5xl md:text-6xl leading-tight mb-6`}
            style={{ color: '#ede8dc' }}
          >
            Built for guides
            <br />
            who live on the water
          </h1>

          {/* Subhead */}
          <p className="text-lg max-w-xl mx-auto mb-10 leading-relaxed" style={{ color: '#7a9080' }}>
            StreamFlows pulls live USGS flow data for northeast rivers, calculates condition status
            per river, and surfaces fishing windows around your guide trips.
          </p>

          {/* CTA */}
          <a
            href="#signup"
            onClick={scrollToSignup}
            className="inline-block rounded-full px-8 py-4 text-base font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#c8973a', color: '#0d1810' }}
          >
            Request Beta Access
          </a>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Features */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="px-6 py-20"
        style={{ backgroundColor: '#13201a' }}
      >
        <div className="max-w-3xl mx-auto">
          {/* Section label */}
          <p
            className="text-xs font-semibold tracking-[0.2em] uppercase mb-3"
            style={{ color: '#c8973a' }}
          >
            What&apos;s in the beta
          </p>

          {/* Disclaimer */}
          <p className="text-sm italic mb-10" style={{ color: '#7a9080' }}>
            This is a working beta. Some features are incomplete. We want your feedback, not to
            impress you.
          </p>

          {/* 2×2 grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map(({ Icon, label, description }) => (
              <div
                key={label}
                className="rounded-xl p-5"
                style={{
                  backgroundColor: '#1a2b20',
                  border: '1px solid #263020',
                }}
              >
                <Icon size={24} className="mb-3" style={{ color: '#c8973a' }} />
                <p className="font-bold mb-1" style={{ color: '#ede8dc' }}>
                  {label}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: '#7a9080' }}>
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Who it's for */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-6 py-20" style={{ backgroundColor: '#0d1810' }}>
        <div className="max-w-3xl mx-auto">
          <p
            className="text-xs font-semibold tracking-[0.2em] uppercase mb-6"
            style={{ color: '#c8973a' }}
          >
            Who it&apos;s for
          </p>
          <p className="text-base leading-relaxed" style={{ color: '#ede8dc' }}>
            StreamFlows is for fly fishing guides running trips on moving water in the northeast —
            people who need to know whether a river is fishing before they can tell a client where
            to be. It&apos;s not a consumer app. There&apos;s no social feed, no trip photos, no
            gear shop. Just the data you need to make a call.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Signup form */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="signup"
        ref={signupRef as React.RefObject<HTMLElement>}
        className="px-6 py-20"
        style={{ backgroundColor: '#13201a' }}
      >
        <div className="max-w-xl mx-auto">
          {/* Section label */}
          <p
            className="text-xs font-semibold tracking-[0.2em] uppercase mb-3"
            style={{ color: '#c8973a' }}
          >
            Request beta access
          </p>

          <h2
            className={`${dmSerif.className} text-3xl mb-3`}
            style={{ color: '#ede8dc' }}
          >
            Get early access
          </h2>

          <p className="text-sm mb-8" style={{ color: '#7a9080' }}>
            We&apos;re onboarding a small group of guides for initial testing. Fill this in and
            we&apos;ll be in touch.
          </p>

          {status === 'success' ? (
            <div className="py-8 text-center">
              <h3
                className={`${dmSerif.className} text-3xl mb-3`}
                style={{ color: '#ede8dc' }}
              >
                You&apos;re on the list.
              </h3>
              <p className="text-sm" style={{ color: '#7a9080' }}>
                We&apos;ll reach out when your access is ready.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Name */}
              <div>
                <label
                  htmlFor="beta-name"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: '#ede8dc' }}
                >
                  Your name <span style={{ color: '#c8973a' }}>*</span>
                </label>
                <input
                  id="beta-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 transition"
                  style={{
                    backgroundColor: '#0d1810',
                    border: '1px solid #263020',
                    color: '#ede8dc',
                    caretColor: '#c8973a',
                  }}
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="beta-email"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: '#ede8dc' }}
                >
                  Email address <span style={{ color: '#c8973a' }}>*</span>
                </label>
                <input
                  id="beta-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 transition"
                  style={{
                    backgroundColor: '#0d1810',
                    border: '1px solid #263020',
                    color: '#ede8dc',
                    caretColor: '#c8973a',
                  }}
                />
              </div>

              {/* Rivers */}
              <div>
                <label
                  htmlFor="beta-rivers"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: '#ede8dc' }}
                >
                  What rivers do you guide on?
                </label>
                <textarea
                  id="beta-rivers"
                  rows={3}
                  value={rivers}
                  onChange={(e) => setRivers(e.target.value)}
                  placeholder="Farmington, Deerfield, Battenkill…"
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 transition resize-none"
                  style={{
                    backgroundColor: '#0d1810',
                    border: '1px solid #263020',
                    color: '#ede8dc',
                    caretColor: '#c8973a',
                  }}
                />
              </div>

              {/* Current method */}
              <div>
                <label
                  htmlFor="beta-method"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: '#ede8dc' }}
                >
                  How do you currently track conditions?
                </label>
                <textarea
                  id="beta-method"
                  rows={3}
                  value={currentMethod}
                  onChange={(e) => setCurrentMethod(e.target.value)}
                  placeholder="USGS website, phone calls, word of mouth…"
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 transition resize-none"
                  style={{
                    backgroundColor: '#0d1810',
                    border: '1px solid #263020',
                    color: '#ede8dc',
                    caretColor: '#c8973a',
                  }}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full rounded-lg py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#c8973a', color: '#0d1810' }}
              >
                {status === 'loading' ? 'Sending…' : 'Request Access'}
              </button>

              {/* Error */}
              {status === 'error' && errorMsg && (
                <p className="text-sm text-red-400 mt-2">{errorMsg}</p>
              )}
            </form>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer */}
      {/* ------------------------------------------------------------------ */}
      <footer
        className="px-6 py-10 text-center"
        style={{ backgroundColor: '#0d1810', borderTop: '1px solid #263020' }}
      >
        <p className="text-sm mb-2" style={{ color: '#7a9080' }}>
          StreamFlows is a Back Alley Fly project
        </p>
        <Link
          href="/"
          className="text-sm transition-opacity hover:opacity-80"
          style={{ color: '#c8973a' }}
        >
          Back to app →
        </Link>
      </footer>
    </div>
  );
}
