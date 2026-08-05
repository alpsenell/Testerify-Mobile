import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { QueueScreen } from '../Queue'
import * as queueApi from '../../api/queue'
import type { QueueItem } from '../../api/queue'
import { useToast } from '../../stores/toast'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/queue')

const base: QueueItem = {
  id: 'q1', title: '', hypothesis: null, element: null, change: null, evidence: null,
  page: null, path: null, metric: null, impact: 'medium', effort: 'medium',
  source: 'manual', status: 'queued', sourceCampaignId: null, draftedCampaignId: null,
  createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z', score: 6,
}
const make = (over: Partial<QueueItem>): QueueItem => ({ ...base, ...over })

const ITEMS: QueueItem[] = [
  make({ id: 'q1', title: 'Bigger add-to-cart button', hypothesis: 'A larger CTA lifts add rate.', impact: 'high', effort: 'easy', score: 9, page: 'product', source: 'ai_scan' }),
  make({ id: 'q2', title: 'Shorter checkout copy', impact: 'medium', effort: 'medium', score: 6 }),
  make({ id: 'q3', title: 'Trust badges near price', status: 'drafted', draftedCampaignId: 'c9' }),
  make({ id: 'q4', title: 'Autoplay hero video', status: 'dismissed' }),
]

const realShow = useToast.getState().show
let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  ;(queueApi.fetchQueue as jest.Mock).mockResolvedValue(ITEMS)
  ;(queueApi.updateQueueItem as jest.Mock).mockImplementation((id: string, patch: Partial<QueueItem>) =>
    Promise.resolve({ ...ITEMS.find((i) => i.id === id)!, ...patch }))
})

afterEach(async () => {
  // See learnings.test.tsx — drain react-query's notification batch in act().
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  useToast.setState({ message: null, show: realShow })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
})

const renderScreen = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><QueueScreen /></QueryClientProvider>)
}

test('shows queued ideas with score, impact and effort badges', async () => {
  const { getByText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('Bigger add-to-cart button')).toBeTruthy())

  expect(getByText('9')).toBeTruthy()
  expect(getByText('high impact')).toBeTruthy()
  expect(getByText('easy effort')).toBeTruthy()
  expect(getByText('A larger CTA lifts add rate.')).toBeTruthy()
  expect(getByText('AI scan')).toBeTruthy()
  // Non-queued items stay behind their filter.
  expect(queryByText('Trust badges near price')).toBeNull()
})

test('filter chips carry counts and switch the visible status', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Bigger add-to-cart button')).toBeTruthy())

  fireEvent.press(getByText('Drafted'))
  await waitFor(() => expect(getByText('Trust badges near price')).toBeTruthy())

  fireEvent.press(getByText('Open draft'))
  expect(router.push).toHaveBeenCalledWith('/test/c9')
})

test('dismiss moves an idea out of the queue and toasts', async () => {
  const { getAllByText, getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Bigger add-to-cart button')).toBeTruthy())

  fireEvent.press(getAllByText('Dismiss')[0])
  await waitFor(() => expect(queueApi.updateQueueItem).toHaveBeenCalledWith('q1', { status: 'dismissed' }))
  expect(useToast.getState().message).toBe('Idea dismissed.')
})

test('a dismissed idea can be restored', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Bigger add-to-cart button')).toBeTruthy())

  fireEvent.press(getByText('Dismissed'))
  await waitFor(() => expect(getByText('Autoplay hero video')).toBeTruthy())

  fireEvent.press(getByText('Restore'))
  await waitFor(() => expect(queueApi.updateQueueItem).toHaveBeenCalledWith('q4', { status: 'queued' }))
})

test('an empty queue explains where ideas come from', async () => {
  ;(queueApi.fetchQueue as jest.Mock).mockResolvedValue([])
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText(/Nothing queued/)).toBeTruthy())
})
