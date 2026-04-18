/**
 * Interprets raw river conditions into plain-English, actionable signals.
 *
 * Design principle: signals are synthesized holistically, not evaluated
 * independently. A tailwater dam releasing 10× the gauge reading is not a
 * separate "dam" signal — it IS the outlook signal. The goal is 2–3 composite
 * statements that don't contradict each other, plus one clear action tip.
 *
 * Signal structure:
 *   1. Current fishability  — synthesizes flow status + temperature together
 *   2. Outlook              — synthesizes dam release vs. gauge + trend
 *   3. Wading safety        — only emitted when flow is extreme
 */

import type { RiverStatus, FlowTrend } from './types/database';

export type ConditionRating  = 'excellent' | 'good' | 'fair' | 'poor' | 'warning';
export type SignalSentiment  = 'positive' | 'neutral' | 'caution' | 'negative';
export type SignalCategory   = 'current' | 'outlook' | 'safety';

export interface ConditionSignal {
  category:  SignalCategory;
  sentiment: SignalSentiment;
  label:     string;
  detail:    string;
}

export interface ConditionsInterpretation {
  rating:     ConditionRating;
  headline:   string;
  signals:    ConditionSignal[];
  actionTip:  string;
}

export interface InterpreterInput {
  flow:                number | null;
  temperature:         number | null;
  status:              RiverStatus | null;
  trend:               FlowTrend | null;
  optimalMin:          number | null;
  optimalMax:          number | null;
  cwmsLocationKind:    string | null;
  reservoirReleaseCfs: number | null;
  reservoirPoolFt:     number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

type FlowClass = 'very_low' | 'low' | 'optimal' | 'elevated' | 'high' | 'flood' | 'unknown';

function classifyFlow(
  flow: number | null,
  optimalMin: number | null,
  optimalMax: number | null
): FlowClass {
  if (flow === null) return 'unknown';
  if (optimalMin === null || optimalMax === null) return 'unknown';
  const ratio = flow / optimalMax;
  if (flow < optimalMin * 0.5) return 'very_low';
  if (flow < optimalMin)       return 'low';
  if (flow <= optimalMax)      return 'optimal';
  if (ratio <= 1.4)            return 'elevated';
  if (ratio <= 2.0)            return 'high';
  return 'flood';
}

type TempClass = 'very_cold' | 'cold' | 'ideal' | 'warm' | 'hot' | 'unknown';

function classifyTemp(temp: number | null): TempClass {
  if (temp === null) return 'unknown';
  if (temp < 40)  return 'very_cold';
  if (temp < 50)  return 'cold';
  if (temp <= 65) return 'ideal';
  if (temp <= 70) return 'warm';
  return 'hot';
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal 1: Current fishability (flow + temp together)
// ─────────────────────────────────────────────────────────────────────────────

function buildCurrentSignal(input: InterpreterInput): ConditionSignal {
  const { flow, temperature, optimalMin, optimalMax } = input;
  const flowClass = classifyFlow(flow, optimalMin, optimalMax);
  const tempClass = classifyTemp(temperature);

  const cfs  = flow        !== null ? `${Math.round(flow)} CFS`          : null;
  const degF = temperature !== null ? `${temperature.toFixed(1)}\u00b0F` : null;

  // Thermal stress overrides everything
  if (tempClass === 'hot') {
    return {
      category:  'current',
      sentiment: 'negative',
      label:     'Thermal stress conditions',
      detail:    `Water at ${degF} — above 70°F trout threshold. Fish are stressed regardless of flow.`,
    };
  }

  // Both good
  if (flowClass === 'optimal' && (tempClass === 'ideal' || tempClass === 'unknown')) {
    const tempNote = degF ? ` Temperature ${degF} — ideal for active feeding and hatches.` : '';
    return {
      category:  'current',
      sentiment: 'positive',
      label:     'Fishing well right now',
      detail:    `${cfs ?? 'Flow'} within optimal range — wade anywhere comfortably.${tempNote}`,
    };
  }

  // Good flow, temperature caveat
  if (flowClass === 'optimal' && tempClass === 'warm') {
    return {
      category:  'current',
      sentiment: 'caution',
      label:     'Good flow, warming water',
      detail:    `${cfs} optimal, but ${degF} is on the warm side. Fish early morning before temps climb further.`,
    };
  }

  if (flowClass === 'optimal' && (tempClass === 'cold' || tempClass === 'very_cold')) {
    return {
      category:  'current',
      sentiment: 'caution',
      label:     'Optimal flow, cold water',
      detail:    `${cfs} is right, but ${degF} water means slow fish. Best mid-day with deep nymphs.`,
    };
  }

  // Elevated / high with decent temps
  if (flowClass === 'elevated') {
    const tempNote = tempClass === 'ideal' ? ' Temperature ideal.' : '';
    return {
      category:  'current',
      sentiment: 'caution',
      label:     'Elevated flow',
      detail:    `${cfs} above optimal — fish slower water and eddy lines, careful wading.${tempNote}`,
    };
  }

  if (flowClass === 'high') {
    return {
      category:  'current',
      sentiment: 'negative',
      label:     'High water',
      detail:    `${cfs} well above optimal. Difficult wading — fish structure and bank water.`,
    };
  }

  if (flowClass === 'flood') {
    return {
      category:  'current',
      sentiment: 'negative',
      label:     'Flood conditions',
      detail:    `${cfs} — unsafe wading. Fish from bank only or postpone.`,
    };
  }

  // Low water
  if (flowClass === 'low' || flowClass === 'very_low') {
    const severity = flowClass === 'very_low' ? 'Very low' : 'Below optimal';
    const tempNote = tempClass === 'ideal' ? ' Temperature fine.' : '';
    return {
      category:  'current',
      sentiment: flowClass === 'very_low' ? 'negative' : 'caution',
      label:     `${severity} water`,
      detail:    `${cfs} — fish compressed into pools and deeper runs. Light tippet, slow approach.${tempNote}`,
    };
  }

  // Unknown flow but temperature is informative
  if (degF) {
    return {
      category:  'current',
      sentiment: tempClass === 'ideal' ? 'neutral' : 'caution',
      label:     tempClass === 'ideal' ? 'Temperature ideal' : 'Temperature marginal',
      detail:    `${degF} water — ${tempClass === 'ideal' ? 'prime trout range' : 'fish sluggish, adjust tactics'}.`,
    };
  }

  return {
    category:  'current',
    sentiment: 'neutral',
    label:     'Conditions data limited',
    detail:    'Gauge data unavailable — check USGS directly before heading out.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal 2: Outlook (dam release vs. gauge + trend, synthesized)
// ─────────────────────────────────────────────────────────────────────────────

function buildOutlookSignal(input: InterpreterInput): ConditionSignal {
  const { flow, trend, optimalMin, optimalMax, cwmsLocationKind, reservoirReleaseCfs } = input;

  const isDam = cwmsLocationKind === 'PROJECT' && reservoirReleaseCfs !== null && flow !== null && flow > 0;

  if (isDam) {
    const release = reservoirReleaseCfs!;
    const ratio   = release / flow!;
    const cfs     = Math.round(release);

    // Dam releasing far more than what gauge shows → strong rising pressure
    if (ratio >= 5) {
      return {
        category:  'outlook',
        sentiment: 'negative',
        label:     'Flows rising — act now',
        detail:    `Dam releasing ${cfs} CFS — far above the current gauge reading. Significantly higher water is on the way. This is a closing window.`,
      };
    }
    if (ratio >= 2) {
      return {
        category:  'outlook',
        sentiment: 'caution',
        label:     'Flows likely rising',
        detail:    `Dam releasing ${cfs} CFS — well above current gauge. Expect flows to increase over the next few hours.`,
      };
    }
    if (ratio >= 1.3) {
      return {
        category:  'outlook',
        sentiment: 'caution',
        label:     'Slight rise expected',
        detail:    `Dam releasing ${cfs} CFS — moderately above current gauge. Some increase possible; monitor through the day.`,
      };
    }
    if (ratio >= 0.7) {
      // Dam matching gauge → stable
      const flowClass = classifyFlow(flow, optimalMin, optimalMax);
      const stability = flowClass === 'optimal'
        ? 'Conditions should hold through the day.'
        : 'No significant change expected soon.';
      return {
        category:  'outlook',
        sentiment: flowClass === 'optimal' ? 'positive' : 'neutral',
        label:     'Dam holding steady',
        detail:    `Releasing ${cfs} CFS — closely matching current gauge. ${stability}`,
      };
    }
    // Dam releasing less than gauge → flows falling
    if (ratio < 0.7) {
      const flowClass = classifyFlow(flow, optimalMin, optimalMax);
      if (flowClass === 'high' || flowClass === 'elevated' || flowClass === 'flood') {
        return {
          category:  'outlook',
          sentiment: 'neutral',
          label:     'Flows dropping — improving',
          detail:    `Dam releasing ${cfs} CFS — below current gauge. High water is receding. Watch for conditions to enter optimal range.`,
        };
      }
      if (flowClass === 'optimal') {
        return {
          category:  'outlook',
          sentiment: 'caution',
          label:     'Flows may drop further',
          detail:    `Dam releasing ${cfs} CFS — below current gauge. Flow may ease below optimal as the day progresses.`,
        };
      }
      return {
        category:  'outlook',
        sentiment: 'negative',
        label:     'Low releases — water dropping',
        detail:    `Dam releasing only ${cfs} CFS. Already-low water will continue falling.`,
      };
    }
  }

  // Non-dam river — use trend
  if (!trend || trend === 'unknown') {
    return {
      category:  'outlook',
      sentiment: 'neutral',
      label:     'Trend unknown',
      detail:    'No recent trend data — conditions may vary.',
    };
  }

  const flowClass = classifyFlow(flow, optimalMin, optimalMax);

  if (trend === 'stable') {
    if (flowClass === 'optimal') {
      return { category: 'outlook', sentiment: 'positive', label: 'Holding steady', detail: 'Flow stable in optimal range — consistent fishing expected through the day.' };
    }
    return { category: 'outlook', sentiment: 'neutral', label: 'Conditions stable', detail: 'No significant change expected in the near term.' };
  }

  if (trend === 'rising') {
    if (flowClass === 'optimal') {
      return { category: 'outlook', sentiment: 'caution', label: 'Rising — fish now', detail: 'In optimal range but rising. Best window is now, before flow climbs out of range.' };
    }
    if (flowClass === 'low' || flowClass === 'very_low') {
      return { category: 'outlook', sentiment: 'neutral', label: 'Rising — improving', detail: 'Flow increasing from low levels. Conditions may improve as river comes up.' };
    }
    return { category: 'outlook', sentiment: 'negative', label: 'Rising — worsening', detail: 'Flow increasing from already-high levels — conditions deteriorating.' };
  }

  // falling
  if (flowClass === 'high' || flowClass === 'elevated' || flowClass === 'flood') {
    return { category: 'outlook', sentiment: 'neutral', label: 'Falling — improving', detail: 'High water dropping. Watch for conditions to enter optimal range.' };
  }
  if (flowClass === 'optimal') {
    return { category: 'outlook', sentiment: 'positive', label: 'Settling into shape', detail: 'Dropping into optimal range. Good window opening and likely extending.' };
  }
  return { category: 'outlook', sentiment: 'caution', label: 'Falling — going low', detail: 'Flow dropping below optimal. Fishing window narrowing.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal 3: Wading safety (only emitted when extreme)
// ─────────────────────────────────────────────────────────────────────────────

function buildWadingSignal(input: InterpreterInput): ConditionSignal | null {
  const { flow, optimalMax } = input;
  if (flow === null || optimalMax === null) return null;
  const ratio = flow / optimalMax;
  if (ratio > 2.0) {
    return {
      category:  'safety',
      sentiment: 'negative',
      label:     'Wading unsafe',
      detail:    `${Math.round(flow)} CFS — significantly above safe wading threshold. Bank fishing only.`,
    };
  }
  if (ratio > 1.6) {
    return {
      category:  'safety',
      sentiment: 'caution',
      label:     'Difficult wading',
      detail:    `${Math.round(flow)} CFS — use a wading staff, avoid mid-river crossings.`,
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rating (holistic — not additive)
// ─────────────────────────────────────────────────────────────────────────────

function computeRating(
  currentSentiment: SignalSentiment,
  outlookSentiment: SignalSentiment,
  temperature: number | null
): ConditionRating {
  if (temperature !== null && temperature > 70) return 'warning';

  const score = (s: SignalSentiment) =>
    s === 'positive' ? 2 : s === 'neutral' ? 1 : s === 'caution' ? 0 : -1;

  const total = score(currentSentiment) + score(outlookSentiment);

  if (total >= 4)  return 'excellent';
  if (total >= 2)  return 'good';
  if (total >= 0)  return 'fair';
  if (total >= -1) return 'poor';
  return 'poor';
}

// ─────────────────────────────────────────────────────────────────────────────
// Headline — written to reflect the synthesis, not just the rating
// ─────────────────────────────────────────────────────────────────────────────

function computeHeadline(
  rating: ConditionRating,
  currentSentiment: SignalSentiment,
  outlookSentiment: SignalSentiment,
  status: RiverStatus | null,
  temperature: number | null
): string {
  if (temperature !== null && temperature > 70) return 'Warm water advisory — fish early morning only';

  // Great now, bad outlook → closing window
  if (currentSentiment === 'positive' && outlookSentiment === 'negative') {
    return 'Fishing well now — window closing, act soon';
  }
  if (currentSentiment === 'positive' && outlookSentiment === 'caution') {
    return 'Good conditions now — some rise expected, fish earlier in the day';
  }
  if (currentSentiment === 'positive' && outlookSentiment === 'positive') {
    return 'Prime conditions — stable and holding';
  }
  if (currentSentiment === 'positive' && outlookSentiment === 'neutral') {
    return 'Fishing well — conditions expected to hold';
  }

  // Improving
  if ((currentSentiment === 'negative' || currentSentiment === 'caution') && outlookSentiment === 'neutral') {
    if (status === 'high' || status === 'elevated') return 'High water receding — conditions improving';
    if (status === 'low')                           return 'Low water rising — watch for improvement';
  }

  if (rating === 'excellent') return 'Prime conditions — fish all day';
  if (rating === 'good')      return 'Good conditions — worth the trip';
  if (rating === 'fair')      return 'Mixed conditions — adapt your approach';
  if (rating === 'poor')      return 'Tough conditions — adjust expectations';
  return 'Check conditions before heading out';
}

// ─────────────────────────────────────────────────────────────────────────────
// Action tip — single most useful piece of tactical advice
// ─────────────────────────────────────────────────────────────────────────────

function computeActionTip(
  currentSentiment: SignalSentiment,
  outlookSentiment: SignalSentiment,
  status: RiverStatus | null,
  trend: FlowTrend | null,
  temperature: number | null,
  isDamRiver: boolean,
  damRatio: number | null
): string {
  if (temperature !== null && temperature > 70) {
    return 'Wet your hands before handling fish, minimize fight time, and keep them in the water for release.';
  }
  if (temperature !== null && temperature > 65) {
    return 'Target early morning — fish shaded runs and spring-fed sections as temps rise through the day.';
  }

  // Good now, rising dam pressure → urgency
  if (currentSentiment === 'positive' && outlookSentiment === 'negative' && isDamRiver && damRatio !== null && damRatio >= 5) {
    return 'Get on the water now — work riffles and runs while they are at optimal depth. Flows will push fish to the edges as water rises.';
  }
  if (currentSentiment === 'positive' && outlookSentiment === 'caution' && isDamRiver) {
    return 'Fish the riffles and pocket water while conditions are prime. Move to eddy lines and slower water if flow increases through the day.';
  }

  if (status === 'optimal') {
    if (trend === 'stable') return 'Fish all water types — riffles, seams, and pocket water. All techniques viable; match the hatch or work subsurface.';
    if (trend === 'rising') return 'Fish now — riffles and runs before rising water pushes fish to the edges.';
    if (trend === 'falling') return 'Expanding window — fish the riffles as they come into shape. Nymphs or dries depending on hatch activity.';
  }

  if (status === 'elevated') {
    return 'Focus on slack water, eddy lines, and seams behind structure. Larger, visible flies or heavy nymphs close to the bottom.';
  }
  if (status === 'high' || status === 'ice_affected') {
    return 'Fish from the bank — streamers and large nymphs in slack water behind boulders and points. Short-line nymphing near structure.';
  }
  if (status === 'low') {
    return 'Light tippet, small flies, long leaders. Fish pools and deep runs — approach slowly, stay low, and work upstream.';
  }

  return 'Assess conditions at the water before committing — gauge readings can lag behind real-time river behavior.';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export function interpretConditions(input: InterpreterInput): ConditionsInterpretation {
  const { flow, temperature, status, trend, cwmsLocationKind, reservoirReleaseCfs } = input;

  const currentSignal = buildCurrentSignal(input);
  const outlookSignal = buildOutlookSignal(input);
  const wadingSignal  = buildWadingSignal(input);

  const signals = [currentSignal, outlookSignal, wadingSignal].filter(Boolean) as ConditionSignal[];

  const isDamRiver = cwmsLocationKind === 'PROJECT' && reservoirReleaseCfs !== null && flow !== null && flow > 0;
  const damRatio   = isDamRiver ? reservoirReleaseCfs! / flow! : null;

  const rating    = computeRating(currentSignal.sentiment, outlookSignal.sentiment, temperature);
  const headline  = computeHeadline(rating, currentSignal.sentiment, outlookSignal.sentiment, status, temperature);
  const actionTip = computeActionTip(
    currentSignal.sentiment,
    outlookSignal.sentiment,
    status,
    trend ?? null,
    temperature,
    isDamRiver,
    damRatio
  );

  return { rating, headline, signals, actionTip };
}
