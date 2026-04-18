'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { RiverCard } from '@/components/river-card';
import { RiverWithCondition, RiverStatus } from '@/lib/types/database';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, SlidersHorizontal, X, LayoutGrid, List, Heart, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSuppressedDiscoveryRiverCount } from '@/lib/river-visibility';
import {
  getStatusLabel,
  getStatusBorderColor,
  getStatusColor,
  getStatusDotColor,
  formatFlow,
  formatTemperature,
} from '@/lib/river-utils';

interface RiversListProps {
  rivers: RiverWithCondition[];
  rosterRiverIds?: string[];
  isAuthenticated?: boolean;
  homeRegions?: string[];
}

const SORT_ORDER: Record<RiverStatus, number> = {
  optimal: 0,
  elevated: 1,
  high: 2,
  low: 3,
  ice_affected: 4,
  no_data: 5,
  unknown: 5,
};

function sortByStatus(a: RiverWithCondition, b: RiverWithCondition) {
  const sa = (a.current_condition?.status ?? 'unknown') as RiverStatus;
  const sb = (b.current_condition?.status ?? 'unknown') as RiverStatus;
  const ra = SORT_ORDER[sa] ?? 5;
  const rb = SORT_ORDER[sb] ?? 5;
  if (ra !== rb) return ra - rb;
  return a.name.localeCompare(b.name);
}

