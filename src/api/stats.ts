import { apiFetch } from './client'

// ===== Live (§1) =====
export type LiveStatsResponse = {
  generatedAt: string
  window: 'today'
  activeWindowMinutes: number
  summary: {
    totalToday: number
    activeNow: number
    pageviews: number
    countries: number
  }
  locations: Array<{
    country: string | null
    region: string | null
    city: string | null
    lat: number | null
    lng: number | null
    visitors: number
    active: number
    lastSeen: string
    approx: boolean
  }>
  countries: Array<{ country: string; visitors: number }>
}

export const fetchLive = () => apiFetch<LiveStatsResponse>('/api/stats/live')

// ===== Funnel (§3) =====
export type FunnelStep = {
  key: 'view' | 'product' | 'cart' | 'checkout' | 'purchase'
  label: string
  source: string
  visitors: number | null
  notTracked: boolean
  hint: string | null
  note: string | null
  reachRate: number | null
  stepRate: number | null
  dropOff: number | null
}

export type FunnelSiteResponse = {
  since: string
  until: string
  rangeDays: number
  mode: 'site'
  steps: FunnelStep[]
}

export const fetchFunnel = (args: { from: string; to: string }) => {
  const params = new URLSearchParams({ from: args.from, to: args.to })
  return apiFetch<FunnelSiteResponse>(`/api/stats/funnel?${params}`)
}

// ===== Heatmap (§4) =====
export type HeatmapPageListResponse = {
  origin: string | null
  minClicks: number
  hiddenCount: number
  pages: Array<{
    path: string
    total: number
    rage: number
    dead: number
    byDevice: { desktop: number; mobile: number; tablet: number; unknown: number }
  }>
}

export const fetchHeatmap = () => apiFetch<HeatmapPageListResponse>('/api/stats/heatmap')

// ===== UTM (§5) =====
export type UtmSummaryResponse = {
  dimension: 'source' | 'medium' | 'campaign'
  days: number
  summary: {
    taggedVisits: number
    uniqueVisitors: number
    topSource: string | null
    distinctSources: number
    previous: { taggedVisits: number; uniqueVisitors: number }
  }
  breakdown: Array<{ value: string; visits: number; visitors: number; share: number }>
  trend: Array<{ date: string; visits: number }>
}

export const fetchUtm = (args: { dimension?: string; from?: string; to?: string; preset?: number } = {}) => {
  const params = new URLSearchParams()
  if (args.dimension) params.set('dimension', args.dimension)
  if (args.from) params.set('from', args.from)
  if (args.to) params.set('to', args.to)
  if (args.preset) params.set('preset', String(args.preset))
  const qs = params.toString()
  return apiFetch<UtmSummaryResponse>(`/api/stats/utm${qs ? `?${qs}` : ''}`)
}

// ===== UTM Detail (§5) =====
export type UtmDetailResponse = {
  dimension: string
  value: string
  days: number
  headline: {
    visits: number
    visitors: number
    avgDurationMs: number | null
    share: number
    previous: { visits: number; visitors: number }
  }
  trend: Array<{ date: string; visits: number }>
  subBreakdowns: Array<{ key: string; label: string; rows: Array<{ value: string; visits: number; visitors: number; share: number }> }>
  topPaths: Array<{ value: string; visits: number; share: number }>
  topCountries: Array<{ value: string; visits: number; share: number }>
}

export const fetchUtmDetail = (args: { dimension: string; value: string; from?: string; to?: string; preset?: number }) => {
  const params = new URLSearchParams({ dimension: args.dimension, value: args.value })
  if (args.from) params.set('from', args.from)
  if (args.to) params.set('to', args.to)
  if (args.preset) params.set('preset', String(args.preset))
  return apiFetch<UtmDetailResponse>(`/api/stats/utm-detail?${params}`)
}

// ===== Products (§6) =====
export type ProductsResponse = {
  since: string
  until: string
  tracked: { view: boolean; add: boolean; checkout: boolean; purchase: boolean }
  currency: { code: string | null; mixed: boolean }
  totals: {
    views: number
    viewers: number
    adders: number
    purchasers: number
    units: number
    revenue: number
    addRate: number | null
    conversionRate: number | null
  }
  products: Array<{
    productId: string | null
    handle: string | null
    title: string
    image: string | null
    price: number | null
    views: number
    viewers: number
    adders: number
    checkouters: number
    purchasers: number
    units: number
    revenue: number
    addRate: number | null
    checkoutRate: number | null
    conversionRate: number | null
  }>
}

export const fetchProducts = (args: { from?: string; to?: string; preset?: number } = {}) => {
  const params = new URLSearchParams()
  if (args.from) params.set('from', args.from)
  if (args.to) params.set('to', args.to)
  if (args.preset) params.set('preset', String(args.preset))
  const qs = params.toString()
  return apiFetch<ProductsResponse>(`/api/stats/products${qs ? `?${qs}` : ''}`)
}

// ===== Product Detail (§6) =====
export type ProductDetailResponse = {
  since: string
  until: string
  product: { productId: string | null; handle: string | null; title: string; image: string | null; price: number | null; path: string | null }
  tracked: { view: boolean; add: boolean; checkout: boolean; purchase: boolean }
  currency: { code: string | null; mixed: boolean }
  headline: { views: number; viewers: number; adders: number; checkouters: number; purchasers: number; units: number; revenue: number; conversionRate: number | null }
  funnel: FunnelStep[]
  trend: { labels: string[]; views: number[]; purchases: number[] }
  variants: Array<{ variantId: string | null; variantTitle: string; units: number; revenue: number; share: number | null }>
}

