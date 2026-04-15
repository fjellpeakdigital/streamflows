'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RiverCard } from '@/components/river-card';
import { RiverWithCondition } from '@/lib/types/database';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  formatFlow,
  formatTemperature,
  getStatusBorderColor,
} from '@/lib/river-utils';
import { Search, TrendingUp, TrendingDown, Minus, Waves, Thermometer, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RiversListProps {
  rivers: RiverWithCondition[];
  rosterRiverIds?: string[];
  isAuthenticated?: boolean;
}

const SORT_ORDER: Record<string, number> = {
  optimal: 0,
  elevated: 1,
  high: 2,
  low: 3,
  ice_affected: 4,
  no_data: 5,
  unknown: 5,
};

function sortByStatus(a: RiverWithCondition, b: RiverWithCondition) {
  const sa = a.current_condition?.status ?? 'unknown';
  const sb = b.current_condition?.status ?? 'unknown';
  const ra = SORT_ORDER[sa] ?? 5;
  const rb = SORT_ORDER[sb] ?? 5;
  if (ra !== rb) return ra - rb;
  return a.name.localeCompare(b.name);
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'rising')  return <TrendingUp  className="h-3.5 w-3.5 text-amber-500" />;
  if (trend === 'falling') return <TrendingDown className="h-3.5 w-3.5 text-blue-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

// Compact card used in the "Fishing Well Now" strip
function OptimalCard({ river }: { river: RiverWithCondition }) {
  const cond = river.current_condition;
  const trend = river.trend ?? 'stable';
  return (
    <Link href={`/rivers/${river.slug}`} className="group block">
      <div className={cn(
        'rounded-xl border bg-white px-4 py-3 transition-all duration-150',
        'border-l-4 hover:shadow-sm hover:-translate-y-px',
        getStatusBorderColor('optimal'),
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate group-hover:text-primary transition-colors">
              {river.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{river.region}</p>
          </div>
          <TrendIcon trend={trend} />
        </div>
        <div className="mt-2.5 flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Waves className="h-3 w-3" />
            <span className="font-semibold text-foreground">{formatFlow(cond?.flow ?? null)}</span>
          </span>
          {cond?.temperature != null && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Thermometer className="h-3 w-3" />
              <span className="font-semibold text-foreground">{formatTemperature(cond.temperature)}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function RiversList({
  rivers,
  rosterRiverIds = [],
  isAuthenticated = false,
}: RiversListProps) {
  const router = useRouter();

  const [mode, setMode] = useState<'roster' | 'discover'>(
    isAuthenticated ? 'roster' : 'discover'
  );
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [searchQuery, setSearchQuery]       = useState('');
  const [speciesFilter, setSpeciesFilter]   = useState('all');

  const [localRoster, setLocalRoster] = useState<Set<string>>(
    () => new Set(rosterRiverIds)
  );

  const handleToggleRoster = async (riverId: string) => {
    if (!isAuthenticated) { window.location.href = '/login'; return; }
    const inRoster = localRoster.has(riverId);
    setLocalRoster((prev) => {
      const next = new Set(prev);
      inRoster ? next.delete(riverId) : next.add(riverId);
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
      // revert
      setLocalRoster((prev) => {
        const next = new Set(prev);
        inRoster ? next.add(riverId) : next.delete(riverId);
        return next;
      });
    }
  };

  const rosterSet = localRoster;

  const sourceRivers = useMemo(
    () => mode === 'roster' ? rivers.filter((r) => rosterSet.has(r.id)) : rivers,
    [rivers, mode, rosterSet]
  );

  // Regions available in current source
  const regions = useMemo(
    () => Array.from(new Set(sourceRivers.map((r) => r.region))).sort(),
    [sourceRivers]
  );

  // Species available in current source
  const species = useMemo(() => {
    const s = new Set<string>();
    sourceRivers.forEach((r) => r.species?.forEach((sp) => s.add(sp.species)));
    return Array.from(s).sort();
  }, [sourceRivers]);

  // Rivers at optimal status — used for "Fishing Well Now" strip
  const optimalRivers = useMemo(() => {
    const optimal = sourceRivers
      .filter((r) => r.current_condition?.status === 'optimal')
      .sort((a, b) => {
        // Roster rivers first, then by angler rating, then name
        const aRoster = rosterSet.has(a.id) ? 0 : 1;
        const bRoster = rosterSet.has(b.id) ? 0 : 1;
        if (aRoster !== bRoster) return aRoster - bRoster;
        return a.name.localeCompare(b.name);
      });
    return optimal.slice(0, 6);
  }, [sourceRivers, rosterSet]);

  // Main list: region-filtered + search + species
  const filteredRivers = useMemo(() => {
    const result = sourceRivers.filter((river) => {
      if (selectedRegion !== 'all' && river.region !== selectedRegion) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !river.name.toLowerCase().includes(q) &&
          !river.region.toLowerCase().includes(q) &&
          !river.description?.toLowerCase().includes(q)
        ) return false;
      }
      if (speciesFilter !== 'all') {
        if (!river.species?.some((s) => s.species === speciesFilter)) return false;
      }
      return true;
    });
    return [...result].sort(sortByStatus);
  }, [sourceRivers, selectedRegion, searchQuery, speciesFilter]);

  const hasFilters = searchQuery || speciesFilter !== 'all';
  const clearFilters = () => { setSearchQuery(''); setSpeciesFilter('all'); };

  const showRosterEmpty = isAuthenticated && mode === 'roster' && sourceRivers.length === 0;

  return (
    <div className="space-y-6">

      {/* Mode toggle */}
      {isAuthenticated && (
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => { setMode('roster'); setSelectedRegion('all'); }}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              mode === 'roster' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            My Rivers
          </button>
          <button
            type="button"
            onClick={() => { setMode('discover'); setSelectedRegion('all'); }}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              mode === 'discover' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Discover new water
          </button>
        </div>
      )}

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
          {/* Fishing Well Now */}
          {optimalRivers.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold">
                  Fishing well now
                  <span className="ml-2 inline-flex items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold px-2 py-0.5">
                    {optimalRivers.length}
                  </span>
                </h2>
                {optimalRivers.length === 6 && (
                  <button
                    type="button"
                    onClick={() => { setSelectedRegion('all'); setSpeciesFilter('all'); setSearchQuery(''); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    See all optimal
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {optimalRivers.map((river) => (
                  <OptimalCard key={river.id} river={river} />
                ))}
              </div>
            </section>
          )}

          {/* Region tabs */}
          <section>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                type="button"
                onClick={() => setSelectedRegion('all')}
                className={cn(
                  'whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors shrink-0',
                  selectedRegion === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                All regions
              </button>
              {regions.map((region) => (
                <button
                  key={region}
                  type="button"
                  onClick={() => setSelectedRegion(region)}
                  className={cn(
                    'whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors shrink-0',
                    selectedRegion === region
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  )}
                >
                  {region}
                </button>
              ))}
            </div>
          </section>

          {/* Search + species filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search rivers…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
            <Select
              value={speciesFilter}
              onChange={(e) => setSpeciesFilter(e.target.value)}
              className="bg-background sm:w-44"
            >
              <option value="all">All species</option>
              {species.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>

          {/* Count label */}
          <p className="text-sm text-muted-foreground -mt-2">
            {filteredRivers.length === sourceRivers.length
              ? `${filteredRivers.length} rivers`
              : `${filteredRivers.length} of ${sourceRivers.length} rivers`}
            {selectedRegion !== 'all' && ` in ${selectedRegion}`}
          </p>

          {/* River grid */}
          {filteredRivers.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-xl">
              <p className="text-muted-foreground text-lg mb-1">No rivers match your filters.</p>
              <p className="text-muted-foreground text-sm mb-4">Try broadening your search.</p>
              <Button variant="outline" onClick={() => { clearFilters(); setSelectedRegion('all'); }}>
                Clear all
              </Button>
            </div>
          ) : (
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
          )}
        </>
      )}
    </div>
  );
}
