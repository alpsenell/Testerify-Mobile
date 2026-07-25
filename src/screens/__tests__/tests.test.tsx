import { render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TestsScreen } from '../Tests'
import * as campaigns from '../../api/campaigns'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('../../api/campaigns')

const RUNNING = {
  id: 't1', name: 'PDP: sticky add-to-cart on mobile', kind: 'ab', status: 'running',
  targetUrl: null, goals: null, rollout: null, learningNote: null, startsAt: null, endsAt: null,
  createdAt: '2026-07-16T00:00:00Z', updatedAt: '2026-07-25T00:00:00Z', started: '2026-07-16T00:00:00Z',
  variants: 2, visitors: 12500, conversions: 576, revenue: 24800, conversionRate: 4.6,
  control: null, challenger: { id: 'v2', name: 'Sticky bar', visitors: 6300, conversions: 309, impressions: 6300, revenue: 13300, rate: 4.9 },
  uplift: 14.2, confidence: 97, pValue: 0.03, sigStatus: 'winning', forecast: null, trend: [],
}

const DRAFT = {
  ...RUNNING, id: 't2', name: 'Checkout: one-click upsell', status: 'draft',
  challenger: null, visitors: 0, conversions: 0, revenue: 0, conversionRate: 0,
  confidence: 0, uplift: 0, pValue: 1, sigStatus: 'not_enough_data',
}

const SHIPPED = {
  ...RUNNING, id: 't3', name: 'Homepage: hero video autoplay', status: 'rollout',
  rollout: { winnerVariantId: 'v2', promotedAt: '2026-07-20T00:00:00Z' },
}

beforeEach(() => {
  ;(campaigns.fetchCampaigns as jest.Mock).mockResolvedValue([RUNNING, DRAFT, SHIPPED])
})

const renderTests = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return await render(<QueryClientProvider client={qc}><TestsScreen /></QueryClientProvider>)
}

test('renders all campaigns under All filter with counts', async () => {
  const { getByText, getAllByText } = await renderTests()
  await waitFor(() => expect(getByText('PDP: sticky add-to-cart on mobile')).toBeTruthy())
  expect(getByText('Checkout: one-click upsell')).toBeTruthy()
  expect(getByText('Homepage: hero video autoplay')).toBeTruthy()
  expect(getByText('3')).toBeTruthy() // All count
  expect(getAllByText('1').length).toBe(3) // Running / Draft / Shipped counts
})

test('filtering to Running shows only the running campaign', async () => {
  const { getByText, getAllByText, queryByText } = await renderTests()
  await waitFor(() => expect(getByText('PDP: sticky add-to-cart on mobile')).toBeTruthy())

  // "Running" also appears as the running campaign's StatusPill label; the chip renders first in the tree.
  fireEvent.press(getAllByText('Running')[0])

  expect(getByText('PDP: sticky add-to-cart on mobile')).toBeTruthy()
  await waitFor(() => expect(queryByText('Checkout: one-click upsell')).toBeNull())
  expect(queryByText('Homepage: hero video autoplay')).toBeNull()
})

test('draft campaign renders without NaN and shows placeholder confidence/rate', async () => {
  const { getByText, getAllByText } = await renderTests()
  await waitFor(() => expect(getByText('Checkout: one-click upsell')).toBeTruthy())
  expect(getByText('Draft · not launched')).toBeTruthy()
  // draft card renders '—' for both confidence and rate
  expect(getAllByText('—').length).toBe(2)
})
