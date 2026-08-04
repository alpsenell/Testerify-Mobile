import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ReplaysScreen } from '../Replays'
import * as stats from '../../api/stats'
import { ApiError } from '../../api/client'
import { useToast } from '../../stores/toast'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/stats')

const session = (over: Partial<stats.ReplayListResponse['sessions'][number]> = {}) => ({
  sessionId: 's1', visitorId: 'v1', device: 'mobile', entryPath: '/products/amber-candle',
  startedAt: '2026-07-25T11:00:00Z', durationMs: 132_000, eventCount: 84, pageCount: 3,
  trigger: 'rage' as const, triggerPath: '/cart', rageCount: 4, deadCount: 0, campaignName: null,
  ...over,
})

const REPLAYS: stats.ReplayListResponse = {
  origin: 'https://shop.example',
  sessions: [session(), session({ sessionId: 's2', trigger: 'dead', entryPath: '/cart', deadCount: 2, rageCount: 0 })],
  limit: 50, total: 128, totalEvents: 9_400, avgDurationMs: 96_000,
}

// The toast store's auto-hide schedules a real 4.2s timer that would outlive
// the test; the play-affordance test swaps in a spy and it's restored here.
const realShow = useToast.getState().show

let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  ;(stats.fetchReplays as jest.Mock).mockResolvedValue(REPLAYS)
})

afterEach(async () => {
  // See learnings.test.tsx — drain react-query's notification batch in act().
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  useToast.setState({ show: realShow })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
})

const renderScreen = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><ReplaysScreen /></QueryClientProvider>)
}

test('KPI tiles report sessions, interactions and average length', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('sessions recorded')).toBeTruthy())

  expect(getByText('128')).toBeTruthy()
  expect(getByText('9.4k')).toBeTruthy()
  expect(getByText('1m 36s')).toBeTruthy()
})

test('session rows carry entry path, meta, trigger chip, duration and age', async () => {
  const { getByText, getAllByText } = await renderScreen()
  await waitFor(() => expect(getByText('/products/amber-candle')).toBeTruthy())

  // Both fixture sessions share the same device/page/event meta line.
  expect(getAllByText('mobile · 3 pages · 84 events').length).toBe(2)
  expect(getByText('Rage clicks')).toBeTruthy()
  expect(getAllByText('2m 12s').length).toBe(2)
  expect(getByText('Showing 2 of 128 recorded sessions')).toBeTruthy()
})

test('the trigger filter refetches with the endpoint parameter', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('/products/amber-candle')).toBeTruthy())
  expect((stats.fetchReplays as jest.Mock).mock.calls[0][0]).toEqual({})

  fireEvent.press(getByText('Rage'))
  await waitFor(() => expect((stats.fetchReplays as jest.Mock).mock.calls.at(-1)[0]).toEqual({ trigger: 'rage' }))
})

test('playback is desktop-only — the play button explains itself', async () => {
  const show = jest.fn()
  useToast.setState({ show })
  const { getByLabelText } = await renderScreen()
  await waitFor(() => expect(getByLabelText('Play session on /products/amber-candle')).toBeTruthy())

  fireEvent.press(getByLabelText('Play session on /products/amber-candle'))
  expect(show).toHaveBeenCalledWith('Replays play on the desktop panel.')
})

test('a plan-gated store gets the upgrade note, not a retry card', async () => {
  ;(stats.fetchReplays as jest.Mock).mockRejectedValue(new ApiError(402, { error: 'Upgrade required' }))
  const { getByText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText(/part of the Scale plan/)).toBeTruthy())
  expect(queryByText('Retry')).toBeNull()
})

test('an empty filter result says so', async () => {
  ;(stats.fetchReplays as jest.Mock).mockResolvedValue({ ...REPLAYS, sessions: [] })
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('No sessions recorded yet.')).toBeTruthy())
})

test('back returns to Home and errors render a retry card', async () => {
  ;(stats.fetchReplays as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('/products/amber-candle')).toBeTruthy())

  fireEvent.press(getByText('Home'))
  expect(router.back).toHaveBeenCalled()
})
