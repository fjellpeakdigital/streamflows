'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Navigation({ user }: { user: any }) {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="text-2xl font-bold text-primary">StreamFlows</div>
              <div className="hidden sm:block text-sm text-muted-foreground">
                River Conditions
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              <Link href="/rivers">
                <Button
                  variant={isActive('/rivers') ? 'default' : 'ghost'}
                  size="sm"
                >
                  Rivers
                </Button>
              </Link>
              {user && (
                <>
                  <Link href="/favorites">
                    <Button
                      variant={isActive('/favorites') ? 'default' : 'ghost'}
                      size="sm"
                    >
                      Favorites
                    </Button>
                  </Link>
                  <Link href="/alerts">
                    <Button
                      variant={isActive('/alerts') ? 'default' : 'ghost'}
                      size="sm"
                    >
                      Alerts
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden sm:inline text-sm text-muted-foreground">
                  {user.email}
                </span>
                <form action="/auth/signout" method="post">
                  <Button variant="outline" size="sm" type="submit">
                    Sign Out
                  </Button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Log In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">Sign Up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
