import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { FunnelScreen, FUNNEL_DAYS } from '../Funnel'
import * as stats from '../../api/stats'
import type { FunnelStep } from '../../api/stats'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/stats')

const step = (over: Partial<FunnelStep> & { key: FunnelStep['key']; label: string }): FunnelStep => ({
  source: 'pageview', visitors: 0, notTracked: false, hint: null, note: null,
  reachRate: 0, stepRate: 0, dropOff: 0, ...over,
})

const FUNNEL: stats.FunnelSiteResponse = {
  since: '2026-07-19', until: '2026-07-25', rangeDays: 7, mode: 'site',
  steps: [
    step({ key: 'view', label: 'Landed', source: 'pageview', visitors: 12400, reachRate: 100, stepRate: 100, dropOff: null }),
    step({ key: 'product', label: 'Product page', source: 'product_view', visitors: 7100, reachRate: 57.3, stepRate: 57.3, dropOff: 42.7 }),
    step({ key: 'cart', label: 'Added to cart', source: 'add_to_cart', visitors: 2100, reachRate: 16.9, stepRate: 29.6, dropOff: 70.4 }),
    step({ key: 'checkout', label: 'Checkout', source: 'not tracked', visitors: null, notTracked: true, hint: 'Enable checkout tracking in the pixel', reachRate: null, stepRate: null, dropOff: null }),
    step({ key: 'purchase', label: 'Purchased', source: 'purchase', visitors: 640, reachRate: 5.2, stepRate: 30.5, dropOff: 69.5 }),
  ],
}

let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  ;(stats.fetchFunnel as jest.Mock).mockResolvedValue(FUNNEL)
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
  return render(<QueryClientProvider client={qc}><FunnelScreen /></QueryClientProvider>)
}

test('queries an inclusive 7-day window', async () => {
  await renderScreen()
  await waitFor(() => expect(stats.fetchFunnel).toHaveBeenCalled())

  const range = (stats.fetchFunnel as jest.Mock).mock.calls[0][0]
  expect(Object.keys(range).sort()).toEqual(['from', 'to'])
  expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(FUNNEL_DAYS).toBe(7)
})

test('stat tiles read entry, purchase, reach and the biggest drop', async () => {
  const { getByText, getAllByText } = await renderScreen()
  await waitFor(() => expect(getByText('Entered')).toBeTruthy())

  // Entry and purchase counts appear twice each — once in a tile, once in the
  // step list below it.
  expect(getAllByText('12.4k').length).toBe(2)
  expect(getAllByText('640').length).toBe(2)
  expect(getByText('5.2%')).toBeTruthy()
  expect(getByText('−70%')).toBeTruthy()   // cart, the worst tracked drop
  expect(getByText('at Added to cart')).toBeTruthy()
})

test('each step renders its reach bar percentage and drop', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Conversion funnel')).toBeTruthy())

  expect(getByText('Landed')).toBeTruthy()
  expect(getByText('57%')).toBeTruthy()
  expect(getByText('−42.7%')).toBeTruthy()
  expect(getByText('7.1k')).toBeTruthy()
})

test('an untracked step reads as a gap with its hint, not a zero', async () => {
  const { getByText, getAllByText } = await renderScreen()
  await waitFor(() => expect(getByText('Checkout')).toBeTruthy())

  expect(getByText('Enable checkout tracking in the pixel')).toBeTruthy()
  // Value and reach both fall back to an em dash for that step.
  expect(getAllByText('—').length).toBe(2)
})

test('shows an empty state when the window has no steps', async () => {
  ;(stats.fetchFunnel as jest.Mock).mockResolvedValue({ ...FUNNEL, steps: [] })
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('No funnel data for this window yet.')).toBeTruthy())
})

test('back returns to Home and errors render a retry card', async () => {
  ;(stats.fetchFunnel as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('Conversion funnel')).toBeTruthy())

  fireEvent.press(getByText('Home'))
  expect(router.back).toHaveBeenCalled()
})
