/**
 * Interprets raw river conditions into plain-English, actionable signals for
 * fly fishing guides and anglers.
 *
 * Pure function — no API calls, no async. Takes the data we already have and
 * returns structured interpretation objects that drive the ConditionsSummaryCard.
 */

import type { RiverStatus, FlowTrend } from './types/database';

export type ConditionRating = 'excellent' | 'good' | 'fair' | 'poor' | 'warning';
export type SignalSentiment = 'positive' | 'neutral' | 'caution' | 'negative';
export type SignalCategory = 'flow' | 'temperature' | 'dam' | 'timing';

export interface ConditionSignal {
  category: SignalCategory;
  sentiment: SignalSentiment;
  label: string;
  detail: string;
}

export interface ConditionsInterpretation {
  rating: ConditionRating;
  headline: string;
  signals: ConditionSignal[];
  /** Single most useful piece of tactical advice for today. */
  actionTip: string;
}

export interface InterpreterInput {
  flow: number | null;
  temperature: number | null;
  status: RiverStatus | null;
  trend: FlowTrend | null;
  optimalMin: number | null;
  optimalMax: number | null;
  /** 'PROJECT' triggers dam interpretation */
  cwmsLocationKind: string | null;
  reservoirReleaseCfs: number | null;
  reservoirPoolFt: number | null;
}

// ── Flow interpretation ────────────────────────────────────────────────────────

function flowSignal(
  flow: number,
  optimalMin: number | null,
  optimalMax: number | null
): ConditionSignal {
  const cfs = Math.round(flow);

  if (optimalMin == null || optimalMax == null) {
    return {
      category: 'flow',
      sentiment: 'neutral',
      label: `${cfs} CFS`,
      detail: 'No optimal range on file for comparison.',
    };
  }

  const ratio = flow / optimalMax;

  if (flow < optimalMin * 0.5) {
    return {
      category: 'flow',
      sentiment: 'negative',
      label: 'Very low water',
      detail: `${cfs} CFS — well below optimal (${optimalMin}–${optimalMax}). Fish compressed into pools and deepest runs.`,
    };
  }
  if (flow < optimalMin) {
    return {
      category: 'flow',
      sentiment: 'caution',
      label: 'Below optimal',
      detail: `${cfs} CFS — slightly low. Focus on pools, deeper runs, and slower pocket water.`,
    };
  }
  if (flow <= optimalMax) {
    return {
      category: 'flow',
      sentiment: 'positive',
      label: 'Optimal flow',
      detail: `${cfs} CFS — within optimal range. Fish all water types, wade comfortably.`,
    };
  }
  if (ratio <= 1.4) {
    return {
      category: 'flow',
      sentiment: 'caution',
      label: 'Elevated flow',
      detail: `${cfs} CFS — above optimal. Fish slower water and eddy lines. Careful wading.`,
    };
  }
  if (ratio <= 2.0) {
    return {
      category: 'flow',
      sentiment: 'negative',
      label: 'High water',
      detail: `${cfs} CFS — significantly above optimal. Wading difficult. Fish structure and bank water.`,
    };
  }
  return {
    category: 'flow',
    sentiment: 'negative',
    label: 'Flood conditions',
    detail: `${cfs} CFS — unsafe wading. Fish from banks only or postpone.`,
  };
}

// ── Temperature interpretation ─────────────────────────────────────────────────

function temperatureSignal(temp: number): ConditionSignal {
  const f = temp.toFixed(1);
  if (temp < 40) {
    return {
      category: 'temperature',
      sentiment: 'negative',
      label: 'Very cold water',
      detail: `${f}°F — fish lethargic. Slow-drift nymphs mid-day in deep pools.`,
    };
  }
  if (temp < 50) {
    return {
      category: 'temperature',
      sentiment: 'caution',
      label: 'Cold water',
      detail: `${f}°F — fish sluggish. Best fishing mid-day. Deep nymphs or slow streamers.`,
    };
  }
  if (temp <= 65) {
    return {
      category: 'temperature',
      sentiment: 'positive',
      label: 'Ideal temperature',
      detail: `${f}°F — prime trout range. All techniques viable, surface activity and hatches likely.`,
    };
  }
  if (temp <= 70) {
    return {
      category: 'temperature',
      sentiment: 'caution',
      label: 'Warming water',
      detail: `${f}°F — upper range for trout. Fish early morning and evening. Avoid prolonged fights.`,
    };
  }
  return {
    category: 'temperature',
    sentiment: 'negative',
    label: 'Thermal stress risk',
    detail: `${f}°F — above 70°F. Trout under stress. Fish early morning only or postpone.`,
  };
}

