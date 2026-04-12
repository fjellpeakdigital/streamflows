import { RiverStatus, FlowTrend } from './types/database';

/**
 * Calculate river status based on current flow and optimal range
 */
export function calculateStatus(
  flow: number | null,
  optimalMin: number | null,
  optimalMax: number | null
): RiverStatus {
  if (flow === null || flow <= -999000) return 'ice_affected';
  if (optimalMin === null || optimalMax === null) return 'unknown';
  if (flow < optimalMin * 0.5)                   return 'low';
  if (flow >= optimalMin && flow <= optimalMax)   return 'optimal';
  if (flow > optimalMax && flow <= optimalMax * 1.5) return 'elevated';
  if (flow > optimalMax * 1.5)                   return 'high';
  return 'unknown';
}

/**
 * Calculate flow trend based on recent conditions
 */
export function calculateTrend(currentFlow: number, flowThreeHoursAgo: number): FlowTrend {
  if (currentFlow > flowThreeHoursAgo * 1.10) return 'rising';
  if (currentFlow < flowThreeHoursAgo * 0.90) return 'falling';
  return 'stable';
}

/**
 * Get status color class for UI
 */
export function getStatusColor(status: RiverStatus): string {
  switch (status) {
    case 'optimal':
      return 'bg-green-600 text-white';
    case 'elevated':
      return 'bg-yellow-500 text-white';
    case 'high':
      return 'bg-red-600 text-white';
    case 'low':
      return 'bg-blue-600 text-white';
    case 'ice_affected':
      return 'bg-sky-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

/**
 * Get status label for display
 */
export function getStatusLabel(status: RiverStatus): string {
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
      return 'Ice Affected';
    default:
      return 'Unknown';
  }
}

/**
 * Get trend icon
 */
export function getTrendIcon(trend: FlowTrend): string {
  switch (trend) {
    case 'rising':
      return '↗';
    case 'falling':
      return '↘';
    case 'stable':
      return '→';
    default:
      return '→';
  }
}

/**
 * Format flow value for display
 */
export function formatFlow(flow: number | null): string {
  if (!flow) return 'N/A';
  return `${flow.toLocaleString()} CFS`;
}

/**
 * Format temperature for display
 */
export function formatTemperature(temp: number | null): string {
  if (!temp) return 'N/A';
  return `${temp.toFixed(1)}°F`;
}

/**
 * Generate river slug from name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
