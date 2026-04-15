'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, BookOpenText, CalendarRange, LayoutDashboard, Map } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trips', label: 'Trips', icon: CalendarRange },
  { href: '/hatches', label: 'Hatches', icon: BookOpenText },
  { href: '/rivers', label: 'Rivers', icon: Map },
  { href: '/alerts', label: 'Alerts', icon: Bell },
];

interface MobileNavProps {
  activeAlertCount?: number;
}

export function MobileNav({ activeAlertCount = 0 }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-border bg-white"
    >
      <div className="grid grid-cols-5 h-16">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const showBadge = href === '/alerts' && activeAlertCount > 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {showBadge && (
                  <span
                    aria-label={`${activeAlertCount} active alert${activeAlertCount !== 1 ? 's' : ''}`}
                    className="absolute -top-1 -right-1.5 h-4 min-w-4 inline-flex items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white px-1 leading-none"
                  >
                    {activeAlertCount > 99 ? '99+' : activeAlertCount}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
