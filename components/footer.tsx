import Link from 'next/link';
import { Droplets } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-3">
              <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/10">
                <Droplets className="h-4 w-4 text-primary" />
              </div>
              <span className="text-base font-bold tracking-tight text-foreground">
                Stream<span className="text-primary">Flows</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Real-time river intelligence for New England fly fishing. A product by Back Alley Fly.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Product</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/rivers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Browse Rivers
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>

          {/* For You */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">For You</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/#for-guides" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  For Guides
                </Link>
              </li>
              <li>
                <Link href="/#for-guides" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  For Anglers
                </Link>
              </li>
              <li>
                <Link href="/favorites" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Favorites
                </Link>
              </li>
              <li>
                <Link href="/alerts" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Alerts
                </Link>
              </li>
            </ul>
          </div>

          {/* Data */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Data</h4>
            <ul className="space-y-2">
              <li>
                <span className="text-sm text-muted-foreground">
                  Powered by USGS Water Services
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  Updated every 15 minutes
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  50+ rivers across 6 states
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Back Alley Fly. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            River data provided by the U.S. Geological Survey.
          </p>
        </div>
      </div>
    </footer>
  );
}
