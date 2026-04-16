/**
 * Canonical list of regions a user can pick as a "home region".
 * Kept in one place so signup, account settings, and rivers page agree.
 */
export const AVAILABLE_REGIONS = [
  'Connecticut',
  'Maine',
  'Massachusetts',
  'New Hampshire',
  'Vermont',
] as const;

export type HomeRegion = (typeof AVAILABLE_REGIONS)[number];

/**
 * Read a user's chosen regions from Supabase `user.user_metadata`.
 *
 * Supports both the new array shape (`home_regions: string[]`) and the
 * legacy single-value shape (`home_region: string`). If neither is set,
 * returns an empty array — callers should treat that as "no scope: show
 * all regions" (matches the pre-home-region behavior of the rivers page).
 */
export function getUserHomeRegions(
  user: { user_metadata?: Record<string, unknown> | null } | null | undefined
): string[] {
  const meta = user?.user_metadata ?? null;
  if (!meta) return [];

  const plural = meta.home_regions;
  if (Array.isArray(plural)) {
    return plural.filter((r): r is string => typeof r === 'string' && r.length > 0);
  }

  const singular = meta.home_region;
  if (typeof singular === 'string' && singular.length > 0) {
    return [singular];
  }

  return [];
}

/**
 * Human-readable label for a list of regions, used in page headers
 * like "Real-time flow data for 61 rivers in New Hampshire" or
 * "across 3 regions".
 */
export function formatHomeRegionsLabel(regions: string[]): string {
  if (regions.length === 0) return '';
  if (regions.length === 1) return regions[0];
  if (regions.length === 2) return `${regions[0]} and ${regions[1]}`;
  if (regions.length <= 3) {
    return `${regions.slice(0, -1).join(', ')}, and ${regions[regions.length - 1]}`;
  }
  return `${regions.length} regions`;
}
