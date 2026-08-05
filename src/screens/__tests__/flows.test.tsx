import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Alert } from 'react-native'
import { router } from 'expo-router'
import { FlowsScreen } from '../Flows'
import * as flowsApi from '../../api/flows'
import type { Flow } from '../../api/flows'
import { useToast } from '../../stores/toast'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/flows')

const FLOWS: Flow[] = [
  {
    id: 'f1', name: 'Cart rescue', status: 'active', steps: [{}, {}, {}],
    campaignId: 'c1', campaignName: 'PDP: sticky add-to-cart',
    createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-20T00:00:00Z',
  },
  {
    id: 'f2', name: 'Collection browse', status: 'paused', steps: [{}],
    campaignId: null, campaignName: null,
    createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-20T00:00:00Z',
  },
]

// Fires the destructive button of the most recent Alert.alert call.
const confirmLastAlert = () => {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as { style?: string; onPress?: () => void }[]
  const destructive = buttons.find((b) => b.style === 'destructive')
  act(() => { destructive?.onPress?.() })
}

const realShow = useToast.getState().show
let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  ;(flowsApi.fetchFlows as jest.Mock).mockResolvedValue(FLOWS)
  ;(flowsApi.updateFlowStatus as jest.Mock).mockResolvedValue({ flow: {} })
  ;(flowsApi.deleteFlow as jest.Mock).mockResolvedValue({ message: 'deleted' })
})

afterEach(async () => {
  // See learnings.test.tsx — drain react-query's notification batch in act().
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  useToast.setState({ show: realShow })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
  jest.restoreAllMocks()
})

const renderScreen = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><FlowsScreen /></QueryClientProvider>)
}

test('lists flows with status, step count and linked test', async () => {
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('Cart rescue')).toBeTruthy())

  expect(getByText('Active')).toBeTruthy()
  expect(getByText('3 steps')).toBeTruthy()
  expect(getByText('PDP: sticky add-to-cart')).toBeTruthy()

  expect(getByText('Paused')).toBeTruthy()
  expect(getByText('1 step')).toBeTruthy()
  expect(getByText('No test linked')).toBeTruthy()
})

test('the flow builder stays on desktop — no New affordance here', async () => {
  const { queryByText } = await renderScreen()
  await waitFor(() => expect(queryByText('Cart rescue')).toBeTruthy())
  expect(queryByText('New')).toBeNull()
})

test('pausing flips the pill before the server answers, then settles', async () => {
  let release: (v: unknown) => void = () => {}
  ;(flowsApi.updateFlowStatus as jest.Mock).mockImplementation(() => new Promise((r) => { release = r }))

  const { getByLabelText, getAllByText } = await renderScreen()
  await waitFor(() => expect(getByLabelText('Pause Cart rescue')).toBeTruthy())

  fireEvent.press(getByLabelText('Pause Cart rescue'))
  // Optimistic: both rows read Paused while the request is still in flight.
  await waitFor(() => expect(getAllByText('Paused').length).toBe(2))
  expect(flowsApi.updateFlowStatus).toHaveBeenCalledWith('f1', 'paused')

  await act(async () => { release({ flow: {} }) })
})

test('a failed pause rolls the pill back and toasts', async () => {
  const show = jest.fn()
  useToast.setState({ show })
  ;(flowsApi.updateFlowStatus as jest.Mock).mockRejectedValueOnce(new Error('Network request failed'))

  const { getByLabelText, getByText } = await renderScreen()
  await waitFor(() => expect(getByLabelText('Pause Cart rescue')).toBeTruthy())

  fireEvent.press(getByLabelText('Pause Cart rescue'))
  await waitFor(() => expect(show).toHaveBeenCalledWith('Network request failed'))
  await waitFor(() => expect(getByText('Active')).toBeTruthy())
})

test('a paused flow resumes', async () => {
  const { getByLabelText } = await renderScreen()
  await waitFor(() => expect(getByLabelText('Resume Collection browse')).toBeTruthy())

  fireEvent.press(getByLabelText('Resume Collection browse'))
  await waitFor(() => expect(flowsApi.updateFlowStatus).toHaveBeenCalledWith('f2', 'active'))
})

test('delete confirms first and only then calls the API', async () => {
  const { getByLabelText } = await renderScreen()
  await waitFor(() => expect(getByLabelText('Delete Cart rescue')).toBeTruthy())

  fireEvent.press(getByLabelText('Delete Cart rescue'))
  expect(Alert.alert).toHaveBeenCalled()
  expect(flowsApi.deleteFlow).not.toHaveBeenCalled()

  confirmLastAlert()
  await waitFor(() => expect(flowsApi.deleteFlow).toHaveBeenCalledWith('f1'))
})

test('a failed delete toasts', async () => {
  const show = jest.fn()
  useToast.setState({ show })
  ;(flowsApi.deleteFlow as jest.Mock).mockRejectedValueOnce(new Error('Could not delete'))

  const { getByLabelText } = await renderScreen()
  await waitFor(() => expect(getByLabelText('Delete Cart rescue')).toBeTruthy())

  fireEvent.press(getByLabelText('Delete Cart rescue'))
  confirmLastAlert()
  await waitFor(() => expect(show).toHaveBeenCalledWith('Could not delete'))
})

test('shows an empty state when the workspace has no flows', async () => {
  ;(flowsApi.fetchFlows as jest.Mock).mockResolvedValue([])
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('No flows yet — build one on the desktop panel.')).toBeTruthy())
})

test('back returns to Home and errors render a retry card', async () => {
  ;(flowsApi.fetchFlows as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('Cart rescue')).toBeTruthy())

  fireEvent.press(getByText('Home'))
  expect(router.back).toHaveBeenCalled()
})
