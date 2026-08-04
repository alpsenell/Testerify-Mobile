import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { TrackingScreen, TRACKING_DAYS } from '../Tracking'
import * as stats from '../../api/stats'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/stats')

const SOURCE: stats.UtmSummaryResponse = {
  dimension: 'source', days: 7,
  summary: {
    taggedVisits: 1180, uniqueVisitors: 940, topSource: 'instagram', distinctSources: 6,
    previous: { taggedVisits: 1000, uniqueVisitors: 1100 },
  },
  breakdown: [
    { value: 'instagram', visits: 484, visitors: 390, share: 41 },
    { value: 'google', visits: 300, visitors: 250, share: 25.4 },
  ],
  trend: [{ date: '2026-07-25', visits: 180 }],
}

const MEDIUM: stats.UtmSummaryResponse = {
  ...SOURCE, dimension: 'medium',
  breakdown: [{ value: 'cpc', visits: 700, visitors: 600, share: 59.3 }],
}

let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  ;(stats.fetchUtm as jest.Mock).mockImplementation((args: { dimension?: string }) =>
    Promise.resolve(args?.dimension === 'medium' ? MEDIUM : SOURCE))
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
  return render(<QueryClientProvider client={qc}><TrackingScreen /></QueryClientProvider>)
}

test('queries the source dimension over an inclusive 7-day window', async () => {
  await renderScreen()
  await waitFor(() => expect(stats.fetchUtm).toHaveBeenCalled())

  const args = (stats.fetchUtm as jest.Mock).mock.calls[0][0]
  expect(args.dimension).toBe('source')
  expect(args.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(args.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(TRACKING_DAYS).toBe(7)
})

test('tiles show totals with their period-over-period change', async () => {
  const { getByText, getAllByText } = await renderScreen()
  await waitFor(() => expect(getByText('Tagged visits')).toBeTruthy())

  expect(getByText('1.2k')).toBeTruthy()
  expect(getByText('+18% vs previous 7d')).toBeTruthy()
  expect(getByText('−15% vs previous 7d')).toBeTruthy() // visitors fell
  // 'instagram' is both the top-source tile value and the leading breakdown row.
  expect(getAllByText('instagram').length).toBe(2)
  expect(getByText('6')).toBeTruthy()
})

test('the summary line is built from real fields', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(
    getByText('Tagged visits are up 18% on the previous 7 days. instagram drove 41% of tagged visits.'),
  ).toBeTruthy())
})

test('breakdown rows show visits and share', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('484 · 41%')).toBeTruthy())
  expect(getByText('300 · 25%')).toBeTruthy()
})

test('switching dimension refetches and swaps the breakdown', async () => {
  const { getByText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('484 · 41%')).toBeTruthy())

  fireEvent.press(getByText('Medium'))
  await waitFor(() => expect(getByText('700 · 59%')).toBeTruthy())
  expect(queryByText('484 · 41%')).toBeNull()
  expect((stats.fetchUtm as jest.Mock).mock.calls.at(-1)[0].dimension).toBe('medium')
})

test('an empty breakdown says so for the selected dimension', async () => {
  ;(stats.fetchUtm as jest.Mock).mockResolvedValue({ ...SOURCE, breakdown: [] })
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('No UTM-tagged source traffic in the last 7 days.')).toBeTruthy())
})

test('back returns to Home and errors render a retry card', async () => {
  ;(stats.fetchUtm as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('Breakdown')).toBeTruthy())

  fireEvent.press(getByText('Home'))
  expect(router.back).toHaveBeenCalled()
})
