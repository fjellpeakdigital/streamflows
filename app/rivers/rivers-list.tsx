'use client';

import { useState, useMemo } from 'react';
import { RiverCard } from '@/components/river-card';
import { RiverWithCondition, RiverStatus } from '@/lib/types/database';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, SlidersHorizontal, X } from 'lucide-react';

interface RiversListProps {
  rivers: RiverWithCondition[];
}

export function RiversList({ rivers }: RiversListProps) {
  const [searchQuery, setSearchQuery]   = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [speciesFilter, setSpeciesFilter] = useState('all');

  const regions = useMemo(() => {
    return Array.from(new Set(rivers.map((r) => r.region))).sort();
  }, [rivers]);

  const species = useMemo(() => {
    const s = new Set<string>();
    rivers.forEach((r) => r.species?.forEach((sp) => s.add(sp.species)));
    return Array.from(s).sort();
  }, [rivers]);

  const filteredRivers = useMemo(() => {
    return rivers.filter((river) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !river.name.toLowerCase().includes(q) &&
          !river.region.toLowerCase().includes(q) &&
          !river.description?.toLowerCase().includes(q)
        ) return false;
      }
      if (regionFilter !== 'all' && river.region !== regionFilter) return false;
      if (statusFilter !== 'all') {
        const s = river.current_condition?.status ?? 'unknown';
        if (s !== statusFilter) return false;
      }
      if (speciesFilter !== 'all') {
        if (!river.species?.some((s) => s.species === speciesFilter)) return false;
      }
      return true;
    });
  }, [rivers, searchQuery, regionFilter, statusFilter, speciesFilter]);

  const hasFilters = searchQuery || regionFilter !== 'all' || statusFilter !== 'all' || speciesFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setRegionFilter('all');
    setStatusFilter('all');
    setSpeciesFilter('all');
  };

  return (
    <div className="space-y-6">

      {/* Filter bar */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="font-medium">Filter rivers</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or region…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>

        {/* Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="bg-background">
            <option value="all">All Regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>

          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-background">
            <option value="all">All Status</option>
            <option value="optimal">Optimal</option>
            <option value="elevated">Elevated</option>
            <option value="high">High</option>
            <option value="low">Low</option>
            <option value="ice_affected">Gauge Not Responding</option>
            <option value="unknown">No Data</option>
          </Select>

          <Select value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)} className="bg-background">
            <option value="all">All Species</option>
            {species.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </div>

        {/* Result count + clear */}
        {hasFilters && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredRivers.length}</span> of {rivers.length} rivers
            </p>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Grid */}
      {filteredRivers.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <p className="text-muted-foreground text-lg mb-1">No rivers match your filters.</p>
          <p className="text-muted-foreground text-sm mb-4">Try broadening your search.</p>
          <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRivers.map((river) => (
            <RiverCard key={river.id} river={river} showFavorite={false} />
          ))}
        </div>
      )}

    </div>
  );
}
