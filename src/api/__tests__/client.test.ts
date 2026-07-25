/// <reference types="jest" />
import * as SecureStore from 'expo-secure-store'
import { apiFetch, ApiError, onSessionExpired } from '../client'
import { setTokens, clearTokens } from '../tokens'

jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {}
  return {
    getItemAsync: jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
    setItemAsync: jest.fn((k: string, v: string) => { store[k] = v; return Promise.resolve() }),
    deleteItemAsync: jest.fn((k: string) => { delete store[k]; return Promise.resolve() }),
  }
})

const ok = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response)

beforeEach(async () => {
  jest.restoreAllMocks()
  await clearTokens()
})

test('adds Bearer header from stored tokens', async () => {
  await setTokens({ access: 'A1', refresh: 'R1' })
  const spy = jest.spyOn(globalThis, 'fetch' as any).mockImplementation(() => ok({ hello: 1 }))
  await apiFetch('/api/auth/me')
  const [, init] = spy.mock.calls[0] as [string, RequestInit]
  expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer A1')
})

test('401 → refresh → retry once with new token', async () => {
  await setTokens({ access: 'stale', refresh: 'R1' })
  const spy = jest.spyOn(globalThis as any, 'fetch')
    .mockImplementationOnce(() => ok({ error: 'expired' }, 401))
    .mockImplementationOnce(() => ok({ message: 'Token refreshed', tokens: { accessToken: 'A2', refreshToken: 'R2' } }))
    .mockImplementationOnce(() => ok({ campaigns: [] }))
  const result = await apiFetch<{ campaigns: [] }>('/api/campaigns')
  expect(result.campaigns).toEqual([])
  expect(spy.mock.calls[1][0]).toContain('/api/auth/refresh')
  expect(((spy.mock.calls[2][1] as any)!.headers as Record<string, string>).Authorization).toBe('Bearer A2')
})

test('refresh failure clears tokens and fires onSessionExpired', async () => {
  await setTokens({ access: 'stale', refresh: 'dead' })
  const expired = jest.fn()
  onSessionExpired(expired)
  jest.spyOn(globalThis as any, 'fetch')
    .mockImplementationOnce(() => ok({ error: 'expired' }, 401))
    .mockImplementationOnce(() => ok({ error: 'Invalid refresh token' }, 401))
  await expect(apiFetch('/api/campaigns')).rejects.toThrow(ApiError)
  expect(expired).toHaveBeenCalled()
  expect(await (SecureStore.getItemAsync as jest.Mock)('testerify.access')).toBeNull()
})

test('non-401 error throws ApiError with server message', async () => {
  await setTokens({ access: 'A1', refresh: 'R1' })
  jest.spyOn(globalThis as any, 'fetch').mockImplementation(() => ok({ error: 'Unknown action' }, 400))
  await expect(apiFetch('/api/campaigns/x', { method: 'POST' })).rejects.toMatchObject({ status: 400, message: 'Unknown action' })
})
