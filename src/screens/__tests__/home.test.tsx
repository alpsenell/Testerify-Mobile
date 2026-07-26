import { render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HomeScreen } from '../Home'
import * as dashboard from '../../api/dashboard'
import * as campaigns from '../../api/campaigns'
import { useAuth } from '../../stores/auth'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('../../api/dashboard')
jest.mock('../../api/campaigns')

const CAMPAIGN = {
  id: 't1', name: 'PDP: sticky add-to-cart on mobile', kind: 'ab', status: 'running',
  targetUrl: null, goals: null, rollout: null, learningNote: null, startsAt: null, endsAt: null,
  createdAt: '2026-07-16T00:00:00Z', updatedAt: '2026-07-25T00:00:00Z', started: '2026-07-16T00:00:00Z',
  variants: 2, visitors: 12500, conversions: 576, revenue: 24800, conversionRate: 4.6,
  control: null, challenger: { id: 'v2', name: 'Sticky bar', visitors: 6300, conversions: 309, impressions: 6300, revenue: 13300, rate: 4.9 },
  uplift: 14.2, confidence: 97, pValue: 0.03, sigStatus: 'winning', forecast: null, trend: [],
}

// Each test's QueryClient is tracked here so it can be torn down afterward —
// see the afterEach below.
let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  useAuth.setState({ status: 'signedIn', user: { id: 'u', name: 'Alp S', email: 'a@b.c', role: 'admin' }, company: { id: 'c', name: 'Alder & Ash', slug: 'aa', websiteUrl: null } })
  ;(dashboard.fetchDashboard as jest.Mock).mockResolvedValue({
    currency: { code: 'USD', mixed: false },
    stats: { visitors: 48234, activeCampaigns: 4, avgConversionRate: 3.8, conversions: 1800, revenue: 41200 },
    visitorTraffic: [], campaignPerformance: [],
  })
  ;(campaigns.fetchCampaigns as jest.Mock).mockResolvedValue([CAMPAIGN])
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

const renderHome = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  currentQueryClient = qc
  return await render(<QueryClientProvider client={qc}><HomeScreen /></QueryClientProvider>)
}

test('renders store name, stats, ship-ready callout, and running test', async () => {
  const { getByText } = await renderHome()
  await waitFor(() => expect(getByText('Alder & Ash')).toBeTruthy())
  expect(getByText('48.2k')).toBeTruthy()
  expect(getByText('1 test is ready to ship')).toBeTruthy()
  expect(getByText('PDP: sticky add-to-cart on mobile')).toBeTruthy()
})

test('shows retry card when campaigns fail', async () => {
  ;(campaigns.fetchCampaigns as jest.Mock).mockRejectedValue(new Error('boom'))
  const { getAllByText } = await renderHome()
  await waitFor(() => expect(getAllByText('Retry').length).toBeGreaterThan(0))
})
