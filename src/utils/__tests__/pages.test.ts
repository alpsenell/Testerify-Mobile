import type { PageBehaviorResponse } from '../../api/stats'
import { ApiError } from '../../api/client'
import { behaviorSummary, longestPageType, overallAvgMs } from '../pages'
import type { PageTypeRow } from '../pages'
import { isPlanGated } from '../planGate'

const row = (over: Partial<PageTypeRow> & { pageType: string }): PageTypeRow => ({
  views: 100, visitors: 80, avgMs: 30_000, medianMs: 25_000, timedViews: 100, share: 10, ...over,
})

const data = (over: Partial<PageBehaviorResponse> = {}): PageBehaviorResponse => ({
  rangeDays: 7, since: '2026-07-19', until: '2026-07-25',
  totals: { views: 21_800, visitors: 14_200, timedViews: 18_000, previous: { views: 20_000, visitors: 13_000, avgMs: 40_000 } },
  pages: [
    row({ pageType: 'Product', views: 11_600, avgMs: 72_000, timedViews: 10_000 }),
    row({ pageType: 'Collection', views: 6_000, avgMs: 30_000, timedViews: 5_000 }),
  ],
  funnel: { product: 11_600, cart: 2_400, checkout: 1_000, productToCart: 20.7, cartToCheckout: 41.7 },
  ...over,
})

test('overall average time weights each page type by its timed views', () => {
  // (72000*10000 + 30000*5000) / 15000 = 58000
  expect(overallAvgMs(data().pages)).toBe(58_000)
})

test('overall average ignores untimed page types and returns null with nothing timed', () => {
  expect(overallAvgMs([row({ pageType: 'A', avgMs: 10_000, timedViews: 10 }), row({ pageType: 'B', avgMs: null, timedViews: 0 })]))
    .toBe(10_000)
  expect(overallAvgMs([row({ pageType: 'B', avgMs: null, timedViews: 0 })])).toBeNull()
  expect(overallAvgMs([])).toBeNull()
})

test('longest page type only considers measured types', () => {
  expect(longestPageType(data().pages)?.pageType).toBe('Product')
  expect(longestPageType([row({ pageType: 'Untimed', avgMs: null, timedViews: 0 })])).toBeNull()
})

test('summary reports the view trend and where shoppers linger', () => {
  expect(behaviorSummary(data(), 7)).toBe(
    'Page views are up 9% on the previous 7 days. Shoppers linger longest on Product pages (1m 12s).',
  )
})

test('summary drops the trend clause when the endpoint sends no previous period', () => {
  const d = data()
  delete d.totals.previous
  expect(behaviorSummary(d, 7)).toBe('Shoppers linger longest on Product pages (1m 12s).')
})

test('summary is null when nothing real can be said', () => {
  const d = data({ pages: [] })
  delete d.totals.previous
  expect(behaviorSummary(d, 7)).toBeNull()
})

describe('isPlanGated', () => {
  test('recognises a 402 and the PLAN_LIMIT_REACHED code', () => {
    expect(isPlanGated(new ApiError(402, { error: 'Upgrade required' }))).toBe(true)
    expect(isPlanGated(new ApiError(403, { code: 'PLAN_LIMIT_REACHED' }))).toBe(true)
  })

  test('ordinary failures are not plan gates', () => {
    expect(isPlanGated(new ApiError(500, { error: 'boom' }))).toBe(false)
    expect(isPlanGated(new ApiError(0, null))).toBe(false)
    expect(isPlanGated(new Error('network'))).toBe(false)
    expect(isPlanGated(null)).toBe(false)
  })
})
