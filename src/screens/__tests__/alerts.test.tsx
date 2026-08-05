import { act, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { AlertsScreen } from '../Alerts'
import * as campaigns from '../../api/campaigns'
import * as alertsApi from '../../api/alerts'
import * as push from '../../notifications'
import { useAlertsRead } from '../../stores/alertsRead'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('../../api/campaigns')
jest.mock('../../api/alerts')
// The real module pulls in expo-notifications/expo-device; the screen only
// fires it off, so a stub is enough (its own guards are covered in
// src/notifications/__tests__).
jest.mock('../../notifications', () => ({ registerForPush: jest.fn(() => Promise.resolve(false)) }))

// updatedAt is "now" so the ship_ready alert derived from it lands in the "Today" group
// regardless of when this suite runs.
const WINNING_RUNNING = {
  id: 't1', name: 'PDP: sticky add-to-cart on mobile', kind: 'ab', status: 'running',
  targetUrl: null, goals: null, rollout: null, learningNote: null, startsAt: null, endsAt: null,
  createdAt: '2026-07-16T00:00:00Z', updatedAt: new Date().toISOString(), started: '2026-07-16T00:00:00Z',
  variants: 2, visitors: 12500, conversions: 576, revenue: 24800, conversionRate: 4.6,
  control: null, challenger: { id: 'v2', name: 'Sticky bar', visitors: 6300, conversions: 309, impressions: 6300, revenue: 13300, rate: 4.9 },
  uplift: 14.2, confidence: 97, pValue: 0.03, sigStatus: 'winning', forecast: null, trend: [],
}

// Each test's QueryClient is tracked here so it can be torn down afterward —
// see the afterEach below.
let currentQueryClient: QueryClient | undefined

// Two server-delivered alerts: one attached to a test (tappable) and one
// company-level (no link). `srm` is exactly the kind the client can't derive.
const SERVER_ALERTS: alertsApi.ServerAlert[] = [
  {
    id: 'ae-1', campaignId: 't1', key: 'srm',
    title: '\u201cPDP\u201d has a traffic-split problem',
    body: 'Visitors aren\u2019t splitting as configured.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ae-2', campaignId: null, key: 'no_data',
    title: 'A test hasn\u2019t recorded any visitors',
    body: 'Check the snippet.',
    createdAt: new Date().toISOString(),
  },
]

beforeEach(() => {
  useAlertsRead.setState({ readIds: [] })
  ;(campaigns.fetchCampaigns as jest.Mock).mockResolvedValue([WINNING_RUNNING])
  ;(alertsApi.fetchAlerts as jest.Mock).mockResolvedValue(SERVER_ALERTS)
  ;(push.registerForPush as jest.Mock).mockClear()
  ;(router.push as jest.Mock).mockClear()
})

// react-query schedules a 5-minute gcTime setTimeout (never .unref()'d) the
// moment a query's last observer unmounts — which RNTL's own afterEach does
// for every test here. Left unhandled, each of this file's QueryClients
// leaves that real timer running, and the Jest worker never exits naturally
// (the "worker process has failed to exit gracefully" warning). clear()
// removes every query/mutation from the cache, which cancels their gcTime
// timers immediately — it doesn't touch the app's real gcTime default, only
// disposes of this test's client once the test is done with it.
afterEach(async () => {
  // See tracking.test.tsx — drain react-query's notification batch inside
  // act() before tearing the client down, so a late store notification can't
  // land outside act (the React 19 warning).
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  currentQueryClient?.clear()
  currentQueryClient = undefined
})

const renderAlerts = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  currentQueryClient = qc
  return await render(<QueryClientProvider client={qc}><AlertsScreen /></QueryClientProvider>)
}

test('renders the group label and alert title for a winning-running test', async () => {
  const { getByText } = await renderAlerts()
  await waitFor(() => expect(getByText('Today')).toBeTruthy())
  expect(getByText('PDP: sticky add-to-cart on mobile reached 97% confidence')).toBeTruthy()
})

