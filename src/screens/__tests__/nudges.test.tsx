import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { NudgesScreen } from '../Nudges'
import * as campaignsApi from '../../api/campaigns'
import type { CampaignListItem } from '../../api/campaigns'
import { useToast } from '../../stores/toast'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/campaigns')

const base: CampaignListItem = {
  id: 'x', name: '', kind: 'nudge', status: 'running', targetUrl: '/cart', goals: null,
  rollout: null, learningNote: null,
  startsAt: null, endsAt: null, createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
  variants: 2, visitors: 4200, conversions: 210, revenue: 0, conversionRate: 5.1, started: '',
  control: null, challenger: null, uplift: 6.8, confidence: 96, pValue: 0.04, sigStatus: 'winning',
  forecast: null, trend: [],
}

const CAMPAIGNS: CampaignListItem[] = [
  { ...base, id: 'n1', name: 'Free-shipping meter' },
  { ...base, id: 'n2', name: 'Low-stock badge', status: 'paused', uplift: -2.4, confidence: 40, sigStatus: 'losing' },
  { ...base, id: 'a1', name: 'PDP: sticky add-to-cart', kind: 'ab' },
]

const realShow = useToast.getState().show
let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  ;(campaignsApi.fetchCampaigns as jest.Mock).mockResolvedValue(CAMPAIGNS)
  ;(campaignsApi.setCampaignStatus as jest.Mock).mockResolvedValue({ campaign: {} })
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
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><NudgesScreen /></QueryClientProvider>)
}

test('lists only nudges, with their holdout stats', async () => {
  const { getByText, getAllByText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('Free-shipping meter')).toBeTruthy())

  // A/B tests belong to the Tests tab, not here.
  expect(queryByText('PDP: sticky add-to-cart')).toBeNull()

  // Both fixture nudges share visitors, conversion rate and target path.
  expect(getAllByText('4.2k').length).toBe(2)
  expect(getAllByText('5.1%').length).toBe(2)
  expect(getAllByText('/cart').length).toBe(2)
  expect(getByText('+6.8%')).toBeTruthy()   // vs holdout
  expect(getByText('96%')).toBeTruthy()
})

test('a losing nudge shows its negative uplift', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Low-stock badge')).toBeTruthy())
  expect(getByText('−2.4%')).toBeTruthy()
})

test('pausing is optimistic and calls the campaign status endpoint', async () => {
  let release: (v: unknown) => void = () => {}
  ;(campaignsApi.setCampaignStatus as jest.Mock).mockImplementation(() => new Promise((r) => { release = r }))

  const { getByLabelText, getAllByText } = await renderScreen()
  await waitFor(() => expect(getByLabelText('Pause Free-shipping meter')).toBeTruthy())

  fireEvent.press(getByLabelText('Pause Free-shipping meter'))
  await waitFor(() => expect(getAllByText('Paused').length).toBe(2))
  expect(campaignsApi.setCampaignStatus).toHaveBeenCalledWith('n1', 'paused')

  await act(async () => { release({ campaign: {} }) })
})

test('a failed pause rolls back and toasts', async () => {
  const show = jest.fn()
  useToast.setState({ show })
  ;(campaignsApi.setCampaignStatus as jest.Mock).mockRejectedValueOnce(new Error('Network request failed'))

  const { getByLabelText, getByText } = await renderScreen()
  await waitFor(() => expect(getByLabelText('Pause Free-shipping meter')).toBeTruthy())

  fireEvent.press(getByLabelText('Pause Free-shipping meter'))
  await waitFor(() => expect(show).toHaveBeenCalledWith('Network request failed'))
  await waitFor(() => expect(getByText('Running')).toBeTruthy())
})

test('a paused nudge resumes', async () => {
  const { getByLabelText } = await renderScreen()
  await waitFor(() => expect(getByLabelText('Resume Low-stock badge')).toBeTruthy())

  fireEvent.press(getByLabelText('Resume Low-stock badge'))
  await waitFor(() => expect(campaignsApi.setCampaignStatus).toHaveBeenCalledWith('n2', 'running'))
})

test('shows an empty state when the store runs no nudges', async () => {
  ;(campaignsApi.fetchCampaigns as jest.Mock).mockResolvedValue([{ ...base, id: 'a1', kind: 'ab' }])
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('No nudges yet — build one on the desktop panel.')).toBeTruthy())
})

test('back returns to Home and errors render a retry card', async () => {
  ;(campaignsApi.fetchCampaigns as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('Free-shipping meter')).toBeTruthy())

  fireEvent.press(getByText('Home'))
  expect(router.back).toHaveBeenCalled()
})
