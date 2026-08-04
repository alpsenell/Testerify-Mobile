import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { HeatmapsScreen } from '../Heatmaps'
import * as stats from '../../api/stats'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/stats')

const HEATMAP: stats.HeatmapPageListResponse = {
  origin: 'https://shop.example', minClicks: 50, hiddenCount: 7,
  pages: [
    { path: '/products/candle', total: 3200, rage: 12, dead: 3, byDevice: { desktop: 1280, mobile: 1920, tablet: 0, unknown: 0 } },
    { path: '/cart', total: 800, rage: 0, dead: 0, byDevice: { desktop: 400, mobile: 400, tablet: 0, unknown: 0 } },
  ],
}

let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  ;(stats.fetchHeatmap as jest.Mock).mockResolvedValue(HEATMAP)
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
  return render(<QueryClientProvider client={qc}><HeatmapsScreen /></QueryClientProvider>)
}

test('tiles total the ranked clicks and count the ranked pages', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Clicks tracked')).toBeTruthy())

  expect(getByText('4k')).toBeTruthy()
  expect(getByText('2')).toBeTruthy()
  expect(getByText('min 50 clicks')).toBeTruthy()
})

test('page rows carry path, device split, share and clicks', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('/products/candle')).toBeTruthy())

  expect(getByText('60% mobile · 40% desktop')).toBeTruthy()
  expect(getByText('80%')).toBeTruthy()   // 3200 of 4000
  expect(getByText('3.2k clicks')).toBeTruthy()
})

test('the frustration chip only shows on pages that have a signal', async () => {
  const { getByText, queryAllByText } = await renderScreen()
  await waitFor(() => expect(getByText('12 rage · 3 dead')).toBeTruthy())
  expect(queryAllByText(/rage|dead/).length).toBe(1)
})

test('the hidden-pages footnote reports the endpoint threshold', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('7 pages hidden for having fewer than 50 clicks.')).toBeTruthy())
})

test('the footnote is dropped when nothing is hidden', async () => {
  ;(stats.fetchHeatmap as jest.Mock).mockResolvedValue({ ...HEATMAP, hiddenCount: 0 })
  const { getByText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('/cart')).toBeTruthy())
  expect(queryByText(/hidden for having fewer/)).toBeNull()
})

test('shows an empty state when no page qualifies', async () => {
  ;(stats.fetchHeatmap as jest.Mock).mockResolvedValue({ ...HEATMAP, pages: [], hiddenCount: 0 })
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('No page has enough clicks to read a heatmap yet.')).toBeTruthy())
})

test('back returns to Home and errors render a retry card', async () => {
  ;(stats.fetchHeatmap as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('/cart')).toBeTruthy())

  fireEvent.press(getByText('Home'))
  expect(router.back).toHaveBeenCalled()
})