export function RiversList({
  rivers,
  rosterRiverIds = [],
  isAuthenticated = false,
  homeRegions = [],
}: RiversListProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'roster' | 'discover'>(
    isAuthenticated ? 'roster' : 'discover'
  );

  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const [searchQuery, setSearchQuery] = useState('');
  // Single-select fallback for users with 0 home regions (legacy/no-scope).
  const [regionFilter, setRegionFilter] = useState('all');
  // Multi-select chip filter: only used when the user scopes to 2+ home regions.
  // Empty set = no narrowing (show all home regions).
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState('all');
  const [speciesFilter, setSpeciesFilter] = useState('all');

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  };

  // How the region filter should behave depends on how many home regions the user has:
  //   0 → legacy single-select dropdown over every region in the data
  //   1 → no filter UI at all (scope is already a single region)
  //   2+ → multi-select chips, one per home region
  const regionFilterMode: 'none' | 'single-select' | 'chips' =
    homeRegions.length === 0
      ? 'single-select'
      : homeRegions.length === 1
        ? 'none'
        : 'chips';

  const [localRoster, setLocalRoster] = useState<Set<string>>(
    () => new Set(rosterRiverIds)
  );

  const handleToggleRoster = async (riverId: string) => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const inRoster = localRoster.has(riverId);
    setLocalRoster((prev) => {
      const next = new Set(prev);
      if (inRoster) next.delete(riverId);
      else next.add(riverId);
      return next;
    });
    const res = await fetch('/api/roster', {
      method: inRoster ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ river_id: riverId }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      // revert on failure
      setLocalRoster((prev) => {
        const next = new Set(prev);
        if (inRoster) next.add(riverId);
        else next.delete(riverId);
        return next;
      });
    }
  };

  const rosterSet = localRoster;
  const rosterRivers = useMemo(
    () => rivers.filter((r) => rosterSet.has(r.id)),
    [rivers, rosterSet]
  );

  const discoverRivers = useMemo(
    () => rivers.filter((r) => !r.hidden_from_discover),
    [rivers]
  );

  const sourceRivers = mode === 'roster' ? rosterRivers : discoverRivers;
  const suppressedDiscoverCount = useMemo(() => getSuppressedDiscoveryRiverCount(), []);

  const regions = useMemo(() => {
    return Array.from(new Set(sourceRivers.map((r) => r.region))).sort();
  }, [sourceRivers]);

  const species = useMemo(() => {
    const s = new Set<string>();
    sourceRivers.forEach((r) => r.species?.forEach((sp) => s.add(sp.species)));
    return Array.from(s).sort();
  }, [sourceRivers]);

  const filteredRivers = useMemo(() => {
    const result = sourceRivers.filter((river) => {
      if (mode === 'discover' && searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !river.name.toLowerCase().includes(q) &&
          !river.region.toLowerCase().includes(q) &&
          !river.description?.toLowerCase().includes(q)
        )
          return false;
      }
      if (regionFilterMode === 'single-select' && regionFilter !== 'all' && river.region !== regionFilter) return false;
      if (regionFilterMode === 'chips' && selectedRegions.size > 0 && !selectedRegions.has(river.region)) return false;
      if (mode === 'discover' && statusFilter !== 'all') {
        const s = river.current_condition?.status ?? 'unknown';
        if (s !== statusFilter) return false;
      }
      if (speciesFilter !== 'all') {
        if (!river.species?.some((s) => s.species === speciesFilter)) return false;
      }
      return true;
    });
    return [...result].sort(sortByStatus);
  }, [sourceRivers, mode, searchQuery, regionFilterMode, regionFilter, selectedRegions, statusFilter, speciesFilter]);

  const hasFilters =
    (mode === 'discover' && searchQuery) ||
    (regionFilterMode === 'single-select' && regionFilter !== 'all') ||
    (regionFilterMode === 'chips' && selectedRegions.size > 0) ||
    (mode === 'discover' && statusFilter !== 'all') ||
    speciesFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setRegionFilter('all');
    setSelectedRegions(new Set());
    setStatusFilter('all');
    setSpeciesFilter('all');
  };

  const showRosterEmpty = isAuthenticated && mode === 'roster' && rosterRivers.length === 0;

  return (
    <div className="space-y-6">
      {/* Mode toggle (authed only) */}
      {isAuthenticated && (
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setMode('roster')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              mode === 'roster'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            My Rivers
          </button>
          <button
            type="button"
            onClick={() => setMode('discover')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              mode === 'discover'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Discover new water
          </button>
        </div>
      )}

      {/* Empty roster state */}
      {showRosterEmpty ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <p className="text-lg font-medium mb-1">Your roster is empty.</p>
          <p className="text-muted-foreground text-sm mb-4">
            Add rivers you guide on to see them here.
          </p>
          <Button onClick={() => setMode('discover')}>Discover new water</Button>
        </div>
      ) : (
        <>
          {/* Filter bar */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="font-medium">Filter rivers</span>
              </div>
              <div className="flex items-center rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('card')}
                  className={cn(
                    'p-1.5 transition-colors',
                    viewMode === 'card'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  aria-label="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'p-1.5 transition-colors',
                    viewMode === 'list'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            {mode === 'discover' && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by name or region…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
            )}

            {mode === 'discover' && suppressedDiscoverCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Hiding {suppressedDiscoverCount} rivers with no usable upstream flow in the last week.
              </p>
            )}

            {regionFilterMode === 'chips' && homeRegions.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Regions
                    {selectedRegions.size > 0 && (
                      <span className="ml-1.5 text-foreground normal-case tracking-normal">
                        ({selectedRegions.size} selected)
                      </span>
                    )}
                  </span>
                  {selectedRegions.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedRegions(new Set())}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {homeRegions.map((r) => {
                    const active = selectedRegions.has(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRegion(r)}
                        aria-pressed={active}
                        className={cn(
                          'px-3 py-1 text-sm rounded-full border transition-colors',
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
                        )}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div
              className={cn(
                'grid grid-cols-1 gap-3',
                regionFilterMode === 'single-select'
                  ? mode === 'discover' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
                  : mode === 'discover' ? 'sm:grid-cols-2' : 'sm:grid-cols-1'
              )}
            >
              {regionFilterMode === 'single-select' && (
                <Select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="bg-background"
                >
                  <option value="all">All Regions</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              )}

              {mode === 'discover' && (
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-background"
                >
                  <option value="all">All Status</option>
                  <option value="optimal">Optimal</option>
                  <option value="elevated">Elevated</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                  <option value="ice_affected">Gauge Not Responding</option>
                  <option value="no_data">No Data</option>
                </Select>
              )}

              <Select
                value={speciesFilter}
                onChange={(e) => setSpeciesFilter(e.target.value)}
                className="bg-background"
              >
                <option value="all">All Species</option>
                {species.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </Select>
            </div>

            {hasFilters && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-sm text-muted-foreground">
                  Showing{' '}
                  <span className="font-semibold text-foreground">
                    {filteredRivers.length}
                  </span>{' '}
                  of {sourceRivers.length} rivers
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>
            )}
          </div>

          {/* Results */}
          {filteredRivers.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-xl">
              <p className="text-muted-foreground text-lg mb-1">
                No rivers match your filters.
              </p>
              <p className="text-muted-foreground text-sm mb-4">
                Try broadening your search.
              </p>
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRivers.map((river) => (
                <RiverCard
                  key={river.id}
                  river={{ ...river, is_favorite: rosterSet.has(river.id) }}
                  showFavorite={isAuthenticated}
                  onToggleFavorite={handleToggleRoster}
                />
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {filteredRivers.map((river, i) => {
                const condition = river.current_condition;
                const status = condition?.status ?? 'unknown';
                const trend = river.trend ?? 'stable';
                const inRoster = rosterSet.has(river.id);
                return (
                  <div
                    key={river.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors',
                      i !== 0 && 'border-t border-border',
                      `border-l-4 ${getStatusBorderColor(status)}`
                    )}
                  >
                    {/* Name + region */}
                    <a href={`/rivers/${river.slug}`} className="flex-1 min-w-0 group">
                      <div className="font-medium text-sm leading-tight group-hover:text-primary transition-colors truncate">
                        {river.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{river.region}</div>
                    </a>

                    {/* Status */}
                    <span className={cn('hidden sm:inline-flex text-xs font-semibold px-2 py-0.5 rounded-md shrink-0', getStatusColor(status))}>
                      {getStatusLabel(status)}
                    </span>
                    {/* Status dot (mobile) */}
                    <span className={cn('sm:hidden h-2 w-2 rounded-full shrink-0', getStatusDotColor(status))} />

                    {/* Flow */}
                    <div className="text-sm font-semibold tabular-nums w-20 text-right shrink-0">
                      {formatFlow(condition?.flow ?? null)}
                    </div>

                    {/* Temp */}
                    <div className="hidden md:block text-sm text-muted-foreground tabular-nums w-16 text-right shrink-0">
                      {formatTemperature(condition?.temperature ?? null)}
                    </div>

                    {/* Trend */}
                    <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground w-16 shrink-0">
                      {trend === 'rising'  && <TrendingUp   className="h-3.5 w-3.5 text-amber-600" />}
                      {trend === 'falling' && <TrendingDown  className="h-3.5 w-3.5 text-blue-600" />}
                      {trend === 'stable'  && <Minus         className="h-3.5 w-3.5" />}
                      <span className="capitalize">{trend}</span>
                    </div>

                    {/* Roster toggle */}
                    {isAuthenticated && (
                      <button
                        type="button"
                        onClick={() => handleToggleRoster(river.id)}
                        className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                        aria-label={inRoster ? 'Remove from roster' : 'Add to roster'}
                      >
                        <Heart className={cn('h-4 w-4 transition-colors', inRoster ? 'fill-primary text-primary' : 'text-muted-foreground hover:text-primary')} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
