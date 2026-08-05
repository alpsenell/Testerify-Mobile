import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Alert } from 'react-native'
import { router } from 'expo-router'
import { SettingsScreen } from '../Settings'
import * as companyApi from '../../api/company'
import type { Company, Role } from '../../api/company'
import { useAuth } from '../../stores/auth'
import { useToast } from '../../stores/toast'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/company')

const COMPANY: Company = {
  id: 'c1', name: 'Alder & Ash', slug: 'alder-ash', apiKey: 'k',
  websiteUrl: 'https://alderandash.example', onboardingCompleted: true,
  plan: 'growth', billingStatus: 'active', trialEndsAt: null, shopifyDomain: 'alder.myshopify.com',
  notifications: null, pageTypeConfig: null, dataCollectionEnabled: true,
  createdAt: '2026-01-01T00:00:00Z',
}

const ME = { id: 'u1', name: 'Alp', email: 'alp@example.com', role: 'admin' }

const confirmLastAlert = () => {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as { style?: string; onPress?: () => void }[]
  act(() => { buttons.find((b) => b.style === 'destructive')?.onPress?.() })
}

const realShow = useToast.getState().show
const realSignOut = useAuth.getState().signOut
let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  ;(companyApi.fetchCompany as jest.Mock).mockResolvedValue(COMPANY)
  ;(companyApi.setDataCollection as jest.Mock).mockImplementation((enabled: boolean) =>
    Promise.resolve({ ...COMPANY, dataCollectionEnabled: enabled }))
})

afterEach(async () => {
  // See learnings.test.tsx — drain react-query's notification batch in act().
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  useToast.setState({ show: realShow })
  useAuth.setState({ status: 'signedOut', user: null, company: null, signOut: realSignOut })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
  jest.restoreAllMocks()
})

const renderAs = async (role: Role) => {
  useAuth.setState({ status: 'signedIn', user: { ...ME, role }, company: null })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><SettingsScreen /></QueryClientProvider>)
}

test('renders the collecting state and the account rows', async () => {
  const { getByText } = await renderAs('admin')
  await waitFor(() => expect(getByText('Collecting')).toBeTruthy())

  expect(getByText('Alder & Ash')).toBeTruthy()
  expect(getByText('growth')).toBeTruthy()
  expect(getByText('Admin')).toBeTruthy()
  expect(getByText('alp@example.com')).toBeTruthy()
})

test('the purchase-tracking card is not rendered — no backing field exists', async () => {
  const { getByText, queryByText } = await renderAs('admin')
  await waitFor(() => expect(getByText('Collecting')).toBeTruthy())
  expect(queryByText('Purchase tracking')).toBeNull()
})

test('a paused workspace says so', async () => {
  ;(companyApi.fetchCompany as jest.Mock).mockResolvedValue({ ...COMPANY, dataCollectionEnabled: false })
  const { getByText } = await renderAs('admin')
  await waitFor(() => expect(getByText('Paused')).toBeTruthy())
})

test('turning collection off confirms first, then calls the API', async () => {
  const { getByText, getByLabelText } = await renderAs('admin')
  await waitFor(() => expect(getByLabelText('Toggle data collection')).toBeTruthy())

  fireEvent.press(getByLabelText('Toggle data collection'))
  expect(Alert.alert).toHaveBeenCalled()
  expect((Alert.alert as jest.Mock).mock.calls.at(-1)?.[1]).toContain('stops receiving data')
  expect(companyApi.setDataCollection).not.toHaveBeenCalled()

  confirmLastAlert()
  await waitFor(() => expect(companyApi.setDataCollection).toHaveBeenCalledWith(false))
  await waitFor(() => expect(getByText('Paused')).toBeTruthy())
})

test('turning collection back on needs no confirm', async () => {
  ;(companyApi.fetchCompany as jest.Mock).mockResolvedValue({ ...COMPANY, dataCollectionEnabled: false })
  const { getByText, getByLabelText } = await renderAs('admin')
  await waitFor(() => expect(getByLabelText('Toggle data collection')).toBeTruthy())

  fireEvent.press(getByLabelText('Toggle data collection'))
  expect(Alert.alert).not.toHaveBeenCalled()
  await waitFor(() => expect(companyApi.setDataCollection).toHaveBeenCalledWith(true))
  await waitFor(() => expect(getByText('Collecting')).toBeTruthy())
})

test('a non-admin sees the state but gets no switch', async () => {
  const { getByText, queryByLabelText } = await renderAs('member')
  await waitFor(() => expect(getByText('Collecting')).toBeTruthy())

  expect(queryByLabelText('Toggle data collection')).toBeNull()
  expect(getByText('Pausing takes effect within a minute for new page views. Only admins can change this.')).toBeTruthy()
})

test('a failed toggle toasts and leaves the state alone', async () => {
  const show = jest.fn()
  useToast.setState({ show })
  ;(companyApi.setDataCollection as jest.Mock).mockRejectedValueOnce(new Error('Only admins can update company'))

  const { getByText, getByLabelText } = await renderAs('admin')
  await waitFor(() => expect(getByLabelText('Toggle data collection')).toBeTruthy())

  fireEvent.press(getByLabelText('Toggle data collection'))
  confirmLastAlert()
  await waitFor(() => expect(show).toHaveBeenCalledWith('Only admins can update company'))
  expect(getByText('Collecting')).toBeTruthy()
})

test('log out confirms, then signs out', async () => {
  const signOut = jest.fn().mockResolvedValue(undefined)
  useAuth.setState({ signOut })

  const { getByText } = await renderAs('admin')
  await waitFor(() => expect(getByText('Log out')).toBeTruthy())

  fireEvent.press(getByText('Log out'))
  expect(signOut).not.toHaveBeenCalled()

  confirmLastAlert()
  await waitFor(() => expect(signOut).toHaveBeenCalled())
})

test('back returns to Home and errors render a retry card', async () => {
  ;(companyApi.fetchCompany as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderAs('admin')
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('Collecting')).toBeTruthy())

  fireEvent.press(getByText('Home'))
  expect(router.back).toHaveBeenCalled()
})
