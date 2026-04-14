'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Bell, CalendarDays, LayoutDashboard, Map } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateStatus, getStatusDotColor } from '@/lib/river-utils';
import type { RiverWithCondition } from '@/lib/types/database';

interface SidebarProps {
  rivers: RiverWithCondition[];
  lastSyncedAt: string | Date | null;
  activeAlertCount?: number;
}

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/rivers', label: 'Rivers', icon: Map },
  { href: '/trips', label: 'Trips', icon: CalendarDays },
  { href: '/alerts', label: 'Alerts', icon: Bell },
];

export function Sidebar({ rivers, lastSyncedAt, activeAlertCount = 0 }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);

  const lastSyncedLabel = lastSyncedAt
    ? `Last synced ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}`
    : 'Not yet synced';

  return (
    <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-64 flex-col border-r border-border bg-white">
      <div className="px-4 py-5 border-b border-border">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight text-foreground">
          Stream<span className="text-primary">Flows</span>
        </Link>
      </div>

      <nav className="px-3 py-4">
        <ul className="space-y-1" role="list">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const showBadge = href === '/alerts' && activeAlertCount > 0;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive(href)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
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
      </nav>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          My Rivers
        </div>
        <ul className="space-y-0.5" role="list">
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
      </div>

      <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
        {lastSyncedLabel}
      </div>
    </aside>
  );
}
