import { act, cleanup, render, waitFor, fireEvent, userEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Alert } from 'react-native'
import { router } from 'expo-router'
import { SettingsScreen } from '../Settings'
import * as companyApi from '../../api/company'
import type { Company, Role } from '../../api/company'
import * as authApi from '../../api/auth'
import { useAuth } from '../../stores/auth'
import { useSheets } from '../../stores/sheets'
import { useToast } from '../../stores/toast'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/company')
jest.mock('../../api/auth')

// One store is the common case, and it's the one that must NOT show a switcher.
const ONE_STORE = {
  stores: [{ id: 'c1', name: 'Alder & Ash', slug: 'alder-ash', role: 'admin' as const }],
  activeCompanyId: 'c1',
}
const TWO_STORES = {
  stores: [...ONE_STORE.stores, { id: 'c2', name: 'Beta Store', slug: 'beta', role: 'member' as const }],
  activeCompanyId: 'c1',
}

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

const USAGE: companyApi.UsageResponse = {
  usage: {
    plan: 'growth', planName: 'Growth', testedSessions: 12_400, testedSessionsLimit: 50_000,
    testedSessionsPct: 25, overSessionLimit: false, runningTests: 2, runningTestsLimit: null,
    atTestLimit: false, periodStart: '2026-08-01T00:00:00Z', periodEnd: '2026-09-01T00:00:00Z',
  },
  plan: { key: 'growth', name: 'Growth', price: 49, features: ['aiAssist'], maxRunningTests: null, testedSessionsPerMonth: 50_000 },
}

beforeEach(() => {
  jest.clearAllMocks()
  useToast.setState({ message: null })
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  ;(companyApi.fetchCompany as jest.Mock).mockResolvedValue(COMPANY)
  ;(companyApi.setDataCollection as jest.Mock).mockImplementation((enabled: boolean) =>
    Promise.resolve({ ...COMPANY, dataCollectionEnabled: enabled }))
  ;(companyApi.fetchUsage as jest.Mock).mockResolvedValue(USAGE)
  ;(companyApi.updateNotifications as jest.Mock).mockImplementation((n: unknown) =>
    Promise.resolve({ ...COMPANY, notifications: n }))
  ;(authApi.fetchStores as jest.Mock).mockResolvedValue(ONE_STORE)
  useSheets.setState({ sheet: null })
})

afterEach(async () => {
  // See learnings.test.tsx — drain react-query's notification batch in act().
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  useToast.setState({ show: realShow })
  useAuth.setState({ status: 'signedOut', user: null, company: null, signOut: realSignOut })
  useSheets.setState({ sheet: null })
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

test('the usage section shows the plan, session meter and running tests', async () => {
  const { getByText } = await renderAs('admin')
  await waitFor(() => expect(getByText('Plan & usage')).toBeTruthy())

  expect(getByText('Growth')).toBeTruthy()
  expect(getByText('$49/mo')).toBeTruthy()
  expect(getByText('12.4k / 50k')).toBeTruthy()
  expect(getByText('2 / unlimited')).toBeTruthy()
})

test('an admin edits alert settings and saves them', async () => {
  const { getByText, getByLabelText } = await renderAs('admin')
  await waitFor(() => expect(getByText('Test alerts')).toBeTruthy())

  // userEvent (not fireEvent): concurrent rendering applies controlled-input
  // state async, and userEvent's managed act keeps the save button's
  // dirty-gating in sync without hand-rolled act() flushes (which overlap
  // RNTL's own and poison the next test).
  const user = userEvent.setup()
  await user.paste(getByLabelText('Slack webhook URL'), 'https://hooks.slack.com/services/T1/B2/x')
  await user.press(getByText('Save alert settings'))

  await waitFor(() => expect(companyApi.updateNotifications).toHaveBeenCalledWith({
    alertsEnabled: true, autoStop: false,
    slackWebhookUrl: 'https://hooks.slack.com/services/T1/B2/x', alertEmail: '',
  }))
  await waitFor(() => expect(useToast.getState().message).toBe('Notification settings saved.'))
})

test('a failed notification save surfaces the server message', async () => {
  ;(companyApi.updateNotifications as jest.Mock).mockRejectedValueOnce(new Error('That doesn\u2019t look like a Slack incoming webhook URL (https://hooks.slack.com/services/\u2026).'))
  const { getByText, getByLabelText } = await renderAs('admin')
  await waitFor(() => expect(getByText('Test alerts')).toBeTruthy())

  const user = userEvent.setup()
  await user.paste(getByLabelText('Slack webhook URL'), 'https://example.com/nope')
  await user.press(getByText('Save alert settings'))
  await waitFor(() => expect(useToast.getState().message).toMatch(/Slack incoming webhook/))
})

test('a non-admin sees alert state read-only with no save button', async () => {
  const { getByText, queryByText, queryByLabelText } = await renderAs('member')
  await waitFor(() => expect(getByText('Test alerts')).toBeTruthy())

  expect(queryByText('Save alert settings')).toBeNull()
  expect(queryByLabelText('Slack webhook URL')).toBeNull()
  expect(getByText('Only admins can change alert delivery.')).toBeTruthy()
})

// --- Phase 3: store switching entry point ---

test('a single-store identity gets no workspace switcher, matching the panel', async () => {
  const { getByText, queryByLabelText } = await renderAs('admin')
  await waitFor(() => expect(getByText('Collecting')).toBeTruthy())
  await waitFor(() => expect(authApi.fetchStores).toHaveBeenCalled())

  expect(queryByLabelText('Workspace: Alder & Ash. Switch workspace')).toBeNull()
  expect(getByText('Alder & Ash')).toBeTruthy()
})

test('with two stores the workspace row opens the switcher sheet', async () => {
  ;(authApi.fetchStores as jest.Mock).mockResolvedValue(TWO_STORES)
  const { getByText, getByLabelText } = await renderAs('admin')
  await waitFor(() => expect(getByText('Collecting')).toBeTruthy())

  const row = await waitFor(() => getByLabelText('Workspace: Alder & Ash. Switch workspace'))
  fireEvent.press(row)
  expect(useSheets.getState().sheet).toEqual({ kind: 'storeSwitcher' })
})
