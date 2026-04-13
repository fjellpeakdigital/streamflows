'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Droplets, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [done, setDone]                     = useState(false);
  const [ready, setReady]                   = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      // --- PKCE flow ---
      // Supabase appends ?code=XXX&type=recovery to the redirectTo URL.
      // We exchange it client-side (no server callback needed).
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) { setReady(true); return; }
      }

      // --- Implicit / hash flow ---
      // Supabase appends #access_token=XXX&refresh_token=YYY&type=recovery
      const hash = window.location.hash;
      if (hash) {
        const hashParams = new URLSearchParams(hash.slice(1));
        const accessToken  = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type         = hashParams.get('type');
        if (type === 'recovery' && accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (!error) { setReady(true); return; }
        }
      }

      // --- Already have a session (e.g. user refreshed the page) ---
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { setReady(true); return; }

      // Nothing worked — link is bad or expired.
      setError('Reset link is invalid or has expired.');
    }

    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setError(error.message); return; }
      setDone(true);
      setTimeout(() => { router.push('/rivers'); router.refresh(); }, 2500);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-4">
            <Droplets className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Set new password</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose a strong password for your account</p>
        </div>

        {done ? (
          <div className="bg-white border border-emerald-200 rounded-2xl p-8 text-center shadow-sm">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-foreground mb-2">Password updated!</h2>
            <p className="text-sm text-muted-foreground">Redirecting you to the rivers dashboard…</p>
          </div>
        ) : !ready ? (
          <div className="bg-white border border-border rounded-2xl p-8 text-center shadow-sm">
            {error ? (
              <>
                <p className="text-sm text-red-600 mb-3">{error}</p>
                <a href="/forgot-password" className="text-sm text-primary hover:underline font-medium">
                  Request a new reset link
                </a>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Checking reset link…</p>
            )}
          </div>
        ) : (
          <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">

              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                  New Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  className="h-11"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium mb-1.5">
                  Confirm New Password
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="h-11"
                />
              </div>

              <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                {loading ? 'Updating…' : 'Update Password'}
              </Button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
