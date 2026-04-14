'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserCircle, Shield } from 'lucide-react';

type Feedback = { type: 'success' | 'error'; message: string } | null;

export default function AccountPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [pwFeedback, setPwFeedback] = useState<Feedback>(null);

  const [signingOutAll, setSigningOutAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        router.replace('/login');
        return;
      }
      setEmail(data.user.email ?? null);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwFeedback(null);

    if (newPassword.length < 8) {
      setPwFeedback({ type: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwFeedback({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    if (!email) {
      setPwFeedback({ type: 'error', message: 'Missing account email.' });
      return;
    }

    setSavingPassword(true);

    // Re-authenticate to verify current password
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (reauthError) {
      setSavingPassword(false);
      setPwFeedback({ type: 'error', message: 'Current password is incorrect.' });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setPwFeedback({ type: 'error', message: error.message });
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwFeedback({ type: 'success', message: 'Password updated.' });
  };

  const handleSignOutAll = async () => {
    if (!confirm('Sign out of every device? You will need to log back in.')) return;
    setSigningOutAll(true);
    await supabase.auth.signOut({ scope: 'global' });
    router.replace('/login');
  };

  if (checking) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-xl text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <UserCircle className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Account</h1>
      </div>

      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Email
          </p>
          <p className="text-sm font-medium text-foreground break-all">{email ?? '—'}</p>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-3 pt-2 border-t border-border">
          <p className="text-sm font-semibold">Change password</p>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">Current password</span>
            <Input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">New password</span>
            <Input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">Confirm new password</span>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>

          {pwFeedback && (
            <p
              className={
                pwFeedback.type === 'success'
                  ? 'text-sm text-emerald-700'
                  : 'text-sm text-red-600'
              }
            >
              {pwFeedback.message}
            </p>
          )}

          <Button type="submit" disabled={savingPassword}>
            {savingPassword ? 'Saving…' : 'Update password'}
          </Button>
        </form>
      </section>

      <section className="bg-card border border-red-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-red-600" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-700">
            Danger zone
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Revoke every active session and sign out of every device. You&apos;ll need to log
          back in everywhere.
        </p>
        <Button
          variant="outline"
          onClick={handleSignOutAll}
          disabled={signingOutAll}
          className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
        >
          {signingOutAll ? 'Signing out…' : 'Sign out of all devices'}
        </Button>
      </section>
    </div>
  );
}