// ── Dam interpretation ─────────────────────────────────────────────────────────

function damSignal(
  releaseCfs: number,
  optimalMin: number | null,
  optimalMax: number | null
): ConditionSignal {
  const cfs = Math.round(releaseCfs);

  if (optimalMin == null || optimalMax == null) {
    return {
      category: 'dam',
      sentiment: 'neutral',
      label: 'Dam releasing',
      detail: `${cfs} CFS outflow — tailwater conditions apply downstream.`,
    };
  }

  if (releaseCfs < optimalMin * 0.7) {
    return {
      category: 'dam',
      sentiment: 'caution',
      label: 'Low dam releases',
      detail: `${cfs} CFS outflow — below optimal range. Low water expected downstream.`,
    };
  }
  if (releaseCfs <= optimalMax * 1.1) {
    return {
      category: 'dam',
      sentiment: 'positive',
      label: 'Dam releasing optimally',
      detail: `${cfs} CFS outflow — within optimal window. Consistent tailwater conditions expected.`,
    };
  }
  if (releaseCfs <= optimalMax * 1.5) {
    return {
      category: 'dam',
      sentiment: 'caution',
      label: 'Above-optimal releases',
      detail: `${cfs} CFS outflow — elevated. Expect higher-than-optimal flows at the gauge.`,
    };
  }
  return {
    category: 'dam',
    sentiment: 'negative',
    label: 'High dam releases',
    detail: `${cfs} CFS outflow — well above optimal. Difficult wading and high water downstream.`,
  };
}

// ── Trend / timing interpretation ─────────────────────────────────────────────

function timingSignal(trend: FlowTrend, status: RiverStatus | null): ConditionSignal | null {
  if (!trend || trend === 'unknown') return null;

  if (trend === 'rising') {
    if (status === 'high' || status === 'elevated') {
      return {
        category: 'timing',
        sentiment: 'negative',
        label: 'Rising — deteriorating',
        detail: 'Flow increasing from already-high levels. Conditions worsening through the day.',
      };
    }
    if (status === 'optimal') {
      return {
        category: 'timing',
        sentiment: 'caution',
        label: 'Rising — fish now',
        detail: 'Optimal now but rising. Best window is earlier today before flow increases.',
      };
    }
    return {
      category: 'timing',
      sentiment: 'neutral',
      label: 'Rising — improving',
      detail: 'Flow increasing from low levels. Conditions likely improving toward optimal.',
    };
  }

  if (trend === 'falling') {
    if (status === 'high' || status === 'elevated') {
      return {
        category: 'timing',
        sentiment: 'neutral',
        label: 'Falling — improving',
        detail: 'High flow dropping. Watch for conditions to reach optimal range.',
      };
    }
    if (status === 'optimal') {
      return {
        category: 'timing',
        sentiment: 'positive',
        label: 'Dropping into shape',
        detail: 'Falling from high into optimal range. Good window opening and likely extending.',
      };
    }
    return {
      category: 'timing',
      sentiment: 'caution',
      label: 'Falling — going low',
      detail: 'Flow dropping below optimal. Fishing window narrowing.',
    };
  }

  // stable
  if (status === 'optimal') {
    return {
      category: 'timing',
      sentiment: 'positive',
      label: 'Holding steady',
      detail: 'Stable in optimal range. Consistent conditions expected all day.',
    };
  }
  return {
    category: 'timing',
    sentiment: 'neutral',
    label: 'Stable conditions',
    detail: 'No significant change expected in the near term.',
  };
}

// ── Overall rating ─────────────────────────────────────────────────────────────

