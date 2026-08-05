import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { AnalyticsScreen } from '../Analytics'
import * as campaignsApi from '../../api/campaigns'
import * as statsApi from '../../api/stats'
import type { CampaignListItem } from '../../api/campaigns'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/campaigns')
jest.mock('../../api/stats')

const base: CampaignListItem = {
  id: 'x', name: '', kind: 'ab', status: 'completed', targetUrl: null, goals: null,
  rollout: null, learningNote: null,
  startsAt: null, endsAt: null, createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
  variants: 2, visitors: 0, conversions: 0, revenue: 0, conversionRate: 0, started: '2026-06-01T00:00:00Z',
  control: null, challenger: null, uplift: 0, confidence: 0, pValue: 1, sigStatus: 'inconclusive',
  forecast: null, trend: [],
}
const challenger = { id: 'v2', name: 'B', visitors: 0, conversions: 0, impressions: 0, revenue: 0, rate: 0 }
const make = (over: Partial<CampaignListItem>): CampaignListItem => ({ ...base, ...over })

const CAMPAIGNS: CampaignListItem[] = [
  make({
    id: 'a', name: 'Sticky add-to-cart', status: 'rollout', uplift: 14.2, revenue: 8000, challenger,
    rollout: { winnerVariantId: 'v2', promotedAt: '2026-07-01T00:00:00Z', uplift: 14.2 },
  }),
  make({
    id: 'b', name: 'Single-column checkout', status: 'rollout', uplift: 11.5, revenue: 4000, challenger,
    rollout: { winnerVariantId: 'v2', promotedAt: '2026-07-01T00:00:00Z', uplift: 11.5 },
  }),
  make({ id: 'c', name: 'Hero video autoplay', status: 'completed', uplift: -6.4, challenger }),
  make({ id: 'd', name: '3-up collection grid', status: 'running', uplift: 0.4, challenger }),
  make({ id: 'e', name: 'Draft idea', status: 'draft' }),
]

let currentQueryClient: QueryClient | undefined

const IMPACT: statsApi.ImpactResponse = {
  totalImpact: 12400,
  currency: { code: 'USD', mixed: false },
  campaigns: [
    { id: 'a', name: 'Sticky add-to-cart', promotedAt: '2026-07-01T00:00:00Z', impact: 9100 },
    { id: 'b', name: 'Single-column checkout', promotedAt: '2026-07-01T00:00:00Z', impact: 3300 },
  ],
}

beforeEach(() => {
  ;(campaignsApi.fetchCampaigns as jest.Mock).mockResolvedValue(CAMPAIGNS)
  ;(statsApi.fetchImpact as jest.Mock).mockResolvedValue(IMPACT)
})

afterEach(async () => {
  // react-query batches its observer notifications behind a setTimeout(0). A
  // query or mutation that settles at the very end of a test would otherwise
  // fire that batch after teardown — outside act(), which both warns and
  // leaves a timer holding the Jest worker open. Drain it inside act() first.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
})

const renderScreen = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><AnalyticsScreen /></QueryClientProvider>)
}

test('stat tiles count launched tests, winners, average uplift and winner revenue', async () => {
  const { getByText, getAllByText } = await renderScreen()
  await waitFor(() => expect(getByText('Tests run')).toBeTruthy())

  expect(getByText('4')).toBeTruthy() // 5 campaigns, 1 of them a draft
  // Tile sub-label and the ring legend say the same thing.
  expect(getAllByText('2 without a winner').length).toBe(2)
  expect(getByText('50% win rate')).toBeTruthy()
  expect(getByText('+12.8%')).toBeTruthy() // mean of 14.2 and 11.5, to one decimal
  expect(getByText('across 2 winners')).toBeTruthy()
  expect(getByText('12k')).toBeTruthy()
})

test('summary line and win-rate ring read off the same real figures', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText(/You've launched/)).toBeTruthy())

  expect(getByText(/4 tests and shipped 2 winners/)).toBeTruthy()
  expect(getByText('Sticky add-to-cart at +14.2%')).toBeTruthy()
  // The ring's own value is SVG text (covered by WinRateRing.test.tsx); its
  // legend is plain text and carries the same counts.
  expect(getByText('2 winners')).toBeTruthy()
  expect(getByText('Top-quartile teams ship a winner on ~1 in 3 tests.')).toBeTruthy()
})

test('the summary drops the best-result clause when no winner carries an uplift', async () => {
  ;(campaignsApi.fetchCampaigns as jest.Mock).mockResolvedValue([
    make({ id: 'z', name: 'Promoted blind', status: 'rollout', rollout: { winnerVariantId: 'v2', promotedAt: '2026-07-01T00:00:00Z' } }),
  ])
  const { getByText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText(/You've launched/)).toBeTruthy())

  expect(queryByText(/best result so far/)).toBeNull()
  expect(getByText('no measured winners')).toBeTruthy()
})

test('uplift leaderboard ranks measured tests and keeps losses', async () => {
  const { getByText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('Uplift leaderboard')).toBeTruthy())

  expect(getByText('+14.2%')).toBeTruthy()
  expect(getByText('−6.4%')).toBeTruthy()
  expect(queryByText('Draft idea')).toBeNull()
})

test('velocity renders eight week columns', async () => {
  const { getAllByLabelText } = await renderScreen()
  await waitFor(() => expect(getAllByLabelText(/started week of/).length).toBe(8))
})

test('shows an empty state when nothing has launched', async () => {
  ;(campaignsApi.fetchCampaigns as jest.Mock).mockResolvedValue([make({ id: 'e', status: 'draft' })])
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText(/No launched tests yet/)).toBeTruthy())
})

test('back returns to Home and errors render a retry card', async () => {
  ;(campaignsApi.fetchCampaigns as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('Uplift leaderboard')).toBeTruthy())

  fireEvent.press(getByText('Home'))
  expect(router.back).toHaveBeenCalled()
})

test('the impact card totals shipped winners and links each row to its test', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Estimated impact')).toBeTruthy())

  expect(getByText('$12.4k')).toBeTruthy()
  fireEvent.press(getByText('$9.1k'))
  expect(router.push).toHaveBeenCalledWith('/test/a')
})

test('a failed impact call hides the card instead of blocking the page', async () => {
  ;(statsApi.fetchImpact as jest.Mock).mockRejectedValue(new Error('boom'))
  const { getByText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('Tests run')).toBeTruthy())
  expect(queryByText('Estimated impact')).toBeNull()
})

test('an empty impact list renders no card', async () => {
  ;(statsApi.fetchImpact as jest.Mock).mockResolvedValue({ ...IMPACT, totalImpact: 0, campaigns: [] })
  const { getByText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('Tests run')).toBeTruthy())
  expect(queryByText('Estimated impact')).toBeNull()
})
