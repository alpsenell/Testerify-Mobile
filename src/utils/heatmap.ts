import type { HeatmapPageListResponse } from '../api/stats'

export type HeatmapPage = HeatmapPageListResponse['pages'][number]

const DEVICE_LABEL: Record<string, string> = {
  desktop: 'desktop', mobile: 'mobile', tablet: 'tablet', unknown: 'unknown',
}

// "58% desktop · 42% mobile" — the two biggest device shares of a page's
// clicks. Devices with no clicks are left out entirely rather than padding the
// line with zeroes.
export function deviceSplit(page: HeatmapPage): string {
  const total = Object.values(page.byDevice).reduce((sum, n) => sum + n, 0)
  if (total === 0) return 'no device data'
  return Object.entries(page.byDevice)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([device, n]) => `${Math.round(n / total * 100)}% ${DEVICE_LABEL[device] ?? device}`)
    .join(' · ')
}

// Rage and dead clicks are the two frustration signals the endpoint reports;
// null when a page has neither, so the caller can skip the chip.
export function frustration(page: HeatmapPage): string | null {
  const parts: string[] = []
  if (page.rage > 0) parts.push(`${page.rage} rage`)
  if (page.dead > 0) parts.push(`${page.dead} dead`)
  return parts.length === 0 ? null : parts.join(' · ')
}

export const totalClicks = (pages: HeatmapPage[]) => pages.reduce((sum, p) => sum + p.total, 0)

// A page's share of all clicks the heatmap ranking covers.
export const clickShare = (page: HeatmapPage, total: number) =>
  total === 0 ? 0 : page.total / total * 100