test('pressing "Mark all read" updates the read-state store', async () => {
  const { getByText } = await renderAlerts()
  await waitFor(() => expect(getByText('Today')).toBeTruthy())
  expect(useAlertsRead.getState().readIds).toEqual([])

  fireEvent.press(getByText('Mark all read'))

  await waitFor(() => expect(useAlertsRead.getState().readIds).toContain('ship_ready:t1'))
})

test('shows retry card when campaigns fail', async () => {
  ;(campaigns.fetchCampaigns as jest.Mock).mockRejectedValue(new Error('boom'))
  const { getByText } = await renderAlerts()
  await waitFor(() => expect(getByText('Retry')).toBeTruthy())
})

test('shows empty state when there are no alerts', async () => {
  ;(campaigns.fetchCampaigns as jest.Mock).mockResolvedValue([])
  const { getByText } = await renderAlerts()
  await waitFor(() => expect(getByText('Nothing needs you right now.')).toBeTruthy())
})

// ── Two sections: derived "Needs action" + server-truth "History" ────

test('renders both sections', async () => {
  const { getByText } = await renderAlerts()
  await waitFor(() => expect(getByText('Needs action')).toBeTruthy())
  expect(getByText('History')).toBeTruthy()
})

test('the history section renders the server feed, including keys the client cannot derive', async () => {
  const { getByText } = await renderAlerts()
  await waitFor(() => expect(getByText('\u201cPDP\u201d has a traffic-split problem')).toBeTruthy())
  expect(getByText('A test hasn\u2019t recorded any visitors')).toBeTruthy()
  // The derived card is still there — the feed is additive, not a replacement.
  expect(getByText('PDP: sticky add-to-cart on mobile reached 97% confidence')).toBeTruthy()
})

test('a history row with a campaign deep-links to that test', async () => {
  const { getByText } = await renderAlerts()
  await waitFor(() => expect(getByText('\u201cPDP\u201d has a traffic-split problem')).toBeTruthy())

  fireEvent.press(getByText('\u201cPDP\u201d has a traffic-split problem'))
  expect(router.push).toHaveBeenCalledWith('/test/t1')
})

test('a company-level history row does not navigate', async () => {
  const { getByText } = await renderAlerts()
  await waitFor(() => expect(getByText('A test hasn\u2019t recorded any visitors')).toBeTruthy())

  fireEvent.press(getByText('A test hasn\u2019t recorded any visitors'))
  expect(router.push).not.toHaveBeenCalled()
})

test('a failing feed degrades quietly — derived cards survive, no retry wall', async () => {
  ;(alertsApi.fetchAlerts as jest.Mock).mockRejectedValue(new Error('Request failed (404)'))
  const { getByText, queryByText } = await renderAlerts()

  await waitFor(() => expect(getByText('Alert history isn\u2019t available yet.')).toBeTruthy())
  expect(getByText('PDP: sticky add-to-cart on mobile reached 97% confidence')).toBeTruthy()
  expect(queryByText('Retry')).toBeNull()
})

test('an empty feed says so instead of looking broken', async () => {
  ;(alertsApi.fetchAlerts as jest.Mock).mockResolvedValue([])
  const { getByText } = await renderAlerts()
  await waitFor(() => expect(getByText('No alerts have been sent yet.')).toBeTruthy())
})

test('"Mark all read" covers server alert ids too', async () => {
  const { getByText } = await renderAlerts()
  await waitFor(() => expect(getByText('\u201cPDP\u201d has a traffic-split problem')).toBeTruthy())

  fireEvent.press(getByText('Mark all read'))

  await waitFor(() => expect(useAlertsRead.getState().readIds).toContain('ae-1'))
  expect(useAlertsRead.getState().readIds).toContain('ship_ready:t1')
})

// ── Push registration happens in context ────────────────────────────

test('visiting the Alerts screen registers for push (fire-and-forget)', async () => {
  await renderAlerts()
  await waitFor(() => expect(push.registerForPush).toHaveBeenCalled())
})
