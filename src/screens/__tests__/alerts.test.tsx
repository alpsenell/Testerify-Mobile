import { render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AlertsScreen } from '../Alerts'
import * as campaigns from '../../api/campaigns'
import { useAlertsRead } from '../../stores/alertsRead'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('../../api/campaigns')

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

beforeEach(() => {
  useAlertsRead.setState({ readIds: [] })
  ;(campaigns.fetchCampaigns as jest.Mock).mockResolvedValue([WINNING_RUNNING])
})

// react-query schedules a 5-minute gcTime setTimeout (never .unref()'d) the
// moment a query's last observer unmounts — which RNTL's own afterEach does
// for every test here. Left unhandled, each of this file's QueryClients
// leaves that real timer running, and the Jest worker never exits naturally
// (the "worker process has failed to exit gracefully" warning). clear()
// removes every query/mutation from the cache, which cancels their gcTime
// timers immediately — it doesn't touch the app's real gcTime default, only
// disposes of this test's client once the test is done with it.
afterEach(() => {
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
