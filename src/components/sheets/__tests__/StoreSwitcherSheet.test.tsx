import { act, cleanup, render, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StoreSwitcherSheet } from '../StoreSwitcherSheet'
import * as authApi from '../../../api/auth'
import { useAuth } from '../../../stores/auth'
import { useSheets } from '../../../stores/sheets'
import { useToast } from '../../../stores/toast'

jest.mock('../../../api/auth')

const ALDER = { id: 'c1', name: 'Alder & Ash', slug: 'alder-ash', websiteUrl: null }
const BETA = { id: 'c2', name: 'Beta Store', slug: 'beta', websiteUrl: null }

const STORES = {
  stores: [
    { id: 'c1', name: 'Alder & Ash', slug: 'alder-ash', role: 'admin' as const },
    { id: 'c2', name: 'Beta Store', slug: 'beta', role: 'member' as const },
  ],
  activeCompanyId: 'c1',
}

const realSwitchStore = useAuth.getState().switchStore
let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  ;(authApi.fetchStores as jest.Mock).mockResolvedValue(STORES)
  useAuth.setState({ status: 'signedIn', user: { id: 'u1', name: 'Alp', email: 'a@x.com', role: 'admin' }, company: ALDER })
  useSheets.setState({ sheet: { kind: 'storeSwitcher' } })
  useToast.setState({ message: null })
})

afterEach(async () => {
  // See tracking.test.tsx — drain react-query's notification batch in act().
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  useAuth.setState({ status: 'signedOut', user: null, company: null, switchStore: realSwitchStore })
  useSheets.setState({ sheet: null })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
  jest.clearAllMocks()
})

const renderSheet = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  currentQueryClient = qc
  const clear = jest.spyOn(qc, 'clear')
  const screen = await render(<QueryClientProvider client={qc}><StoreSwitcherSheet /></QueryClientProvider>)
  return { ...screen, clear }
}

test('lists every store with the active one marked', async () => {
  const screen = await renderSheet()
  await waitFor(() => expect(screen.getByText('Beta Store')).toBeTruthy())

  expect(screen.getByText('Alder & Ash')).toBeTruthy()
  expect(screen.getByText('Admin · current')).toBeTruthy()
  expect(screen.getByText('Member')).toBeTruthy()
})

test('picking another store re-scopes the session, empties the cache and closes', async () => {
  const switchStore = jest.fn().mockImplementation(async () => {
    useAuth.setState({ company: BETA })
    return BETA
  })
  useAuth.setState({ switchStore })

  const screen = await renderSheet()
  await waitFor(() => expect(screen.getByText('Beta Store')).toBeTruthy())

  const user = userEvent.setup()
  await user.press(screen.getByLabelText('Switch to Beta Store'))

  await waitFor(() => expect(switchStore).toHaveBeenCalledWith('c2'))
  // Every cached query is tenant-scoped: an invalidate would keep serving the
  // previous store's data while refetches are in flight.
  await waitFor(() => expect(screen.clear).toHaveBeenCalled())
  await waitFor(() => expect(useSheets.getState().sheet).toBeNull())
  await waitFor(() => expect(useToast.getState().message).toBe("You're now in Beta Store."))
})

test('the store already active is inert', async () => {
  const switchStore = jest.fn()
  useAuth.setState({ switchStore })

  const screen = await renderSheet()
  await waitFor(() => expect(screen.getByText('Alder & Ash')).toBeTruthy())

  const user = userEvent.setup()
  await user.press(screen.getByLabelText('Switch to Alder & Ash'))

  expect(switchStore).not.toHaveBeenCalled()
  expect(useSheets.getState().sheet).toEqual({ kind: 'storeSwitcher' })
})

test('a refused switch toasts the server message and keeps the sheet open', async () => {
  const switchStore = jest.fn().mockRejectedValue(new Error('You are not a member of that store'))
  useAuth.setState({ switchStore })

  const screen = await renderSheet()
  await waitFor(() => expect(screen.getByText('Beta Store')).toBeTruthy())

  const user = userEvent.setup()
  await user.press(screen.getByLabelText('Switch to Beta Store'))

  await waitFor(() => expect(useToast.getState().message).toBe('You are not a member of that store'))
  expect(useSheets.getState().sheet).toEqual({ kind: 'storeSwitcher' })
  expect(screen.clear).not.toHaveBeenCalled()
})

test('a failed load offers a retry', async () => {
  ;(authApi.fetchStores as jest.Mock).mockRejectedValueOnce(new Error('network down'))

  const screen = await renderSheet()
  await waitFor(() => expect(screen.getByText('Retry')).toBeTruthy())

  const user = userEvent.setup()
  await user.press(screen.getByText('Retry'))
  await waitFor(() => expect(screen.getByText('Beta Store')).toBeTruthy())
})
