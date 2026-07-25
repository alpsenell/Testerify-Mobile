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
