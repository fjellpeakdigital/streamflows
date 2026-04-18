import { AccountClient } from './account-client';
import { requireUser } from '@/lib/auth';
import { getUserHomeRegions } from '@/lib/user-regions';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <AccountClient
      email={user.email ?? null}
      initialRegions={getUserHomeRegions(user)}
    />
  );
}
