'use client';

import { useState, useMemo } from 'react';
import { RiverCard } from '@/components/river-card';
import { RiverWithCondition, RiverStatus } from '@/lib/types/database';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RiversListProps {
  rivers: RiverWithCondition[];
  rosterRiverIds?: string[];
  isAuthenticated?: boolean;
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
}: RiversListProps) {
  const [mode, setMode] = useState<'roster' | 'discover'>(
    isAuthenticated ? 'roster' : 'discover'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [speciesFilter, setSpeciesFilter] = useState('all');

  const rosterSet = useMemo(() => new Set(rosterRiverIds), [rosterRiverIds]);
  const rosterRivers = useMemo(
    () => rivers.filter((r) => rosterSet.has(r.id)),
    [rivers, rosterSet]
  );

  const sourceRivers = mode === 'roster' ? rosterRivers : rivers;

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
      if (regionFilter !== 'all' && river.region !== regionFilter) return false;
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
  }, [sourceRivers, mode, searchQuery, regionFilter, statusFilter, speciesFilter]);

  const hasFilters =
    (mode === 'discover' && searchQuery) ||
    regionFilter !== 'all' ||
    (mode === 'discover' && statusFilter !== 'all') ||
    speciesFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setRegionFilter('all');
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="font-medium">Filter rivers</span>
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

            <div
              className={cn(
                'grid grid-cols-1 gap-3',
                mode === 'discover' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
              )}
            >
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

          {/* Grid */}
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRivers.map((river) => (
                <RiverCard key={river.id} river={river} showFavorite={false} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
