import { useAuth } from '../auth'
import * as client from '../../api/client'
import * as tokens from '../../api/tokens'

jest.mock('../../api/client', () => ({ apiFetch: jest.fn(), onSessionExpired: jest.fn() }))
jest.mock('../../api/tokens', () => ({ getTokens: jest.fn(), setTokens: jest.fn(), clearTokens: jest.fn() }))

const apiFetch = client.apiFetch as jest.Mock

beforeEach(() => { jest.clearAllMocks(); useAuth.setState({ status: 'restoring', user: null, company: null }) })

test('signIn stores tokens and user/company', async () => {
  apiFetch.mockResolvedValue({
    user: { id: 'u1', name: 'Test', email: 't@x.com', role: 'admin' },
    company: { id: 'c1', name: 'Test Store', slug: 'test', websiteUrl: null },
    stores: [],
    tokens: { accessToken: 'A', refreshToken: 'R' },
  })
  await useAuth.getState().signIn('t@x.com', 'pw')
  expect(tokens.setTokens).toHaveBeenCalledWith({ access: 'A', refresh: 'R' })
  expect(useAuth.getState().status).toBe('signedIn')
  expect(useAuth.getState().company?.name).toBe('Test Store')
  expect(apiFetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ auth: false }))
})

test('signUp posts the workspace fields unauthenticated and lands the session', async () => {
  apiFetch.mockResolvedValue({
    user: { id: 'u1', name: 'Alp', email: 'alp@x.com', role: 'admin' },
    company: { id: 'c1', name: 'Alder & Ash', slug: 'alder-ash', websiteUrl: null },
    stores: [{ id: 'c1', name: 'Alder & Ash', slug: 'alder-ash', role: 'admin' }],
    tokens: { accessToken: 'A', refreshToken: 'R' },
  })
  await useAuth.getState().signUp('Alder & Ash', 'Alp', 'alp@x.com', 'longenough')

  const [path, init] = apiFetch.mock.calls[0]
  expect(path).toBe('/api/auth/register')
  expect(init.auth).toBe(false)
  expect(JSON.parse(init.body)).toEqual({
    companyName: 'Alder & Ash', name: 'Alp', email: 'alp@x.com', password: 'longenough', includeTokens: true,
  })
  expect(tokens.setTokens).toHaveBeenCalledWith({ access: 'A', refresh: 'R' })
  expect(useAuth.getState().status).toBe('signedIn')
  expect(useAuth.getState().company?.name).toBe('Alder & Ash')
})

test('signUp surfaces the server message for a taken email and stays signed out', async () => {
  apiFetch.mockRejectedValue(new Error('Email already registered'))
  await expect(useAuth.getState().signUp('A', 'B', 'taken@x.com', 'longenough'))
    .rejects.toThrow('Email already registered')
  expect(tokens.setTokens).not.toHaveBeenCalled()
  expect(useAuth.getState().status).toBe('restoring')
})

test('a session response without tokens is refused rather than half-signing-in', async () => {
  apiFetch.mockResolvedValue({
    user: { id: 'u1', name: 'Alp', email: 'alp@x.com', role: 'admin' },
    company: { id: 'c1', name: 'A', slug: 'a', websiteUrl: null },
  })
  await expect(useAuth.getState().signUp('A', 'Alp', 'alp@x.com', 'longenough')).rejects.toThrow(/includeTokens/)
  expect(useAuth.getState().status).not.toBe('signedIn')
})

test('acceptInvite posts the token unauthenticated and signs the new user in', async () => {
  apiFetch.mockResolvedValue({
    user: { id: 'u2', name: 'Sam', email: 'sam@x.com', role: 'member' },
    company: { id: 'c1', name: 'Alder & Ash', slug: 'alder-ash', websiteUrl: null },
    tokens: { accessToken: 'A2', refreshToken: 'R2' },
  })
  await useAuth.getState().acceptInvite('tok-abc', 'Sam', 'longenough')

  const [path, init] = apiFetch.mock.calls[0]
  expect(path).toBe('/api/auth/invite')
  expect(init.auth).toBe(false)
  expect(JSON.parse(init.body)).toEqual({ token: 'tok-abc', name: 'Sam', password: 'longenough', includeTokens: true })
  expect(tokens.setTokens).toHaveBeenCalledWith({ access: 'A2', refresh: 'R2' })
  expect(useAuth.getState().user?.email).toBe('sam@x.com')
})

