import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ProductsScreen, PRODUCTS_DAYS } from '../Products'
import * as stats from '../../api/stats'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/stats')

const PRODUCTS: stats.ProductsResponse = {
  since: '2026-07-19', until: '2026-07-25',
  tracked: { view: true, add: true, checkout: true, purchase: true },
  currency: { code: 'USD', mixed: false },
  totals: { views: 3000, viewers: 2400, adders: 260, purchasers: 120, units: 130, revenue: 300000, addRate: 10.8, conversionRate: 5 },
  products: [
    {
      productId: 'p1', handle: 'candle', title: 'Amber candle', image: null, price: 2400,
      views: 1800, viewers: 1500, adders: 90, checkouters: 40, purchasers: 30, units: 32, revenue: 76800,
      addRate: 5, checkoutRate: 2.2, conversionRate: 1.7,
    },
    {
      productId: 'p2', handle: 'throw-linen', title: 'Linen throw', image: null, price: 8900,
      views: 900, viewers: 700, adders: 120, checkouters: 100, purchasers: 90, units: 98, revenue: 223200,
      addRate: 13.3, checkoutRate: 11, conversionRate: 10,
    },
  ],
}

let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  ;(stats.fetchProducts as jest.Mock).mockResolvedValue(PRODUCTS)
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
  return render(<QueryClientProvider client={qc}><ProductsScreen /></QueryClientProvider>)
}

test('queries an inclusive 7-day window', async () => {
  await renderScreen()
  await waitFor(() => expect(stats.fetchProducts).toHaveBeenCalled())

  const args = (stats.fetchProducts as jest.Mock).mock.calls[0][0]
  expect(args.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(args.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(PRODUCTS_DAYS).toBe(7)
})

test('tiles summarise the window in the store currency', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Product views')).toBeTruthy())

  expect(getByText('3k')).toBeTruthy()
  expect(getByText('2.4k viewers')).toBeTruthy()
  expect(getByText('10.8%')).toBeTruthy()
  expect(getByText('130')).toBeTruthy()
  expect(getByText('$300k')).toBeTruthy()
})

test('product cards show the four-cell metric grid', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Amber candle')).toBeTruthy())

  expect(getByText('1.8k')).toBeTruthy()
  expect(getByText('$76.8k')).toBeTruthy()
  expect(getByText('98')).toBeTruthy()
})

test('the leaky badge is derived from views and conversion, not shown on every card', async () => {
  const { getByText, queryAllByText } = await renderScreen()
  // Amber candle: above-average views (1800 vs 1500), converts at 1.7% vs the
  // store's 5%. Linen throw converts above the store rate, so it stays clean.
  await waitFor(() => expect(getByText('High traffic · low conversion')).toBeTruthy())
  expect(queryAllByText('High traffic · low conversion').length).toBe(1)
})

test('search narrows the list and says when nothing matches', async () => {
  const { getByText, getByLabelText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('Amber candle')).toBeTruthy())

  fireEvent.changeText(getByLabelText('Search products…'), 'linen')
  await waitFor(() => expect(queryByText('Amber candle')).toBeNull())
  expect(getByText('Linen throw')).toBeTruthy()

  fireEvent.changeText(getByLabelText('Search products…'), 'zzz')
  await waitFor(() => expect(getByText('No products match.')).toBeTruthy())
})

test('mixed-currency windows drop the symbol rather than claiming one', async () => {
  ;(stats.fetchProducts as jest.Mock).mockResolvedValue({ ...PRODUCTS, currency: { code: 'USD', mixed: true } })
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('mixed currencies')).toBeTruthy())
  expect(getByText('300k')).toBeTruthy()
})

test('untracked add/purchase events say so instead of implying zero', async () => {
  ;(stats.fetchProducts as jest.Mock).mockResolvedValue({
    ...PRODUCTS, tracked: { view: true, add: false, checkout: false, purchase: false },
  })
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('add tracking off')).toBeTruthy())
  expect(getByText('purchase tracking off')).toBeTruthy()
})

test('shows an empty state when the window has no product activity', async () => {
  ;(stats.fetchProducts as jest.Mock).mockResolvedValue({ ...PRODUCTS, products: [] })
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('No product activity in this window yet.')).toBeTruthy())
})

test('back returns to Home and errors render a retry card', async () => {
  ;(stats.fetchProducts as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('Amber candle')).toBeTruthy())

  fireEvent.press(getByText('Home'))
  expect(router.back).toHaveBeenCalled()
})
