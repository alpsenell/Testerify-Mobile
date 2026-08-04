import type { UtmSummaryResponse } from '../api/stats'

export type UtmDimension = 'source' | 'medium' | 'campaign'

export const UTM_DIMENSIONS: { key: UtmDimension; label: string }[] = [
  { key: 'source', label: 'Source' },
  { key: 'medium', label: 'Medium' },
  { key: 'campaign', label: 'Campaign' },
]

// Period-over-period change, in percent. Null when the previous period is
// zero — "up ∞%" is not a fact worth rendering.
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return (current - previous) / previous * 100
}

// The one-line read on the window, assembled from real fields only. Each
// clause is dropped when the field behind it is missing, so the line can end
// up as a single sentence — or, with nothing to say, null.
export function trackingSummary(data: UtmSummaryResponse, days: number): string | null {
  const parts: string[] = []
  const change = percentChange(data.summary.taggedVisits, data.summary.previous.taggedVisits)

  if (change !== null && Math.abs(change) >= 0.5) {
    parts.push(`Tagged visits are ${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(0)}% on the previous ${days} days.`)
  }

  const top = data.breakdown[0]
  if (top) {
    parts.push(`${top.value} drove ${top.share.toFixed(0)}% of tagged visits.`)
  }

  return parts.length === 0 ? null : parts.join(' ')
}
