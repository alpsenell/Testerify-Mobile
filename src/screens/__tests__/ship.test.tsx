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

beforeEach(() => {
  useSheets.setState({ sheet: { kind: 'ship', campaignId: 't1' } })
  useToast.setState({ message: null })
  ;(campaigns.fetchCampaign as jest.Mock).mockResolvedValue(WINNING)
})

const renderSheet = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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
