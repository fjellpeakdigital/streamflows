import { RiverStatus, FlowTrend } from './types/database';

export function calculateStatus(
  flow: number | null,
  optimalMin: number | null,
  optimalMax: number | null
): RiverStatus {
  if (flow === null) return 'no_data';
  if (flow <= -999000) return 'no_data';
  if (optimalMin === null || optimalMax === null) return 'unknown';
  if (flow < optimalMin)                              return 'low';
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

/** Tailwind bg+text classes for status badge (light theme) */
export function getStatusColor(status: RiverStatus): string {
  switch (status) {
    case 'optimal':      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'elevated':     return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'high':         return 'bg-red-100 text-red-800 border-red-200';
    case 'low':          return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'ice_affected': return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'no_data':      return 'bg-zinc-100 text-zinc-500 border-zinc-200';
    default:             return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  }
}

/** Stronger badge style for hero/marketing use */
export function getStatusColorSolid(status: RiverStatus): string {
  switch (status) {
    case 'optimal':      return 'bg-emerald-500 text-white border-transparent';
    case 'elevated':     return 'bg-amber-500 text-white border-transparent';
    case 'high':         return 'bg-red-500 text-white border-transparent';
    case 'low':          return 'bg-blue-500 text-white border-transparent';
    case 'ice_affected': return 'bg-slate-500 text-white border-transparent';
    case 'no_data':      return 'bg-zinc-400 text-white border-transparent';
    default:             return 'bg-zinc-500 text-white border-transparent';
  }
}

/** Left border color class for river cards */
export function getStatusBorderColor(status: RiverStatus): string {
  switch (status) {
    case 'optimal':      return 'border-l-emerald-500';
    case 'elevated':     return 'border-l-amber-500';
    case 'high':         return 'border-l-red-500';
    case 'low':          return 'border-l-blue-500';
    case 'ice_affected': return 'border-l-slate-400';
    case 'no_data':      return 'border-l-zinc-300';
    default:             return 'border-l-zinc-400';
  }
}

/** Dot color for status dashboard tiles */
export function getStatusDotColor(status: RiverStatus): string {
  switch (status) {
    case 'optimal':      return 'bg-emerald-500';
    case 'elevated':     return 'bg-amber-500';
    case 'high':         return 'bg-red-500';
    case 'low':          return 'bg-blue-500';
    case 'ice_affected': return 'bg-slate-400';
    case 'no_data':      return 'bg-zinc-300';
    default:             return 'bg-zinc-400';
  }
}

export function getStatusLabel(status: RiverStatus): string {
  switch (status) {
    case 'optimal':      return 'Optimal';
    case 'elevated':     return 'Elevated';
    case 'high':         return 'High';
    case 'low':          return 'Low';
    case 'ice_affected': return 'Gauge Not Responding';
    case 'no_data':      return 'No Data';
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

export function formatFlow(flow: number | null | undefined): string {
  if (flow === null || flow === undefined) return 'N/A';
  if (flow <= -999000) return 'N/A';
  return `${flow.toLocaleString()} CFS`;
}

export function formatTemperature(temp: number | null | undefined): string {
  if (temp === null || temp === undefined) return 'N/A';
  return `${temp.toFixed(1)}°F`;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
