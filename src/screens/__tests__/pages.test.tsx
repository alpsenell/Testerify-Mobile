import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { PagesScreen, PAGES_DAYS } from '../Pages'
import * as stats from '../../api/stats'
import * as ai from '../../api/ai'
import { ApiError } from '../../api/client'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/stats')
jest.mock('../../api/ai')

const BEHAVIOR: stats.PageBehaviorResponse = {
  rangeDays: 7, since: '2026-07-19', until: '2026-07-25',
  totals: { views: 21_800, visitors: 14_200, timedViews: 18_000, previous: { views: 20_000, visitors: 13_000, avgMs: 40_000 } },
  pages: [
    { pageType: 'Product', views: 11_600, visitors: 9_000, avgMs: 72_000, medianMs: 60_000, timedViews: 10_000, share: 53.2 },
    { pageType: 'Collection', views: 6_000, visitors: 4_400, avgMs: 30_000, medianMs: 22_000, timedViews: 5_000, share: 27.5 },
  ],
  funnel: { product: 11_600, cart: 2_400, checkout: 1_000, productToCart: 20.7, cartToCheckout: 41.7 },
  topPaths: [
    { path: '/products/amber-candle', views: 3_200, avgMs: 84_000 },
    { path: '/collections/all', views: 2_100, avgMs: 26_000 },
  ],
}

const SCOPED: stats.PageBehaviorResponse = {
  ...BEHAVIOR, pageType: 'Product',
  topPaths: [{ path: '/products/linen-throw', views: 900, avgMs: 91_000 }],
}

const INSIGHTS: ai.AiInsightsResponse = {
  behavior: BEHAVIOR,
  summary: 'Product pages hold attention but the cart loses three in four visitors.',
  insights: [
    { title: 'Cart is the leak', detail: 'Only 21% of product viewers reach the cart.', severity: 'high' },
    { title: 'Collections skim fast', detail: 'Average 30s suggests shoppers scan and bounce.', severity: 'medium' },
  ],
  ideas: [],
}

let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  ;(stats.fetchPageBehavior as jest.Mock).mockImplementation((args: { pageType?: string }) =>
    Promise.resolve(args?.pageType ? SCOPED : BEHAVIOR))
  ;(ai.fetchInsights as jest.Mock).mockResolvedValue(INSIGHTS)
})

afterEach(async () => {
  // See learnings.test.tsx — drain react-query's notification batch in act().
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
})

const renderScreen = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><PagesScreen /></QueryClientProvider>)
}

test('queries an inclusive 7-day window', async () => {
  await renderScreen()
  await waitFor(() => expect(stats.fetchPageBehavior).toHaveBeenCalled())

  const args = (stats.fetchPageBehavior as jest.Mock).mock.calls[0][0]
  expect(args.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(args.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(args.pageType).toBeUndefined()
  expect(PAGES_DAYS).toBe(7)
})

test('tiles cover views, visitors, weighted average time and the longest read', async () => {
  const { getByText, getAllByText } = await renderScreen()
  await waitFor(() => expect(getByText('Page views')).toBeTruthy())

  expect(getByText('21.8k')).toBeTruthy()
  // Views (+9.0%) and visitors (+9.2%) both round to +9% here.
  expect(getAllByText('+9% vs previous 7d').length).toBe(2)
  expect(getByText('14.2k')).toBeTruthy()
  expect(getByText('58s')).toBeTruthy()   // views-weighted across page types
  expect(getByText('18k timed views')).toBeTruthy()
  // 'Product' names the longest-read tile, the page-type row and the first
  // funnel node.
  expect(getAllByText('Product').length).toBe(3)
})

test('the summary line reads off real fields', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(
    getByText('Page views are up 9% on the previous 7 days. Shoppers linger longest on Product pages (1m 12s).'),
  ).toBeTruthy())
})

test('the mini funnel shows each stage and the step rates', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Conversion funnel')).toBeTruthy())

  expect(getByText('11.6k')).toBeTruthy()
  expect(getByText('2.4k')).toBeTruthy()
  expect(getByText('21% →')).toBeTruthy()
  expect(getByText('42% →')).toBeTruthy()
})

test('tapping a page type scopes the top-paths table and clears again', async () => {
  const { getByText, queryByText, getAllByText } = await renderScreen()
  await waitFor(() => expect(getByText('/products/amber-candle')).toBeTruthy())

  fireEvent.press(getAllByText('Product')[1])
  await waitFor(() => expect(getByText('/products/linen-throw')).toBeTruthy())
  expect(queryByText('/products/amber-candle')).toBeNull()
  expect((stats.fetchPageBehavior as jest.Mock).mock.calls.at(-1)[0].pageType).toBe('Product')

  fireEvent.press(getByText('Product · Clear'))
  await waitFor(() => expect(getByText('/products/amber-candle')).toBeTruthy())
})

test('AI insight starts idle, then renders the summary and its items', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Tap Analyze to turn shopper time-on-page into insights.')).toBeTruthy())

  fireEvent.press(getByText('Analyze'))
  await waitFor(() => expect(getByText(INSIGHTS.summary)).toBeTruthy())

  expect(getByText('Cart is the leak')).toBeTruthy()
  expect(getByText('Only 21% of product viewers reach the cart.')).toBeTruthy()
  expect(getByText('Analyze again')).toBeTruthy()
})

test('a plan-gated insight call shows an upgrade note, not a retry loop', async () => {
  ;(ai.fetchInsights as jest.Mock).mockRejectedValueOnce(new ApiError(402, { error: 'Upgrade required' }))
  const { getByText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('Analyze')).toBeTruthy())

  fireEvent.press(getByText('Analyze'))
  await waitFor(() => expect(getByText(/part of the Growth plan/)).toBeTruthy())
  expect(queryByText('Retry')).toBeNull()
})

test('an ordinary insight failure offers a retry', async () => {
  ;(ai.fetchInsights as jest.Mock).mockRejectedValueOnce(new ApiError(500, { error: 'boom' }))
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Analyze')).toBeTruthy())

  fireEvent.press(getByText('Analyze'))
  await waitFor(() => expect(getByText('Retry')).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText(INSIGHTS.summary)).toBeTruthy())
})

test('back returns to Home and a failed load renders a retry card', async () => {
  ;(stats.fetchPageBehavior as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('By page type')).toBeTruthy())

  fireEvent.press(getByText('Home'))
  expect(router.back).toHaveBeenCalled()
})
