'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Droplets, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [sent, setSent]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) { setError(error.message); return; }
      setSent(true);
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
          <h1 className="text-2xl font-bold text-foreground">Reset your password</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Enter your email and we&apos;ll send a reset link
          </p>
        </div>

        {sent ? (
          <div className="bg-white border border-emerald-200 rounded-2xl p-8 text-center shadow-sm">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-foreground mb-2">Check your email</h2>
            <p className="text-sm text-muted-foreground mb-4">
              If an account exists for <strong>{email}</strong>, a password reset link has been sent.
            </p>
            <Link href="/login" className="text-sm text-primary hover:underline font-medium">
              Back to login
            </Link>
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
                <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="h-11"
                />
              </div>

              <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Remember your password?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Log in
              </Link>
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
