import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { FavoritesScreen } from '../Favorites'
import * as campaignsApi from '../../api/campaigns'
import * as ai from '../../api/ai'
import type { CampaignListItem } from '../../api/campaigns'
import type { AiIdea } from '../../api/ai'
import { useFavorites } from '../../stores/favorites'
import { useToast } from '../../stores/toast'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/campaigns')
jest.mock('../../api/ai')

const base: CampaignListItem = {
  id: 'x', name: '', kind: 'ab', status: 'running', targetUrl: '/product', goals: null,
  rollout: null, learningNote: null,
  startsAt: null, endsAt: null, createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
  variants: 2, visitors: 900, conversions: 40, revenue: 0, conversionRate: 4.4, started: '2026-07-01T00:00:00Z',
  control: null, challenger: null, uplift: 12.4, confidence: 96, pValue: 0.04, sigStatus: 'winning',
  forecast: null, trend: [1, 4, 3, 6, 9],
}

const pinnedCampaign: CampaignListItem = { ...base, id: 'c1', name: 'PDP: sticky add-to-cart' }
const otherCampaign: CampaignListItem = { ...base, id: 'c2', name: 'Homepage hero video' }

const IDEA: AiIdea = {
  title: 'Show the free-shipping threshold in the cart',
  hypothesis: 'Average cart is $52, free shipping starts at $65. Naming the gap lifts AOV.',
  element: null, change: null, evidence: null, page: 'cart', path: '/cart', metric: 'add_to_cart',
  impact: 'medium', difficulty: 'easy',
}

const realShow = useToast.getState().show
let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  ;(campaignsApi.fetchCampaigns as jest.Mock).mockResolvedValue([pinnedCampaign, otherCampaign])
  ;(ai.generateTestDraft as jest.Mock).mockResolvedValue({ campaign: { id: 'new' }, hypothesis: null })
  useFavorites.setState({ pinnedIds: ['c1'], savedIdeas: [IDEA] })
})

afterEach(async () => {
  // See learnings.test.tsx — drain react-query's notification batch in act().
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  useToast.setState({ show: realShow })
  useFavorites.setState({ pinnedIds: [], savedIdeas: [] })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
})

const renderScreen = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><FavoritesScreen /></QueryClientProvider>)
}

test('shows only pinned tests, as rich cards', async () => {
  const { getByText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('PDP: sticky add-to-cart')).toBeTruthy())

  expect(queryByText('Homepage hero video')).toBeNull()
  expect(getByText('4.4%')).toBeTruthy()
  expect(getByText('+12.4%')).toBeTruthy()
  expect(getByText('96%')).toBeTruthy()
  expect(getByText('Running')).toBeTruthy()
})

test('tapping a pinned card opens that test', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('PDP: sticky add-to-cart')).toBeTruthy())

  fireEvent.press(getByText('PDP: sticky add-to-cart'))
  expect(router.push).toHaveBeenCalledWith('/test/c1')
})

test('a pin whose test the backend no longer returns simply drops out', async () => {
  useFavorites.setState({ pinnedIds: ['gone'], savedIdeas: [] })
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText(/No pinned tests yet/)).toBeTruthy())
})

test('saved ideas render with their tag, impact and hypothesis', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText(IDEA.title)).toBeTruthy())

  expect(getByText('Cart · Add to cart')).toBeTruthy()
  expect(getByText('medium impact')).toBeTruthy()
  expect(getByText(IDEA.hypothesis)).toBeTruthy()
})

test('Build turns a saved idea into a draft and toasts', async () => {
  const show = jest.fn()
  useToast.setState({ show })
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Build')).toBeTruthy())

  fireEvent.press(getByText('Build'))
  await waitFor(() => expect(ai.generateTestDraft).toHaveBeenCalledWith({
    name: IDEA.title, goal: IDEA.hypothesis, path: '/cart',
  }))
  await waitFor(() => expect(show).toHaveBeenCalledWith(`Draft created from "${IDEA.title}". Finish it on desktop.`))
})

test('Remove drops the idea from the on-device store', async () => {
  const { getByText, getByLabelText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText(IDEA.title)).toBeTruthy())

  fireEvent.press(getByLabelText(`Remove ${IDEA.title} from saved ideas`))
  await waitFor(() => expect(queryByText(IDEA.title)).toBeNull())
  expect(useFavorites.getState().savedIdeas).toEqual([])
  expect(getByText(/No saved ideas yet/)).toBeTruthy()
})

test('both sections have their own empty state', async () => {
  useFavorites.setState({ pinnedIds: [], savedIdeas: [] })
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText(/No pinned tests yet/)).toBeTruthy())
  expect(getByText(/No saved ideas yet/)).toBeTruthy()
})

test('back returns to Home and a failed load renders a retry card', async () => {
  ;(campaignsApi.fetchCampaigns as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('PDP: sticky add-to-cart')).toBeTruthy())

  fireEvent.press(getByText('Home'))
  expect(router.back).toHaveBeenCalled()
})