export const fetchProductDetail = (args: { product: string; from?: string; to?: string; preset?: number }) => {
  const params = new URLSearchParams({ product: args.product })
  if (args.from) params.set('from', args.from)
  if (args.to) params.set('to', args.to)
  if (args.preset) params.set('preset', String(args.preset))
  return apiFetch<ProductDetailResponse>(`/api/stats/product-detail?${params}`)
}

// ===== Page Behavior (§7) =====
export type PageBehaviorResponse = {
  rangeDays: number
  since: string
  until: string
  totals: {
    views: number
    visitors: number
    timedViews: number
    previous?: { views: number; visitors: number; avgMs: number | null }
  }
  pages: Array<{ pageType: string; views: number; visitors: number; avgMs: number | null; medianMs: number | null; timedViews: number; share: number }>
  funnel: { product: number; cart: number; checkout: number; productToCart: number; cartToCheckout: number }
  trend?: Array<{ date: string; views: number; visitors: number }>
  topPaths?: Array<{ path: string; views: number; avgMs: number | null }>
  pageType?: string | null
}

export const fetchPageBehavior = (args: { from?: string; to?: string; preset?: number; days?: number; pageType?: string } = {}) => {
  const params = new URLSearchParams()
  if (args.from) params.set('from', args.from)
  if (args.to) params.set('to', args.to)
  if (args.preset) params.set('preset', String(args.preset))
  if (args.days) params.set('days', String(args.days))
  if (args.pageType) params.set('pageType', args.pageType)
  const qs = params.toString()
  return apiFetch<PageBehaviorResponse>(`/api/stats/page-behavior${qs ? `?${qs}` : ''}`)
}

// ===== Custom Events (§8) =====
export type EventStat = {
  name: string
  total: number
  visitors: number
  lastFired: string | null
  firstFired: string | null
  campaignCount: number
  campaigns: Array<{
    campaignId: string
    name: string
    count: number
    visitors: number
    lastFired: string | null
    variants: Array<{ variantId: string; name: string; isControl: boolean; count: number; visitors: number }>
  }>
  siteWide: { count: number; visitors: number; lastFired: string | null } | null
  devices: Array<{ device: string; count: number }>
  countries: Array<{ country: string; count: number }>
  samples: Array<{ metadata: Record<string, unknown>; createdAt: string | null; campaignId: string | null; device: string | null; country: string | null }>
}

export type CustomEventsResponse = {
  events: EventStat[]
  totalVisitors: number
}

export const fetchCustomEvents = (args: { from?: string; to?: string; view?: string } = {}) => {
  const params = new URLSearchParams()
  if (args.from) params.set('from', args.from)
  if (args.to) params.set('to', args.to)
  if (args.view) params.set('view', args.view)
  const qs = params.toString()
  return apiFetch<CustomEventsResponse>(`/api/stats/custom-events${qs ? `?${qs}` : ''}`)
}

// ===== Impact — estimated added revenue from shipped winners =====
export type ImpactResponse = {
  totalImpact: number
  currency: { code: string | null; mixed: boolean }
  campaigns: Array<{
    id: string
    name: string
    promotedAt: string | null
    upliftPct?: number | null
    impact: number
  }>
}

export const fetchImpact = () => apiFetch<ImpactResponse>('/api/stats/impact')

// ===== Segment breakdown (control vs challenger by audience slice) =====
export type SegmentDimension = 'device' | 'country' | 'utm_source' | 'returning'

export type SegmentArm = { impressions: number; conversions: number; revenue: number; rate: number }

export type SegmentRow = {
  value: string
  label: string
  control: SegmentArm
  challenger: SegmentArm
  uplift: number
  confidence: number
  status: string
  sequential: { pValue: number; decision: string; diffCI: unknown }
  enoughData: boolean
  controlRpv: number | null
  variantRpv: number | null
  impressions: number
}

export type SegmentResponse = {
  dimension: SegmentDimension
  controlId: string | null
  challengerId: string | null
  truncated: number
  rows: SegmentRow[]
}

export const fetchSegment = (campaignId: string, dimension: SegmentDimension) => {
  const params = new URLSearchParams({ campaignId, dimension })
  return apiFetch<SegmentResponse>(`/api/stats/segment?${params}`)
}

// ===== Replays (§9) — 402 Plan-gated on Free/Growth (Scale-tier feature) =====
export type ReplayListResponse = {
  origin: string | null
  sessions: Array<{
    sessionId: string
    visitorId: string
    device: string | null
    entryPath: string | null
    startedAt: string
    durationMs: number
    eventCount: number
    pageCount: number
    trigger: 'rage' | 'dead' | null
    triggerPath: string | null
    rageCount: number
    deadCount: number
    campaignName: string | null
  }>
  limit: number
  total: number
  totalEvents: number
  avgDurationMs: number
}

export const fetchReplays = (args: { trigger?: string; path?: string } = {}) => {
  const params = new URLSearchParams()
  if (args.trigger) params.set('trigger', args.trigger)
  if (args.path) params.set('path', args.path)
  const qs = params.toString()
  return apiFetch<ReplayListResponse>(`/api/public/replay${qs ? `?${qs}` : ''}`)
}
