import type { Condition, FlowTrend, RiverStatus } from '@/lib/types/database';

export interface BackupRiverCandidate {
  id: string;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  current_condition: Condition | null;
  trend?: FlowTrend | null;
}

export interface BackupRiverScore {
  river: BackupRiverCandidate;
  score: number;
  distanceMi: number | null;
  rationale: string;
}

const STATUS_POINTS: Record<RiverStatus, number> = {
  optimal: 3,
  elevated: 2,
  low: 1,
  high: 0,
  ice_affected: -1,
  no_data: -1,
  unknown: -1,
};

const TREND_POINTS: Record<FlowTrend, number> = {
  stable: 2,
  falling: 1,
  rising: 0,
  unknown: 0,
};

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function statusLabel(status: RiverStatus): string {
  switch (status) {
    case 'optimal':
      return 'Optimal';
    case 'elevated':
      return 'Elevated';
    case 'high':
      return 'High';
    case 'low':
      return 'Low';
    case 'ice_affected':
      return 'Gauge not responding';
    case 'no_data':
      return 'No data';
    default:
      return 'Unknown';
  }
}

function trendLabel(trend: FlowTrend): string {
  switch (trend) {
    case 'rising':
      return 'rising';
    case 'falling':
      return 'falling';
    case 'stable':
      return 'stable';
    default:
      return 'trend unknown';
  }
}

export function scoreBackupRiver(
  rivers: BackupRiverCandidate[],
  primaryRiverId: string
): BackupRiverScore | null {
  if (rivers.length < 2) return null;

  const primary = rivers.find((r) => r.id === primaryRiverId) ?? null;
  const candidates = rivers.filter((r) => r.id !== primaryRiverId);
  if (candidates.length === 0) return null;

  const scored: BackupRiverScore[] = candidates.map((river) => {
    const status = (river.current_condition?.status ?? 'unknown') as RiverStatus;
    const trend = (river.trend ?? 'unknown') as FlowTrend;

    let score = (STATUS_POINTS[status] ?? -1) + (TREND_POINTS[trend] ?? 0);

    let distanceMi: number | null = null;
    if (
      primary &&
      primary.latitude !== null &&
      primary.longitude !== null &&
      river.latitude !== null &&
      river.longitude !== null
    ) {
      distanceMi = haversineMiles(
        primary.latitude,
        primary.longitude,
        river.latitude,
        river.longitude
      );
      if (distanceMi < 50) score += 1;
    }

    const parts = [statusLabel(status), trendLabel(trend)];
    if (distanceMi !== null) parts.push(`${Math.round(distanceMi)} mi away`);
    const rationale = `${river.name} — ${parts.join(', ')}`;

    return { river, score, distanceMi, rationale };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = a.distanceMi ?? Number.POSITIVE_INFINITY;
    const db = b.distanceMi ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.river.name.localeCompare(b.river.name);
  });

  return scored[0] ?? null;
}
