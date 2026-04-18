'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserCircle, Shield, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AVAILABLE_REGIONS } from '@/lib/user-regions';

type Feedback = { type: 'success' | 'error'; message: string } | null;

interface AccountClientProps {
  email: string | null;
  initialRegions: string[];
}

export function AccountClient({
  email,
  initialRegions,
}: AccountClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [pwFeedback, setPwFeedback] = useState<Feedback>(null);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const [savedRegions, setSavedRegions] = useState<string[]>(initialRegions);
  const [draftRegions, setDraftRegions] = useState<Set<string>>(
    () => new Set(initialRegions)
  );
  const [savingRegions, setSavingRegions] = useState(false);
  const [regionFeedback, setRegionFeedback] = useState<Feedback>(null);

  const toggleDraftRegion = (region: string) => {
    setRegionFeedback(null);
    setDraftRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  };

  const draftRegionsArray = Array.from(draftRegions);
  const regionsDirty =
    draftRegionsArray.length !== savedRegions.length ||
    draftRegionsArray.some((region) => !savedRegions.includes(region));

  const handleSaveRegions = async () => {
    setRegionFeedback(null);
    if (draftRegions.size === 0) {
      setRegionFeedback({ type: 'error', message: 'Pick at least one region.' });
      return;
    }

    setSavingRegions(true);
    const sorted = AVAILABLE_REGIONS.filter((region) => draftRegions.has(region));
    const { error } = await supabase.auth.updateUser({
      data: {
        home_regions: sorted,
        home_region: sorted[0],
      },
    });
    setSavingRegions(false);

    if (error) {
      setRegionFeedback({ type: 'error', message: error.message });
      return;
    }

    setSavedRegions(sorted);
    setDraftRegions(new Set(sorted));
    setRegionFeedback({ type: 'success', message: 'Regions updated.' });
    router.refresh();
  };

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
          <p className="text-sm font-medium text-foreground break-all">{email ?? '-'}</p>
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
            {savingPassword ? 'Saving...' : 'Update password'}
          </Button>
        </form>
      </section>

      <section
        id="regions"
        className="bg-card border border-border rounded-xl p-5 space-y-4 scroll-mt-8"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Regions</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Pick the regions you guide on. The rivers page and discover view are scoped to
          these, so add more here to expand what you can browse and add to your roster.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AVAILABLE_REGIONS.map((region) => {
            const checked = draftRegions.has(region);
            return (
              <label
                key={region}
                className={cn(
                  'flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors',
                  checked
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDraftRegion(region)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40"
                />
                <span className="flex-1">{region}</span>
              </label>
            );
          })}
        </div>

        {regionFeedback && (
          <p
            className={
              regionFeedback.type === 'success'
                ? 'text-sm text-emerald-700'
                : 'text-sm text-red-600'
            }
          >
            {regionFeedback.message}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            {draftRegions.size === 0
              ? 'No regions selected.'
              : draftRegions.size === 1
                ? '1 region selected.'
                : `${draftRegions.size} regions selected.`}
          </p>
          <Button
            type="button"
            onClick={handleSaveRegions}
            disabled={!regionsDirty || savingRegions}
          >
            {savingRegions ? 'Saving...' : 'Save regions'}
          </Button>
        </div>
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
          {signingOutAll ? 'Signing out...' : 'Sign out of all devices'}
        </Button>
      </section>
    </div>
  );
}
