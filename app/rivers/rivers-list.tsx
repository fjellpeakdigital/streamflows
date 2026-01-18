'use client';

import { useState, useMemo } from 'react';
import { RiverCard } from '@/components/river-card';
import { RiverWithCondition, RiverStatus } from '@/lib/types/database';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface RiversListProps {
  rivers: RiverWithCondition[];
}

export function RiversList({ rivers }: RiversListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [speciesFilter, setSpeciesFilter] = useState<string>('all');

  // Get unique regions and species
  const regions = useMemo(() => {
    const uniqueRegions = new Set(rivers.map((r) => r.region));
    return Array.from(uniqueRegions).sort();
  }, [rivers]);

  const species = useMemo(() => {
    const uniqueSpecies = new Set<string>();
    rivers.forEach((r) => {
      r.species?.forEach((s) => uniqueSpecies.add(s.species));
    });
    return Array.from(uniqueSpecies).sort();
  }, [rivers]);

  // Filter rivers
  const filteredRivers = useMemo(() => {
    return rivers.filter((river) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          river.name.toLowerCase().includes(query) ||
          river.region.toLowerCase().includes(query) ||
          river.description?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Region filter
      if (regionFilter !== 'all' && river.region !== regionFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const status = river.current_condition?.status || 'low';
        if (status !== statusFilter) return false;
      }

      // Species filter
      if (speciesFilter !== 'all') {
        const hasSpecies = river.species?.some((s) => s.species === speciesFilter);
        if (!hasSpecies) return false;
      }

      return true;
    });
  }, [rivers, searchQuery, regionFilter, statusFilter, speciesFilter]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setRegionFilter('all');
    setStatusFilter('all');
    setSpeciesFilter('all');
  };

  const hasActiveFilters =
    searchQuery || regionFilter !== 'all' || statusFilter !== 'all' || speciesFilter !== 'all';

  return (
    <div>
      {/* Filters */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search rivers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
          >
            <option value="all">All Regions</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="optimal">Optimal</option>
            <option value="elevated">Elevated</option>
            <option value="high">High</option>
            <option value="low">Low</option>
            <option value="ice_affected">Ice Affected</option>
          </Select>

          <Select
            value={speciesFilter}
            onChange={(e) => setSpeciesFilter(e.target.value)}
          >
            <option value="all">All Species</option>
            {species.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredRivers.length} of {rivers.length} rivers
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Rivers Grid */}
      {filteredRivers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            No rivers found matching your filters.
          </p>
          <Button onClick={handleClearFilters} className="mt-4">
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRivers.map((river) => (
            <RiverCard key={river.id} river={river} showFavorite={false} />
          ))}
        </div>
      )}
    </div>
  );
}
