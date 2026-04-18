'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowRight,
  Bell,
  BookOpenText,
  BookText,
  CalendarRange,
  Map,
  LogOut,
  Plus,
  Search,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateStatus, getStatusDotColor } from '@/lib/river-utils';
import type { RiverWithCondition } from '@/lib/types/database';

interface SidebarProps {
  rivers: RiverWithCondition[];
  lastSyncedAt: string | Date | null;
  activeAlertCount?: number;
  upcomingTripCount?: number;
  userEmail?: string | null;
}

const toolLinks = [
  { href: '/journal', label: 'Journal', icon: BookText },
  { href: '/hatches', label: 'Hatch calendar', icon: BookOpenText },
  { href: '/rivers', label: 'Browse rivers', icon: Map },
  { href: '/alerts', label: 'Alert manager', icon: Bell },
];

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

export function Sidebar({
  rivers,
  lastSyncedAt,
  activeAlertCount = 0,
  upcomingTripCount = 0,
  userEmail = null,
}: SidebarProps) {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const filteredRivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rivers;
    return rivers.filter((r) => r.name.toLowerCase().includes(q));
  }, [rivers, search]);

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);

  const lastSyncedLabel = lastSyncedAt
    ? `Last synced ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}`
    : 'Not yet synced';

  const navItemClass = (active: boolean) =>
    cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      active
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
    );

  return (
    <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-64 flex-col border-r border-border bg-white">
      <div className="px-4 py-5 border-b border-border">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight text-foreground">
          Stream<span className="text-primary">Flows</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {/* My Roster */}
        <SectionHeader>My Roster</SectionHeader>
        <div className="px-3 pb-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={(e) => {
                if (!e.target.value) setSearch('');
              }}
              placeholder="Search roster…"
              aria-label="Search roster"
              className="w-full rounded-md border border-border bg-background pl-7 pr-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        </div>
        <ul className="space-y-0.5 px-3" role="list">
          {filteredRivers.map((river) => {
            const status = calculateStatus(
              river.current_condition?.flow ?? null,
              river.optimal_flow_min,
              river.optimal_flow_max
            );
            // Pulse the dot when data is fresh (< 30 min) — signals live updates
            const ts = river.current_condition?.timestamp;
            const isFresh = ts
              ? now - new Date(ts).getTime() < 30 * 60 * 1000
              : false;
            return (
              <li key={river.id}>
                <Link
                  href={`/rivers/${river.slug}`}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                    pathname === `/rivers/${river.slug}`
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      getStatusDotColor(status),
                      isFresh && 'animate-pulse-dot'
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{river.name}</span>
                </Link>
              </li>
            );
          })}
          {rivers.length === 0 && (
            <li className="px-3 py-1.5 text-sm text-muted-foreground">
              No rivers on your roster yet.
            </li>
          )}
          {rivers.length > 0 && filteredRivers.length === 0 && (
            <li>
              <Link
                href={`/rivers?q=${encodeURIComponent(search.trim())}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                No matches — Browse all rivers
                <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          )}
        </ul>
        <div className="px-3 mt-1">
          <Link
            href="/rivers"
            className="inline-flex items-center gap-1 px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Browse all rivers
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Plan a Trip */}
        <SectionHeader>Plan a Trip</SectionHeader>
        <ul className="space-y-1 px-3" role="list">
          <li>
            <Link href="/trips?new=1" className={navItemClass(false)}>
              <Plus className="h-4 w-4 shrink-0" />
              <span className="flex-1">New trip day</span>
            </Link>
          </li>
          <li>
            <Link href="/trips" className={navItemClass(isActive('/trips'))}>
              <CalendarRange className="h-4 w-4 shrink-0" />
              <span className="flex-1">All upcoming trips</span>
              {upcomingTripCount > 0 && (
                <span
                  aria-label={`${upcomingTripCount} upcoming trip${upcomingTripCount !== 1 ? 's' : ''}`}
                  className="inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary"
                >
                  {upcomingTripCount > 99 ? '99+' : upcomingTripCount}
                </span>
              )}
            </Link>
          </li>
        </ul>

        {/* Tools */}
        <SectionHeader>Tools</SectionHeader>
        <ul className="space-y-1 px-3" role="list">
          {toolLinks.map(({ href, label, icon: Icon }) => {
            const showBadge = href === '/alerts' && activeAlertCount > 0;
            return (
              <li key={label}>
                <Link href={href} className={navItemClass(isActive(href))}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {showBadge && (
                    <span
                      aria-label={`${activeAlertCount} active alert${activeAlertCount !== 1 ? 's' : ''}`}
                      className="inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white"
                    >
                      {activeAlertCount > 99 ? '99+' : activeAlertCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {userEmail && (
        <div className="border-t border-border px-3 py-2 flex items-center gap-2">
          <span
            title={userEmail}
            className="flex-1 min-w-0 truncate text-xs text-muted-foreground"
          >
            {userEmail}
          </span>
          <Link
            href="/account"
            aria-label="Account settings"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <form action="/auth/signout" method="post" className="shrink-0">
            <button
              type="submit"
              aria-label="Sign out"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
        {lastSyncedLabel}
      </div>
    </aside>
  );
}