function computeRating(
  signals: ConditionSignal[],
  temperature: number | null,
  status: RiverStatus | null
): ConditionRating {
  if (temperature !== null && temperature > 70) return 'warning';

  const negatives = signals.filter(s => s.sentiment === 'negative').length;
  const cautions  = signals.filter(s => s.sentiment === 'caution').length;
  const positives = signals.filter(s => s.sentiment === 'positive').length;

  if (negatives >= 2) return 'poor';
  if (negatives === 1 && status !== 'optimal') return 'poor';
  if (negatives === 1 || cautions >= 2) return 'fair';
  if (cautions === 1) return 'good';
  if (positives >= 2) return 'excellent';
  return 'good';
}

// ── Headline ───────────────────────────────────────────────────────────────────

function computeHeadline(
  rating: ConditionRating,
  status: RiverStatus | null,
  trend: FlowTrend | null,
  temperature: number | null
): string {
  if (rating === 'warning') return 'Warm water advisory — fish early or postpone';

  if (rating === 'excellent') {
    if (trend === 'stable') return 'Prime conditions — stable all day';
    if (trend === 'falling') return 'Conditions improving — excellent window opening';
    return 'Prime conditions — fish all day';
  }

  if (rating === 'good') {
    if (trend === 'rising' && status === 'optimal') return 'Fishing well now — act before flow rises';
    if (trend === 'falling') return 'Improving — good window developing';
    return 'Good conditions with minor caveats';
  }

  if (rating === 'fair') {
    if (status === 'low')      return 'Low water — technical fishing, light tippet';
    if (status === 'elevated') return 'Elevated flows — fish the edges';
    return 'Mixed conditions — adapt your approach';
  }

  if (rating === 'poor') {
    if (status === 'high') return 'High water — difficult wading, adjust expectations';
    if (status === 'low')  return 'Very low water — tough conditions';
    return 'Challenging conditions today';
  }

  return 'Check conditions before heading out';
}

// ── Action tip ─────────────────────────────────────────────────────────────────

function computeActionTip(
  status: RiverStatus | null,
  trend: FlowTrend | null,
  temperature: number | null
): string {
  if (temperature !== null && temperature > 70) {
    return 'Protect fish — wet hands, minimize fight time, keep in water. Consider delaying until temps drop.';
  }
  if (temperature !== null && temperature > 65) {
    return 'Target early morning and shaded, spring-fed sections. Keep fish in water for releases.';
  }

  if (status === 'optimal') {
    if (trend === 'rising')  return 'Fish now — riffles and runs before rising water pushes fish to edges.';
    if (trend === 'falling') return 'Expanding window — fish riffles, pocket water, and runs. Match the hatch.';
    return 'Fish all water types — riffles, seams, and pocket water. Match the hatch or go subsurface.';
  }

  if (status === 'elevated') {
    return 'Focus on slack water, eddy lines, and structure behind boulders. Larger, visible flies work best.';
  }

  if (status === 'high') {
    return 'Fish from the bank. Streamers and large nymphs in slack water. Short-line nymphing near structure.';
  }

  if (status === 'low') {
    return 'Light tippet, small flies, long leaders. Fish pools and deep runs — approach slowly and low.';
  }

  return 'Assess conditions at the water and adjust tactics to what you find.';
}

// ── Main export ────────────────────────────────────────────────────────────────

export function interpretConditions(input: InterpreterInput): ConditionsInterpretation {
  const {
    flow, temperature, status, trend,
    optimalMin, optimalMax,
    cwmsLocationKind, reservoirReleaseCfs,
  } = input;

  const signals: ConditionSignal[] = [];

  if (flow !== null) {
    signals.push(flowSignal(flow, optimalMin, optimalMax));
  }

  if (temperature !== null) {
    signals.push(temperatureSignal(temperature));
  }

  if (cwmsLocationKind === 'PROJECT' && reservoirReleaseCfs !== null) {
    signals.push(damSignal(reservoirReleaseCfs, optimalMin, optimalMax));
  }

  if (trend) {
    const ts = timingSignal(trend, status);
    if (ts) signals.push(ts);
  }

  const rating    = computeRating(signals, temperature, status);
  const headline  = computeHeadline(rating, status, trend, temperature);
  const actionTip = computeActionTip(status, trend, temperature);

  return { rating, headline, signals, actionTip };
}
