import { RiverStatus, FlowTrend } from './types/database';

export function calculateStatus(
  flow: number | null,
  optimalMin: number | null,
  optimalMax: number | null
): RiverStatus {
  if (flow === null || flow <= -999000) return 'ice_affected';
  if (optimalMin === null || optimalMax === null) return 'unknown';
  if (flow < optimalMin * 0.5)                        return 'low';
  if (flow >= optimalMin && flow <= optimalMax)        return 'optimal';
  if (flow > optimalMax && flow <= optimalMax * 1.5)  return 'elevated';
  if (flow > optimalMax * 1.5)                        return 'high';
  return 'unknown';
}

export function calculateTrend(currentFlow: number, flowThreeHoursAgo: number): FlowTrend {
  if (currentFlow > flowThreeHoursAgo * 1.10) return 'rising';
  if (currentFlow < flowThreeHoursAgo * 0.90) return 'falling';
  return 'stable';
}

/** Tailwind bg+text classes for status badge (optimized for dark backgrounds) */
export function getStatusColor(status: RiverStatus): string {
  switch (status) {
    case 'optimal':      return 'bg-emerald-500 text-white border-transparent';
    case 'elevated':     return 'bg-amber-500 text-white border-transparent';
    case 'high':         return 'bg-red-500 text-white border-transparent';
    case 'low':          return 'bg-blue-500 text-white border-transparent';
    case 'ice_affected': return 'bg-cyan-500 text-white border-transparent';
    default:             return 'bg-zinc-600 text-white border-transparent';
  }
}

/** Left border color class for river cards */
export function getStatusBorderColor(status: RiverStatus): string {
  switch (status) {
    case 'optimal':      return 'border-l-emerald-500';
    case 'elevated':     return 'border-l-amber-500';
    case 'high':         return 'border-l-red-500';
    case 'low':          return 'border-l-blue-500';
    case 'ice_affected': return 'border-l-cyan-500';
    default:             return 'border-l-zinc-600';
  }
}

/** Dot color for status dashboard tiles */
export function getStatusDotColor(status: RiverStatus): string {
  switch (status) {
    case 'optimal':      return 'bg-emerald-500';
    case 'elevated':     return 'bg-amber-500';
    case 'high':         return 'bg-red-500';
    case 'low':          return 'bg-blue-500';
    case 'ice_affected': return 'bg-cyan-500';
    default:             return 'bg-zinc-500';
  }
}

export function getStatusLabel(status: RiverStatus): string {
  switch (status) {
    case 'optimal':      return 'Optimal';
    case 'elevated':     return 'Elevated';
    case 'high':         return 'High';
    case 'low':          return 'Low';
    case 'ice_affected': return 'Ice Affected';
    default:             return 'Unknown';
  }
}

/** Legacy emoji trend — kept for any server-side use */
export function getTrendIcon(trend: FlowTrend): string {
  switch (trend) {
    case 'rising':  return '↗';
    case 'falling': return '↘';
    case 'stable':  return '→';
    default:        return '→';
  }
}

export function formatFlow(flow: number | null): string {
  if (!flow) return 'N/A';
  return `${flow.toLocaleString()} CFS`;
}

export function formatTemperature(temp: number | null): string {
  if (!temp) return 'N/A';
  return `${temp.toFixed(1)}°F`;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
