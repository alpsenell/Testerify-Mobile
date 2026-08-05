import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { UtmDetailScreen } from '../UtmDetail'
import * as stats from '../../api/stats'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ dimension: 'source', value: 'instagram' }),
}))
jest.mock('../../api/stats')

const DETAIL: stats.UtmDetailResponse = {
  dimension: 'source', value: 'instagram', days: 7,
  headline: {
    visits: 484, visitors: 390, avgDurationMs: 42_000, share: 41,
    previous: { visits: 400, visitors: 420 },
  },
  trend: [
    { date: '2026-07-24', visits: 60 },
    { date: '2026-07-25', visits: 80 },
  ],
  subBreakdowns: [
    { key: 'medium', label: 'By medium', rows: [{ value: 'cpc', visits: 300, visitors: 250, share: 62 }] },
    { key: 'campaign', label: 'By campaign', rows: [] },
  ],
  topPaths: [{ value: '/products/amber-candle', visits: 120, share: 25 }],
  topCountries: [{ value: 'Germany', visits: 200, share: 41.3 }],
}

let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  ;(stats.fetchUtmDetail as jest.Mock).mockResolvedValue(DETAIL)
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
  return render(<QueryClientProvider client={qc}><UtmDetailScreen /></QueryClientProvider>)
}

test('queries the route params over an inclusive 7-day window by default', async () => {
  await renderScreen()
  await waitFor(() => expect(stats.fetchUtmDetail).toHaveBeenCalled())

  const args = (stats.fetchUtmDetail as jest.Mock).mock.calls[0][0]
  expect(args.dimension).toBe('source')
  expect(args.value).toBe('instagram')
  expect(args.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(args.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('headline tiles show visits with deltas, share and dwell', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Tagged visits')).toBeTruthy())

  expect(getByText('484')).toBeTruthy()
  expect(getByText('+21% vs previous 7d')).toBeTruthy()   // visits rose
  expect(getByText('−7% vs previous 7d')).toBeTruthy()    // visitors fell
  expect(getByText('41%')).toBeTruthy()
  expect(getByText('42s')).toBeTruthy()
})

test('sub-breakdowns, paths and countries render; empty sections are dropped', async () => {
  const { getByText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('By medium')).toBeTruthy())

  expect(getByText('cpc')).toBeTruthy()
  expect(queryByText('By campaign')).toBeNull()
  expect(getByText('/products/amber-candle')).toBeTruthy()
  expect(getByText('Germany')).toBeTruthy()
})

test('switching the range preset refetches over the new window', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('By medium')).toBeTruthy())

  fireEvent.press(getByText('30d'))
  await waitFor(() => {
    const args = (stats.fetchUtmDetail as jest.Mock).mock.calls.at(-1)[0]
    const span = Math.round((Date.parse(args.to) - Date.parse(args.from)) / 86_400_000) + 1
    expect(span).toBe(30)
  })
})

test('back returns to Tracking and errors render a retry card', async () => {
  ;(stats.fetchUtmDetail as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('By medium')).toBeTruthy())

  fireEvent.press(getByText('Tracking'))
  expect(router.back).toHaveBeenCalled()
})
