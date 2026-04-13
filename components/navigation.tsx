'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Menu, X, Droplets, Heart, Bell, Map, Compass, Users, LayoutDashboard } from 'lucide-react';

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  authRequired?: boolean;
}

const allNavLinks: NavLink[] = [
  { href: '/rivers', label: 'Rivers', icon: Map },
  { href: '/#how-it-works', label: 'How It Works', icon: Compass },
  { href: '/#for-guides', label: 'For Guides', icon: Users },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, authRequired: true },
  { href: '/favorites', label: 'Favorites', icon: Heart, authRequired: true },
  { href: '/alerts', label: 'Alerts', icon: Bell, authRequired: true },
];

export function Navigation({ user }: { user: any }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) =>
    pathname === path || (path !== '/' && !path.startsWith('/#') && pathname.startsWith(path));

  const navLinks = allNavLinks.filter(
    (link) => !link.authRequired || user
  );

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">

            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2.5 group"
              onClick={() => setMobileOpen(false)}
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
                <Droplets className="h-4.5 w-4.5 text-primary transition-transform group-hover:scale-110" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">
                Stream<span className="text-primary">Flows</span>
              </span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ href, label }) => (
                <Link key={href} href={href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'text-sm font-medium',
                      isActive(href)
                        ? 'text-primary bg-primary/5'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {label}
                  </Button>
                </Link>
              ))}
            </div>

            {/* Auth area + hamburger */}
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <span className="hidden lg:inline text-sm text-muted-foreground truncate max-w-[180px]">
                    {user.email}
                  </span>
                  <form action="/auth/signout" method="post">
                    <Button variant="outline" size="sm" type="submit" className="hidden md:inline-flex">
                      Sign Out
                    </Button>
                  </form>
                </>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <Link href="/login">
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground font-medium">
                      Log In
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button size="sm">Get Started</Button>
                  </Link>
                </div>
              )}

              {/* Mobile hamburger toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-muted-foreground hover:text-foreground"
                onClick={() => setMobileOpen((o) => !o)}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>

          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div className="fixed top-16 left-0 right-0 z-50 md:hidden bg-white border-b border-border shadow-lg">
            <nav className="container mx-auto px-4 py-4">
              <ul className="space-y-1" role="list">
                {navLinks.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors',
                        isActive(href)
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-4 pt-4 border-t border-border">
                {user ? (
                  <div className="space-y-3">
                    <p className="px-4 text-sm text-muted-foreground truncate">
                      {user.email}
                    </p>
                    <form action="/auth/signout" method="post">
                      <Button variant="outline" size="sm" className="w-full" type="submit">
                        Sign Out
                      </Button>
                    </form>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full">
                        Log In
                      </Button>
                    </Link>
                    <Link href="/signup" onClick={() => setMobileOpen(false)}>
                      <Button size="sm" className="w-full">
                        Get Started
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
