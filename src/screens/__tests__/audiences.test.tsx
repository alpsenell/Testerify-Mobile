import { act, cleanup, fireEvent, render, waitFor, userEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Alert } from 'react-native'
import { AudiencesScreen } from '../Audiences'
import * as audiencesApi from '../../api/audiences'
import type { Audience } from '../../api/audiences'
import * as flowsApi from '../../api/flows'
import { ApiError } from '../../api/client'
import { useToast } from '../../stores/toast'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/audiences')
jest.mock('../../api/flows')

const AUDIENCES: Audience[] = [
  {
    id: 'a1', name: 'Mobile newcomers', conditions: { devices: ['mobile'], visitor: 'new' },
    createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
  },
]

const FLOWS = [
  { id: 'f1', name: 'Welcome tour', status: 'active', steps: [], campaignId: null, campaignName: null, createdAt: '', updatedAt: '' },
]

const confirmLastAlert = () => {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as { style?: string; onPress?: () => void }[]
  act(() => { buttons.find((b) => b.style === 'destructive')?.onPress?.() })
}

const realShow = useToast.getState().show
let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  ;(audiencesApi.fetchAudiences as jest.Mock).mockResolvedValue(AUDIENCES)
  ;(audiencesApi.createAudience as jest.Mock).mockImplementation((name: string, conditions: unknown) =>
    Promise.resolve({ id: 'a2', name, conditions, createdAt: '', updatedAt: '' }))
  ;(audiencesApi.updateAudience as jest.Mock).mockImplementation((id: string, patch: { name?: string }) =>
    Promise.resolve({ ...AUDIENCES[0], id, ...patch }))
  ;(audiencesApi.deleteAudience as jest.Mock).mockResolvedValue({ message: 'Audience deleted' })
  ;(flowsApi.fetchFlows as jest.Mock).mockResolvedValue(FLOWS)
})

afterEach(async () => {
  // See learnings.test.tsx — drain react-query's notification batch in act().
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  useToast.setState({ message: null, show: realShow })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
  jest.restoreAllMocks()
})

const renderScreen = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><AudiencesScreen /></QueryClientProvider>)
}

test('lists audiences with a readable condition summary', async () => {
  const s = await renderScreen()
  await waitFor(() => expect(s.getByText('Mobile newcomers')).toBeTruthy())
  expect(s.getByText('mobile · new visitors')).toBeTruthy()
})

test('the create form posts only real constraints', async () => {
  const s = await renderScreen()
  const user = userEvent.setup()
  await waitFor(() => expect(s.getByText('New audience')).toBeTruthy())

  await user.press(s.getByText('New audience'))
  await user.paste(s.getByLabelText('Audience name'), 'Summer mobile')
  await user.press(s.getByText('mobile'))
  await user.press(s.getByText('New'))
  await user.paste(s.getByLabelText('UTM source'), 'instagram')
  await user.press(s.getByText('Create audience'))

  await waitFor(() => expect(audiencesApi.createAudience).toHaveBeenCalledWith('Summer mobile', {
    devices: ['mobile'], visitor: 'new', utmSource: 'instagram',
  }))
  await waitFor(() => expect(useToast.getState().message).toBe('Audience “Summer mobile” saved.'))
})

test('saving is blocked until at least one condition constrains someone', async () => {
  const s = await renderScreen()
  const user = userEvent.setup()
  await waitFor(() => expect(s.getByText('New audience')).toBeTruthy())

  await user.press(s.getByText('New audience'))
  await user.paste(s.getByLabelText('Audience name'), 'Everyone really')
  await user.press(s.getByText('Create audience'))
  expect(audiencesApi.createAudience).not.toHaveBeenCalled()

  // Selecting all three devices is no constraint either — the server would
  // refuse it, so the form does too.
  await user.press(s.getByText('desktop'))
  await user.press(s.getByText('mobile'))
  await user.press(s.getByText('tablet'))
  await user.press(s.getByText('Create audience'))
  expect(audiencesApi.createAudience).not.toHaveBeenCalled()
})

test('editing prefills the form and PATCHes the merged conditions', async () => {
  const s = await renderScreen()
  const user = userEvent.setup()
  await waitFor(() => expect(s.getByText('Mobile newcomers')).toBeTruthy())

  await user.press(s.getByLabelText('Edit Mobile newcomers'))
  expect(s.getByLabelText('Audience name').props.value).toBe('Mobile newcomers')

  await user.paste(s.getByLabelText('Referrer'), 'tiktok.com')
  await user.press(s.getByText('Welcome tour'))
  await user.press(s.getByText('Save changes'))

  await waitFor(() => expect(audiencesApi.updateAudience).toHaveBeenCalledWith('a1', {
    name: 'Mobile newcomers',
    conditions: { devices: ['mobile'], visitor: 'new', referrer: 'tiktok.com', completedFlow: 'f1' },
  }))
})

test('delete confirms first, then calls the API', async () => {
  const s = await renderScreen()
  await waitFor(() => expect(s.getByText('Mobile newcomers')).toBeTruthy())

  // fireEvent (not userEvent) around Alert-confirm flows — the sync act in
  // confirmLastAlert must not interleave with userEvent's managed act (see
  // settings.test.tsx, which sets the pattern).
  fireEvent.press(s.getByLabelText('Delete Mobile newcomers'))
  expect(Alert.alert).toHaveBeenCalled()
  expect(audiencesApi.deleteAudience).not.toHaveBeenCalled()

  confirmLastAlert()
  await waitFor(() => expect(audiencesApi.deleteAudience).toHaveBeenCalledWith('a1'))
  await waitFor(() => expect(useToast.getState().message).toBe('Audience deleted.'))
})

test('a 409 delete surfaces the server message about who still uses it', async () => {
  ;(audiencesApi.deleteAudience as jest.Mock).mockRejectedValueOnce(
    new ApiError(409, { error: 'This audience is still used by 1 campaign(s) — detach it there first.' }))

  const s = await renderScreen()
  await waitFor(() => expect(s.getByText('Mobile newcomers')).toBeTruthy())

  fireEvent.press(s.getByLabelText('Delete Mobile newcomers'))
  confirmLastAlert()
  await waitFor(() => expect(useToast.getState().message).toMatch(/still used by 1 campaign/))
})
