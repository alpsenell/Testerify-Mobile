import type { DateRange } from '../utils/range'

// Central query-key factory so mutations can invalidate precisely. The
// blunt qc.invalidateQueries() on pull-to-refresh stays — refreshing
// everything on an explicit pull is fine; surgical invalidation matters
// after mutations.
export const qk = {
  dashboard: () => ['dashboard'] as const,
  campaigns: () => ['campaigns'] as const,
  campaign: (id: string) => ['campaign', id] as const,
  suggestions: () => ['suggestions'] as const,
  live: () => ['live'] as const,
  funnel: (r: DateRange) => ['funnel', r.from, r.to] as const,
  heatmap: () => ['heatmap'] as const,
  utm: (dimension: string, r: DateRange) => ['utm', dimension, r.from, r.to] as const,
  utmDetail: (dimension: string, value: string, r: DateRange) => ['utm-detail', dimension, value, r.from, r.to] as const,
  products: (r: DateRange) => ['products', r.from, r.to] as const,
  productDetail: (product: string, r: DateRange) => ['product-detail', product, r.from, r.to] as const,
  pageBehavior: (r: DateRange, pageType?: string | null) =>
    pageType == null ? (['page-behavior', r.from, r.to] as const) : (['page-behavior', r.from, r.to, pageType] as const),
  customEvents: () => ['custom-events'] as const,
  replays: (trigger?: string | null) => ['replays', trigger ?? null] as const,
  flows: () => ['flows'] as const,
  company: () => ['company'] as const,
  members: () => ['members'] as const,
  invitations: () => ['invitations'] as const,
  impact: () => ['impact'] as const,
  segment: (campaignId: string, dimension: string) => ['segment', campaignId, dimension] as const,
  usage: () => ['usage'] as const,
  queue: () => ['queue'] as const,
  audiences: () => ['audiences'] as const,
  nudgeCatalog: () => ['nudge-catalog'] as const,
  alerts: () => ['alerts'] as const,
  stores: () => ['stores'] as const,
}
