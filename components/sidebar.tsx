'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  BookOpenText,
  CalendarDays,
  CalendarRange,
  LineChart,
  Plus,
  StickyNote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateStatus, getStatusDotColor } from '@/lib/river-utils';
import type { RiverWithCondition } from '@/lib/types/database';

interface SidebarProps {
  rivers: RiverWithCondition[];
  lastSyncedAt: string | Date | null;
  activeAlertCount?: number;
  upcomingTripCount?: number;
}

const toolLinks = [
  { href: '/hatches', label: 'Hatch calendar', icon: BookOpenText },
  { href: '/rivers', label: 'Flow history', icon: LineChart },
  { href: '/notes', label: 'Client notes', icon: StickyNote },
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
}: SidebarProps) {
  const pathname = usePathname();

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
        <ul className="space-y-0.5 px-3" role="list">
          {rivers.map((river) => {
            const status = calculateStatus(
              river.current_condition?.flow ?? null,
              river.optimal_flow_min,
              river.optimal_flow_max
            );
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
                      getStatusDotColor(status)
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
        </ul>

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

      <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
        {lastSyncedLabel}
      </div>
    </aside>
  );
}
