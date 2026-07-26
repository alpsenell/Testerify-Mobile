import { render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { LiveScreen, REFETCH_MS } from '../Live'
import * as stats from '../../api/stats'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/stats')

const LIVE = {
  generatedAt: '2026-07-25T12:00:00Z',
  window: 'today' as const,
  activeWindowMinutes: 5,
  summary: { totalToday: 812, activeNow: 1834, pageviews: 5200, countries: 2 },
  locations: [
    {
      country: 'United States', region: 'California', city: 'San Francisco',
      lat: 37.7, lng: -122.4, visitors: 63, active: 41,
      lastSeen: '2026-07-25T11:58:00Z', approx: false,
    },
    {
      country: 'Germany', region: null, city: null,
      lat: null, lng: null, visitors: 12, active: 5,
      lastSeen: '2026-07-25T11:50:00Z', approx: true,
    },
  ],
  countries: [
    { country: 'United States', visitors: 63 },
    { country: 'Germany', visitors: 12 },
  ],
}

// Each test's QueryClient is tracked here so it can be torn down afterward —
// see the afterEach below (same rationale as tests.test.tsx: an unhandled
// gcTime/refetchInterval timer left on the cache keeps the Jest worker alive).
let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  ;(stats.fetchLive as jest.Mock).mockResolvedValue(LIVE)
})

afterEach(() => {
  currentQueryClient?.clear()
  currentQueryClient = undefined
})

const renderLive = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  currentQueryClient = qc
  return await render(<QueryClientProvider client={qc}><LiveScreen /></QueryClientProvider>)
}

test('exports a 15s poll interval', () => {
  expect(REFETCH_MS).toBe(15000)
})

test('renders the big on-site-now count, compact-formatted', async () => {
  const { getByText } = await renderLive()
  await waitFor(() => expect(getByText('1.8k')).toBeTruthy())
  expect(getByText('On site now')).toBeTruthy()
})

test('renders aggregate location rows from real fields', async () => {
  const { getByText } = await renderLive()
  await waitFor(() => expect(getByText('San Francisco')).toBeTruthy())
  expect(getByText('63 visitors · 41 active')).toBeTruthy()

  // Second row has no city/region — falls back to country.
  expect(getByText('Germany')).toBeTruthy()
  expect(getByText('12 visitors · 5 active')).toBeTruthy()
})

test('header back button returns to Home', async () => {
  const { getByText } = await renderLive()
  await waitFor(() => expect(getByText('Live')).toBeTruthy())
  fireEvent.press(getByText('Home'))
  expect(router.back).toHaveBeenCalled()
})

test('shows a retry card on error and recovers on retry', async () => {
  ;(stats.fetchLive as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderLive()
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('1.8k')).toBeTruthy())
})
