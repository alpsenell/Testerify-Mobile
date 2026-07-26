import { render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShipSheet } from '../../components/sheets/ShipSheet'
import { useSheets } from '../../stores/sheets'
import { useToast } from '../../stores/toast'
import * as campaigns from '../../api/campaigns'
import type { CampaignDetailData } from '../../api/campaigns'

jest.mock('../../api/campaigns')

const WINNING: CampaignDetailData = {
  id: 't1', name: 'PDP: sticky add-to-cart on mobile', status: 'running', kind: 'ab',
  targetUrl: null, startsAt: null, endsAt: null,
  createdAt: '2026-07-16T00:00:00Z',
  rollout: null, learningNote: null,
  variants: [
    { id: 'v1', name: 'Original', isControl: true, stats: { visitors: 6200, conversions: 267, impressions: 6200, revenue: 11400 } },
    { id: 'v2', name: 'Sticky bar', isControl: false, stats: { visitors: 6300, conversions: 309, impressions: 6300, revenue: 13300 } },
  ],
  stats: { visitors: 12500, conversions: 576, impressions: 12500, revenue: 24700 },
  forecast: null,
  timeline: { labels: [], byVariant: {} },
  revenueCurrency: { code: 'USD', mixed: false },
  impact: null,
  controlId: 'v1', challengerId: 'v2',
  significance: { controlRate: 4.3, variantRate: 4.9, uplift: 14.2, confidence: 97, pValue: 0.03, status: 'winning' },
}

// Each test's QueryClient is tracked here so it can be torn down afterward —
// see the afterEach below.
let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  useSheets.setState({ sheet: { kind: 'ship', campaignId: 't1' } })
  useToast.setState({ message: null })
  ;(campaigns.fetchCampaign as jest.Mock).mockResolvedValue(WINNING)
})

// react-query schedules a 5-minute gcTime setTimeout (never .unref()'d) the
// moment a query's last observer unmounts — which RNTL's own afterEach does
// for every test here. Left unhandled, each of this file's QueryClients
// leaves that real timer running, and the Jest worker never exits naturally
// (the "worker process has failed to exit gracefully" warning). clear()
// removes every query from the cache, cancelling its gcTime timer
// immediately (QueryCache.remove() calls query.destroy(), which does this).
// It does NOT touch the app's real gcTime default — only disposes of this
// test's client once the test is done with it.
//
// Mutations need a second, separate fix below: MutationCache's own
// remove()/clear() do NOT call mutation.destroy() (an asymmetry with
// QueryCache — arguably a react-query gap), so a settled mutation's own
// gcTimeout survives qc.clear() untouched. mutations.gcTime: 0 in
// defaultOptions sidesteps that entirely by not scheduling one in the first
// place.
afterEach(() => {
  currentQueryClient?.clear()
  currentQueryClient = undefined
})

const renderSheet = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { gcTime: 0 } } })
  currentQueryClient = qc
  return await render(<QueryClientProvider client={qc}><ShipSheet /></QueryClientProvider>)
}

test('ship it promotes the challenger, toasts, and closes the sheet', async () => {
  ;(campaigns.promoteCampaign as jest.Mock).mockResolvedValue({ campaign: {}, rollout: {} })
  const { getByText } = await renderSheet()

  // Wait for the campaign query to resolve (confidence value flips from the 0% fallback).
  await waitFor(() => expect(getByText('97%')).toBeTruthy())

  fireEvent.press(getByText('Ship it'))

  await waitFor(() => expect(campaigns.promoteCampaign).toHaveBeenCalledWith('t1', 'v2'))
  await waitFor(() => expect(useSheets.getState().sheet).toBeNull())
  expect(useToast.getState().message).toBe('Sticky bar is live for everyone. Rollback stays available for 30 days.')
})

test('failed ship shows the error toast and keeps the sheet open', async () => {
  ;(campaigns.promoteCampaign as jest.Mock).mockRejectedValue(new Error('Could not ship — try again.'))
  const { getByText } = await renderSheet()

  await waitFor(() => expect(getByText('97%')).toBeTruthy())

  fireEvent.press(getByText('Ship it'))

  await waitFor(() => expect(useToast.getState().message).toBe('Could not ship — try again.'))
  expect(useSheets.getState().sheet).toEqual({ kind: 'ship', campaignId: 't1' })
})
