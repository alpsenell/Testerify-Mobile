import type { FunnelStep } from '../api/stats'

// A step the store isn't tracking has no visitor count — it renders as a gap
// in the funnel rather than as a zero, which would read as "nobody got here".
export const isTracked = (s: FunnelStep) => !s.notTracked && s.visitors !== null

// The step that loses the most people relative to the one before it. Only
// tracked steps can own a drop; the first step has nothing to drop from.
export function biggestDrop(steps: FunnelStep[]): FunnelStep | null {
  return steps.reduce<FunnelStep | null>((worst, s) => {
    if (!isTracked(s) || s.dropOff === null) return worst
    return !worst || s.dropOff > (worst.dropOff ?? 0) ? s : worst
  }, null)
}

export const stepByKey = (steps: FunnelStep[], key: FunnelStep['key']) =>
  steps.find((s) => s.key === key) ?? null