test('switchStore re-mints the tokens, swaps the company and patches the role', async () => {
  useAuth.setState({
    status: 'signedIn',
    user: { id: 'u1', name: 'Alp', email: 'alp@x.com', role: 'admin' },
    company: { id: 'c1', name: 'Alder & Ash', slug: 'alder-ash', websiteUrl: null },
  })
  apiFetch.mockResolvedValue({
    company: { id: 'c2', name: 'Beta Store', slug: 'beta', websiteUrl: null },
    role: 'member',
    stores: [],
    tokens: { accessToken: 'A2', refreshToken: 'R2' },
  })

  const company = await useAuth.getState().switchStore('c2')

  const [path, init] = apiFetch.mock.calls[0]
  expect(path).toBe('/api/auth/switch-store')
  // Authenticated: the current session proves the membership being switched to.
  expect(init.auth).toBeUndefined()
  expect(JSON.parse(init.body)).toEqual({ companyId: 'c2', includeTokens: true })
  expect(tokens.setTokens).toHaveBeenCalledWith({ access: 'A2', refresh: 'R2' })
  expect(company.name).toBe('Beta Store')
  expect(useAuth.getState().company?.id).toBe('c2')
  // Same identity, role scoped to the new store.
  expect(useAuth.getState().user?.id).toBe('u1')
  expect(useAuth.getState().user?.role).toBe('member')
})

test('switchStore without tokens leaves the session on the old store', async () => {
  useAuth.setState({
    status: 'signedIn',
    user: { id: 'u1', name: 'Alp', email: 'alp@x.com', role: 'admin' },
    company: { id: 'c1', name: 'Alder & Ash', slug: 'alder-ash', websiteUrl: null },
  })
  apiFetch.mockResolvedValue({ company: { id: 'c2', name: 'Beta', slug: 'beta', websiteUrl: null }, role: 'member', stores: [] })

  await expect(useAuth.getState().switchStore('c2')).rejects.toThrow(/includeTokens/)
  expect(tokens.setTokens).not.toHaveBeenCalled()
  expect(useAuth.getState().company?.id).toBe('c1')
  expect(useAuth.getState().user?.role).toBe('admin')
})

test('restore with no tokens → signedOut', async () => {
  ;(tokens.getTokens as jest.Mock).mockResolvedValue(null)
  await useAuth.getState().restore()
  expect(useAuth.getState().status).toBe('signedOut')
})

test('restore with tokens loads /api/auth/me', async () => {
  ;(tokens.getTokens as jest.Mock).mockResolvedValue({ access: 'A', refresh: 'R' })
  apiFetch.mockResolvedValue({ user: { id: 'u1', name: 'T', email: 't@x.com', role: 'admin' }, company: { id: 'c1', name: 'S', slug: 's', websiteUrl: null } })
  await useAuth.getState().restore()
  expect(useAuth.getState().status).toBe('signedIn')
})

test('restore with tokens but /api/auth/me rejecting → clears tokens, signedOut', async () => {
  ;(tokens.getTokens as jest.Mock).mockResolvedValue({ access: 'A', refresh: 'R' })
  apiFetch.mockRejectedValue(new Error('401'))
  await useAuth.getState().restore()
  expect(tokens.clearTokens).toHaveBeenCalled()
  expect(useAuth.getState().status).toBe('signedOut')
})

test('restore when getTokens itself rejects → ends signedOut, never stuck restoring', async () => {
  ;(tokens.getTokens as jest.Mock).mockRejectedValue(new Error('SecureStore unavailable'))
  await useAuth.getState().restore()
  expect(useAuth.getState().status).toBe('signedOut')
})

test('signOut with logout POST rejecting still clears tokens and signs out', async () => {
  apiFetch.mockRejectedValue(new Error('network error'))
  await useAuth.getState().signOut()
  expect(tokens.clearTokens).toHaveBeenCalled()
  expect(useAuth.getState().status).toBe('signedOut')
})
