import { act, cleanup, render, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { InviteAcceptScreen } from '../InviteAccept'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'
import { useAuth } from '../../stores/auth'

const TOKEN = 'a3f9c1d4e5b6a7c8d9e0f1a2b3c4d5e6a3f9c1d4e5b6a7c8d9e0f1a2b3c4d5e6'

// Mutable so a test can render the screen as the deep link delivers it
// (…/invite/<token>) or as the no-token fallback.
let mockParams: Record<string, unknown> = { token: TOKEN }

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}))
jest.mock('../../api/auth')

const INVITE = { email: 'sam@alder.com', role: 'member' as const, companyName: 'Alder & Ash' }

const realAcceptInvite = useAuth.getState().acceptInvite
const realSignOut = useAuth.getState().signOut
let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  mockParams = { token: TOKEN }
  ;(authApi.fetchInvitePreview as jest.Mock).mockResolvedValue(INVITE)
})

afterEach(async () => {
  // See tracking.test.tsx — drain react-query's notification batch in act().
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  useAuth.setState({
    status: 'signedOut', user: null, company: null,
    acceptInvite: realAcceptInvite, signOut: realSignOut,
  })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
  jest.clearAllMocks()
})

const renderScreen = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><InviteAcceptScreen /></QueryClientProvider>)
}

test('previews the invitation from the deep-link token and joins the workspace', async () => {
  const acceptInvite = jest.fn().mockResolvedValue(undefined)
  useAuth.setState({ acceptInvite })

  const screen = await renderScreen()
  await waitFor(() => expect(screen.getByText('Join Alder & Ash')).toBeTruthy())
  expect(authApi.fetchInvitePreview).toHaveBeenCalledWith(TOKEN)
  expect(screen.getByText(/invited as member \(sam@alder\.com\)/)).toBeTruthy()

  const user = userEvent.setup()
  await user.paste(screen.getByTestId('name'), 'Sam')
  await user.paste(screen.getByTestId('password'), 'longenough')
  await user.press(screen.getByText('Join workspace'))

  await waitFor(() => expect(acceptInvite).toHaveBeenCalledWith(TOKEN, 'Sam', 'longenough'))
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)'))
})

test('an expired link gets its own copy and no form', async () => {
  ;(authApi.fetchInvitePreview as jest.Mock).mockRejectedValue(
    new ApiError(410, { error: 'This invitation is no longer valid', reason: 'expired' }),
  )

  const screen = await renderScreen()
  await waitFor(() => expect(screen.getByText(/expired/i)).toBeTruthy())
  expect(screen.getByText('Invitation unavailable')).toBeTruthy()
  expect(screen.queryByText('Join workspace')).toBeNull()
})

test('an already-used link points at signing in instead', async () => {
  ;(authApi.fetchInvitePreview as jest.Mock).mockRejectedValue(
    new ApiError(410, { error: 'This invitation is no longer valid', reason: 'accepted' }),
  )

  const screen = await renderScreen()
  await waitFor(() => expect(screen.getByText(/already been used/i)).toBeTruthy())
})

test('a network failure offers a retry rather than a dead end', async () => {
  ;(authApi.fetchInvitePreview as jest.Mock).mockRejectedValue(new ApiError(0, { error: 'Network error' }))

  const screen = await renderScreen()
  await waitFor(() => expect(screen.getByText('Retry')).toBeTruthy())
})

test('a short password is caught before the round-trip', async () => {
  const acceptInvite = jest.fn().mockResolvedValue(undefined)
  useAuth.setState({ acceptInvite })

  const screen = await renderScreen()
  await waitFor(() => expect(screen.getByText('Join Alder & Ash')).toBeTruthy())

  const user = userEvent.setup()
  await user.paste(screen.getByTestId('name'), 'Sam')
  await user.paste(screen.getByTestId('password'), 'short')
  await user.press(screen.getByText('Join workspace'))

  await waitFor(() => expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy())
  expect(acceptInvite).not.toHaveBeenCalled()
})

test('a server rejection is surfaced verbatim', async () => {
  const acceptInvite = jest.fn().mockRejectedValue(
    new Error('An account with this email already exists. Please log in instead.'),
  )
  useAuth.setState({ acceptInvite })

  const screen = await renderScreen()
  await waitFor(() => expect(screen.getByText('Join Alder & Ash')).toBeTruthy())

  const user = userEvent.setup()
  await user.paste(screen.getByTestId('name'), 'Sam')
  await user.paste(screen.getByTestId('password'), 'longenough')
  await user.press(screen.getByText('Join workspace'))

  await waitFor(() => expect(screen.getByText(/already exists/)).toBeTruthy())
  expect(router.replace).not.toHaveBeenCalled()
})

test('an already-signed-in user is warned and offered a sign-out first', async () => {
  const signOut = jest.fn().mockResolvedValue(undefined)
  useAuth.setState({ status: 'signedIn', user: { id: 'u1', name: 'Alp', email: 'alp@x.com', role: 'admin' }, signOut })

  const screen = await renderScreen()
  await waitFor(() => expect(screen.getByText('Join Alder & Ash')).toBeTruthy())
  expect(screen.getByText(/creates a separate account for sam@alder\.com/)).toBeTruthy()

  const user = userEvent.setup()
  await user.press(screen.getByText('Sign out first'))
  await waitFor(() => expect(signOut).toHaveBeenCalled())
})

test('opened without a token, a pasted panel link is what gets previewed', async () => {
  mockParams = {}

  const screen = await renderScreen()
  await waitFor(() => expect(screen.getByText('Open your invite')).toBeTruthy())
  expect(authApi.fetchInvitePreview).not.toHaveBeenCalled()

  const user = userEvent.setup()
  await user.paste(screen.getByTestId('invite-link'), `https://panel.testerify.com/invite/${TOKEN}`)
  await user.press(screen.getByText('Continue'))

  await waitFor(() => expect(authApi.fetchInvitePreview).toHaveBeenCalledWith(TOKEN))
  await waitFor(() => expect(screen.getByText('Join Alder & Ash')).toBeTruthy())
})

test('a link pasted without its token says so instead of querying', async () => {
  mockParams = {}

  const screen = await renderScreen()
  await waitFor(() => expect(screen.getByText('Open your invite')).toBeTruthy())

  const user = userEvent.setup()
  await user.paste(screen.getByTestId('invite-link'), 'https://panel.testerify.com/invite/')
  await user.press(screen.getByText('Continue'))

  await waitFor(() => expect(screen.getByText(/doesn't look like an invite link/)).toBeTruthy())
  expect(authApi.fetchInvitePreview).not.toHaveBeenCalled()
})
