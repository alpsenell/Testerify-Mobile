import { render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TestDetailScreen } from '../TestDetail'
import * as campaigns from '../../api/campaigns'
import type { CampaignDetailData } from '../../api/campaigns'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 't1' }),
}))
jest.mock('../../api/campaigns')

const WINNING: CampaignDetailData = {
  id: 't1', name: 'PDP: sticky add-to-cart on mobile', status: 'running', kind: 'ab',
  targetUrl: 'https://shop.example.com/products/sticky-cta', startsAt: null, endsAt: null,
  createdAt: '2026-07-16T00:00:00Z',
  rollout: null, learningNote: null,
  variants: [
    { id: 'v1', name: 'Original', isControl: true, stats: { visitors: 6200, conversions: 267, impressions: 6200, revenue: 11400 } },
    { id: 'v2', name: 'Sticky bar', isControl: false, stats: { visitors: 6300, conversions: 309, impressions: 6300, revenue: 13300 } },
  ],
  stats: { visitors: 12500, conversions: 576, impressions: 12500, revenue: 24700 },
  forecast: null,
  timeline: { labels: ['Jul 22', 'Jul 23', 'Jul 24'], byVariant: { v1: [4.0, 4.1, 4.2], v2: [4.2, 4.5, 4.9] } },
  revenueCurrency: { code: 'USD', mixed: false },
  impact: null,
  controlId: 'v1', challengerId: 'v2',
  significance: { controlRate: 4.3, variantRate: 4.9, uplift: 14.2, confidence: 97, pValue: 0.03, status: 'winning' },
}

const ROLLOUT: CampaignDetailData = {
  ...WINNING, id: 't3', status: 'rollout',
  rollout: { winnerVariantId: 'v2', promotedAt: '2026-07-20T00:00:00Z' },
}

const renderDetail = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return await render(<QueryClientProvider client={qc}><TestDetailScreen /></QueryClientProvider>)
}

test('winning campaign renders verdict headline, both variants, and toggles the daily chart', async () => {
  ;(campaigns.fetchCampaign as jest.Mock).mockResolvedValue(WINNING)
  const { getByText, queryByText } = await renderDetail()

  await waitFor(() => expect(getByText(/is winning by/)).toBeTruthy())
  expect(getByText('Original')).toBeTruthy()
  expect(getByText('Sticky bar')).toBeTruthy()

  // Chart hidden initially
  expect(queryByText('A control')).toBeNull()

  await fireEvent.press(getByText('Show daily conversion chart'))
  expect(getByText('A control')).toBeTruthy()
})

test('rollout campaign renders the roll-back action', async () => {
  ;(campaigns.fetchCampaign as jest.Mock).mockResolvedValue(ROLLOUT)
  const { getByText } = await renderDetail()
  await waitFor(() => expect(getByText('Roll back')).toBeTruthy())
})
