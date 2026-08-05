import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ProductDetailScreen } from '../ProductDetail'
import * as stats from '../../api/stats'
import type { FunnelStep } from '../../api/stats'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ product: 'amber-candle' }),
}))
jest.mock('../../api/stats')

const step = (over: Partial<FunnelStep> & { key: FunnelStep['key']; label: string }): FunnelStep => ({
  source: 'product_view', visitors: 0, notTracked: false, hint: null, note: null,
  reachRate: 0, stepRate: 0, dropOff: 0, ...over,
})

const DETAIL: stats.ProductDetailResponse = {
  since: '2026-07-19', until: '2026-07-25',
  product: { productId: 'p1', handle: 'amber-candle', title: 'Amber candle', image: null, price: 2400, path: '/products/amber-candle' },
  tracked: { view: true, add: true, checkout: true, purchase: true },
  currency: { code: 'USD', mixed: false },
  headline: { views: 1800, viewers: 1500, adders: 92, checkouters: 40, purchasers: 30, units: 32, revenue: 76800, conversionRate: 1.7 },
  funnel: [
    step({ key: 'view', label: 'Viewed', visitors: 1800, reachRate: 100, stepRate: 100, dropOff: null }),
    step({ key: 'cart', label: 'Added to cart', source: 'add_to_cart', visitors: 90, reachRate: 5, stepRate: 5, dropOff: 95 }),
  ],
  trend: { labels: ['Jul 24', 'Jul 25'], views: [900, 900], purchases: [12, 20] },
  variants: [
    { variantId: 'v1', variantTitle: 'Large', units: 20, revenue: 48000, share: 62.5 },
    { variantId: 'v2', variantTitle: 'Small', units: 12, revenue: 28800, share: 37.5 },
  ],
}

let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  ;(stats.fetchProductDetail as jest.Mock).mockResolvedValue(DETAIL)
})

afterEach(async () => {
  // See learnings.test.tsx — drain react-query's notification batch in act().
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
})

const renderScreen = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><ProductDetailScreen /></QueryClientProvider>)
}

test('queries the route product over an inclusive 7-day window by default', async () => {
  await renderScreen()
  await waitFor(() => expect(stats.fetchProductDetail).toHaveBeenCalled())

  const args = (stats.fetchProductDetail as jest.Mock).mock.calls[0][0]
  expect(args.product).toBe('amber-candle')
  expect(args.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(args.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('headline tiles read views, adds, units and revenue in the store currency', async () => {
  const { getByText, getAllByText } = await renderScreen()
  await waitFor(() => expect(getByText('1.5k viewers')).toBeTruthy())

  expect(getByText('92')).toBeTruthy()
  expect(getByText('32')).toBeTruthy()
  expect(getByText('$76.8k')).toBeTruthy()
  expect(getByText('1.7% view → buy')).toBeTruthy()
  // Title appears in the shell header and the product header card.
  expect(getAllByText('Amber candle').length).toBe(2)
})

test('the product funnel renders each step with its drop', async () => {
  const { getByText, getAllByText } = await renderScreen()
  await waitFor(() => expect(getByText('Product funnel')).toBeTruthy())

  expect(getByText('Viewed')).toBeTruthy()
  // 'Added to cart' names both the tile and the funnel step.
  expect(getAllByText('Added to cart').length).toBeGreaterThanOrEqual(1)
  expect(getByText('−95.0%')).toBeTruthy()
})

test('variant rows show units and revenue', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('By variant')).toBeTruthy())

  expect(getByText('Large')).toBeTruthy()
  expect(getByText('20 sold · $48k')).toBeTruthy()
})

test('switching the range preset refetches over the new window', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Product funnel')).toBeTruthy())

  fireEvent.press(getByText('90d'))
  await waitFor(() => {
    const args = (stats.fetchProductDetail as jest.Mock).mock.calls.at(-1)[0]
    const span = Math.round((Date.parse(args.to) - Date.parse(args.from)) / 86_400_000) + 1
    expect(span).toBe(90)
  })
})

test('back returns to Products and errors render a retry card', async () => {
  ;(stats.fetchProductDetail as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('Product funnel')).toBeTruthy())

  fireEvent.press(getByText('Products'))
  expect(router.back).toHaveBeenCalled()
})
