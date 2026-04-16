'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { Droplets, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

const HOME_REGIONS = [
  { label: 'Connecticut',    value: 'Connecticut' },
  { label: 'Maine',          value: 'Maine' },
  { label: 'Massachusetts',  value: 'Massachusetts' },
  { label: 'New Hampshire',  value: 'New Hampshire' },
  { label: 'Vermont',        value: 'Vermont' },
];

type Mode = 'login' | 'signup';

export default function BetaPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');

  // Login state
  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading]   = useState(false);
  const [loginError, setLoginError]       = useState<string | null>(null);

  // Signup state
  const [signupName, setSignupName]                       = useState('');
  const [signupRegion, setSignupRegion]                   = useState('');
  const [signupEmail, setSignupEmail]                     = useState('');
  const [signupPassword, setSignupPassword]               = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [betaCode, setBetaCode]                           = useState('');
  const [signupLoading, setSignupLoading]                 = useState(false);
  const [signupError, setSignupError]                     = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess]                 = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) {
        if (
          error.message.toLowerCase().includes('invalid login credentials') ||
          error.status === 400
        ) {
          setLoginError(
            'Invalid email or password. Check your email for a confirmation link if you just signed up, or reset your password below.'
          );
        } else {
          setLoginError(error.message);
        }
        return;
      }
      router.push('/rivers');
      router.refresh();
    } catch {
      setLoginError('An unexpected error occurred');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);

    if (!signupName.trim()) {
      setSignupError('Please enter your name');
      return;
    }
    if (!signupRegion) {
      setSignupError('Please select your home region');
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setSignupError('Passwords do not match');
      return;
    }
    if (signupPassword.length < 6) {
      setSignupError('Password must be at least 6 characters');
      return;
    }
    if (!betaCode.trim()) {
      setSignupError('An invite code is required to create an account');
      return;
    }

    setSignupLoading(true);
    try {
      // Validate beta code server-side so the code is never in client JS
      const codeRes = await fetch('/api/auth/validate-beta-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: betaCode.trim() }),
      });
      if (!codeRes.ok) {
        setSignupError('Invalid invite code. Contact the StreamFlows team to request access.');
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { full_name: signupName.trim(), home_region: signupRegion },
        },
      });
      if (error) {
        if (
          error.message.toLowerCase().includes('already registered') ||
          error.status === 422
        ) {
          setSignupError(
            'An account with this email already exists. Try logging in or reset your password.'
          );
        } else {
          setSignupError(error.message);
        }
        return;
      }
      if (data.user && data.user.identities?.length === 0) {
        setSignupError(
          'An account with this email already exists. Check your inbox for a confirmation email, or reset your password.'
        );
        return;
      }
      setSignupSuccess(true);
    } catch {
      setSignupError('An unexpected error occurred');
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Logo + beta badge */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-4">
            <Droplets className="h-6 w-6 text-primary" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-foreground">StreamFlows</h1>
            <span className="text-xs font-semibold bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 uppercase tracking-wide">
              Beta
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === 'login' ? 'Log in to your account' : 'Request access below'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-muted rounded-xl p-1 mb-5">
          <button
            type="button"
            onClick={() => { setMode('login'); setLoginError(null); }}
            className={`flex-1 text-sm font-medium rounded-lg py-2 transition-colors ${
              mode === 'login'
                ? 'bg-white shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setSignupError(null); }}
            className={`flex-1 text-sm font-medium rounded-lg py-2 transition-colors ${
              mode === 'signup'
                ? 'bg-white shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* ── LOGIN ── */}
        {mode === 'login' && (
          <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {loginError}
                </div>
              )}
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium mb-1.5">
                  Email
                </label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="h-11"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="text-sm font-medium">
                    Password
                  </label>
                  <a href="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </a>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-11"
                />
              </div>
              <Button type="submit" className="w-full h-11 text-base" disabled={loginLoading}>
                {loginLoading ? 'Logging in…' : 'Log In'}
              </Button>
            </form>
          </div>
        )}

        {/* ── SIGNUP ── */}
        {mode === 'signup' && (
          signupSuccess ? (
            <div className="bg-white border border-emerald-200 rounded-2xl p-8 text-center shadow-sm">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-foreground mb-2">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent you a confirmation link. Click it to activate your account, then log in.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
              <form onSubmit={handleSignup} className="space-y-4">
                {signupError && (
                  <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    {signupError}
                  </div>
                )}
                <div>
                  <label htmlFor="signup-name" className="block text-sm font-medium mb-1.5">
                    Name
                  </label>
                  <Input
                    id="signup-name"
                    type="text"
                    autoComplete="name"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="Your full name"
                    required
                    className="h-11"
                  />
                </div>
                <div>
                  <label htmlFor="signup-region" className="block text-sm font-medium mb-1.5">
                    Home Region
                  </label>
                  <Select
                    id="signup-region"
                    value={signupRegion}
                    onChange={(e) => setSignupRegion(e.target.value)}
                    required
                    className="h-11"
                  >
                    <option value="" disabled>Select your region</option>
                    {HOME_REGIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label htmlFor="signup-email" className="block text-sm font-medium mb-1.5">
                    Email
                  </label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="h-11"
                  />
                </div>
                <div>
                  <label htmlFor="signup-password" className="block text-sm font-medium mb-1.5">
                    Password
                  </label>
                  <Input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    className="h-11"
                  />
                </div>
                <div>
                  <label htmlFor="signup-confirm" className="block text-sm font-medium mb-1.5">
                    Confirm Password
                  </label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="h-11"
                  />
                </div>
                <div>
                  <label htmlFor="beta-code" className="block text-sm font-medium mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      Invite Code
                    </span>
                  </label>
                  <Input
                    id="beta-code"
                    type="text"
                    autoComplete="off"
                    value={betaCode}
                    onChange={(e) => setBetaCode(e.target.value)}
                    placeholder="Enter your invite code"
                    required
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    StreamFlows is invite-only during beta.
                  </p>
                </div>
                <Button type="submit" className="w-full h-11 text-base" disabled={signupLoading}>
                  {signupLoading ? 'Creating account…' : 'Create Account'}
                </Button>
              </form>
            </div>
          )
        )}

      </div>
    </div>
  );
}
