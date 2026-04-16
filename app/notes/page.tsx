import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// /notes is the old per-river-memo index. The Journal (at /journal) replaced it
// as the interactive guide workspace. Keep this route alive as a redirect so
// existing bookmarks don't 404.
export default function NotesRedirectPage() {
  redirect('/journal');
}
