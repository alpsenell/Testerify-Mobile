/// <reference types="jest" />
import {
  fetchCompany, setDataCollection,
  fetchMembers, updateMemberRole, removeMember,
  fetchInvitations, createInvitation, regenerateInvitation, revokeInvitation,
} from '../company'
import { fetchFlows, updateFlowStatus, deleteFlow } from '../flows'
import { setTokens } from '../tokens'

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

const spyFetch = (body: unknown) =>
  jest.spyOn(globalThis, 'fetch' as any).mockImplementation(() => ok(body))

// [url, init] of the single request the call under test made.
const callArgs = (spy: jest.SpyInstance) => spy.mock.calls[0] as [string, RequestInit]

beforeEach(async () => {
  jest.restoreAllMocks()
  await setTokens({ access: 'A1', refresh: 'R1' })
})

describe('flows', () => {
  test('fetchFlows unwraps the flows envelope', async () => {
    const flow = { id: 'f1', name: 'Cart rescue', status: 'active', steps: [], campaignId: null, campaignName: null, createdAt: '', updatedAt: '' }
    const spy = spyFetch({ flows: [flow] })
    await expect(fetchFlows()).resolves.toEqual([flow])
    expect(callArgs(spy)[0]).toContain('/api/flows')
  })

  test('updateFlowStatus PATCHes just the status', async () => {
    const spy = spyFetch({ flow: {} })
    await updateFlowStatus('f1', 'paused')
    const [url, init] = callArgs(spy)
    expect(url).toContain('/api/flows/f1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ status: 'paused' })
  })

  test('deleteFlow DELETEs the flow', async () => {
    const spy = spyFetch({ message: 'deleted' })
    await deleteFlow('f1')
    const [url, init] = callArgs(spy)
    expect(url).toContain('/api/flows/f1')
    expect(init.method).toBe('DELETE')
  })
})

describe('company', () => {
  test('fetchCompany unwraps the company envelope', async () => {
    const spy = spyFetch({ company: { id: 'c1', dataCollectionEnabled: true } })
    await expect(fetchCompany()).resolves.toMatchObject({ id: 'c1', dataCollectionEnabled: true })
    expect(callArgs(spy)[0]).toContain('/api/company')
  })

  test('setDataCollection PATCHes the boolean and returns the updated company', async () => {
    const spy = spyFetch({ company: { id: 'c1', dataCollectionEnabled: false } })
    await expect(setDataCollection(false)).resolves.toMatchObject({ dataCollectionEnabled: false })
    const [url, init] = callArgs(spy)
    expect(url).toContain('/api/company')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ dataCollectionEnabled: false })
  })
})

describe('members', () => {
  test('fetchMembers unwraps the members envelope', async () => {
    const spy = spyFetch({ members: [{ id: 'u1', role: 'admin' }] })
    await expect(fetchMembers()).resolves.toEqual([{ id: 'u1', role: 'admin' }])
    expect(callArgs(spy)[0]).toContain('/api/company/members')
  })

  test('updateMemberRole PATCHes the role', async () => {
    const spy = spyFetch({ member: {} })
    await updateMemberRole('u2', 'manager')
    const [url, init] = callArgs(spy)
    expect(url).toContain('/api/company/members/u2')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ role: 'manager' })
  })

  test('removeMember DELETEs the member', async () => {
    const spy = spyFetch({ message: 'removed' })
    await removeMember('u2')
    const [url, init] = callArgs(spy)
    expect(url).toContain('/api/company/members/u2')
    expect(init.method).toBe('DELETE')
  })
})

describe('invitations', () => {
  test('fetchInvitations unwraps the invitations envelope', async () => {
    const spy = spyFetch({ invitations: [{ id: 'i1', email: 'a@b.co' }] })
    await expect(fetchInvitations()).resolves.toEqual([{ id: 'i1', email: 'a@b.co' }])
    expect(callArgs(spy)[0]).toContain('/api/company/invitations')
  })

  // The link comes back only on this call and on regenerate — it is never
  // re-served by the list endpoint, so both keep the whole envelope.
  test('createInvitation POSTs email + role and keeps the one-time link', async () => {
    const spy = spyFetch({ invitation: { id: 'i1' }, link: 'https://panel.testerify.com/invite/abc' })
    await expect(createInvitation('a@b.co', 'manager')).resolves.toEqual({
      invitation: { id: 'i1' }, link: 'https://panel.testerify.com/invite/abc',
    })
    const [url, init] = callArgs(spy)
    expect(url).toContain('/api/company/invitations')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.co', role: 'manager' })
  })

  test('regenerateInvitation POSTs to the invite and returns a fresh link', async () => {
    const spy = spyFetch({ invitation: { id: 'i1' }, link: 'https://panel.testerify.com/invite/xyz' })
    await expect(regenerateInvitation('i1')).resolves.toMatchObject({ link: 'https://panel.testerify.com/invite/xyz' })
    const [url, init] = callArgs(spy)
    expect(url).toContain('/api/company/invitations/i1')
    expect(init.method).toBe('POST')
  })

  test('revokeInvitation DELETEs the invite', async () => {
    const spy = spyFetch({ message: 'Invitation revoked' })
    await revokeInvitation('i1')
    const [url, init] = callArgs(spy)
    expect(url).toContain('/api/company/invitations/i1')
    expect(init.method).toBe('DELETE')
  })
})
