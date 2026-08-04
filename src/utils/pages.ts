import type { PageBehaviorResponse } from '../api/stats'
import { duration } from './format'
import { percentChange } from './tracking'

export type PageTypeRow = PageBehaviorResponse['pages'][number]

// The endpoint reports avgMs per page type but no site-wide average, so this
// weights each type's average by the views it actually timed. Null when
// nothing was timed at all.
export function overallAvgMs(pages: PageTypeRow[]): number | null {
  const timed = pages.filter((p) => p.avgMs !== null && p.timedViews > 0)
  if (timed.length === 0) return null
  const views = timed.reduce((sum, p) => sum + p.timedViews, 0)
  if (views === 0) return null
  return timed.reduce((sum, p) => sum + (p.avgMs as number) * p.timedViews, 0) / views
}

// Where shoppers linger longest — only page types with a measured average
// can win, so an untimed type never takes the title by default.
export function longestPageType(pages: PageTypeRow[]): PageTypeRow | null {
  return pages.reduce<PageTypeRow | null>((best, p) => {
    if (p.avgMs === null || p.timedViews === 0) return best
    return !best || p.avgMs > (best.avgMs as number) ? p : best
  }, null)
}

// One line about the window, built only from fields the endpoint returned.
// Each clause drops out independently, and with nothing to say it's null.
export function behaviorSummary(data: PageBehaviorResponse, days: number): string | null {
  const parts: string[] = []
  const previous = data.totals.previous
  const change = previous ? percentChange(data.totals.views, previous.views) : null

  if (change !== null && Math.abs(change) >= 0.5) {
    parts.push(`Page views are ${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(0)}% on the previous ${days} days.`)
  }

  const longest = longestPageType(data.pages)
  if (longest) {
    parts.push(`Shoppers linger longest on ${longest.pageType} pages (${duration(longest.avgMs)}).`)
  }

  return parts.length === 0 ? null : parts.join(' ')
}
