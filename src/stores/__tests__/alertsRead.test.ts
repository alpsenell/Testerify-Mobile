import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAlertsRead } from '../alertsRead'
import { useAuth } from '../auth'

const KEY = 'testerify.alertsRead'

const ALDER = { id: 'c1', name: 'Alder & Ash', slug: 'alder-ash', websiteUrl: null }
const BETA = { id: 'c2', name: 'Beta Store', slug: 'beta', websiteUrl: null }

beforeEach(async () => {
  useAuth.setState({ status: 'signedIn', user: null, company: ALDER })
  useAlertsRead.setState({ readIds: [], byCompany: {}, scope: ALDER.id })
  await AsyncStorage.clear()
  ;(AsyncStorage.setItem as jest.Mock).mockClear()
})

afterEach(() => {
  useAuth.setState({ status: 'signedOut', user: null, company: null })
})

test('markAllRead unions ids without duplicating', () => {
  useAlertsRead.getState().markAllRead(['a', 'b'])
  expect(useAlertsRead.getState().readIds.sort()).toEqual(['a', 'b'])

  useAlertsRead.getState().markAllRead(['b', 'c'])
  expect(useAlertsRead.getState().readIds.sort()).toEqual(['a', 'b', 'c'])
})

test('starts empty', () => {
  expect(useAlertsRead.getState().readIds).toEqual([])
})

// --- Phase 2: AsyncStorage persistence (upgraded from Phase-1 in-memory) ---
// Same deterministic-flush technique as favorites.test.ts: await the exact
// promise the last setItem call returned instead of guessing at a number of
// microtask ticks.
async function flushLastWrite() {
  const calls = (AsyncStorage.setItem as jest.Mock).mock.results
  await calls[calls.length - 1]?.value
}

test('persists readIds under the active company, not a flat shared bucket', async () => {
  useAlertsRead.getState().markAllRead(['a', 'b'])
  await flushLastWrite()

  const raw = await AsyncStorage.getItem(KEY)
  expect(raw).not.toBeNull()
  const parsed = JSON.parse(raw as string)
  expect(parsed.version).toBe(1)
  expect(parsed.state.byCompany[ALDER.id].readIds.sort()).toEqual(['a', 'b'])
  expect(parsed.state.readIds).toBeUndefined()
})

// --- Phase 3: tenant namespacing (alert ids are campaign-derived, so they only
// mean anything inside one tenant) ---

test('switching store swaps the read markers instead of marking the new tenant read', () => {
  useAlertsRead.getState().markAllRead(['a', 'b'])

  useAuth.setState({ company: BETA })
  expect(useAlertsRead.getState().readIds).toEqual([])

  useAlertsRead.getState().markAllRead(['z'])
  useAuth.setState({ company: ALDER })
  expect(useAlertsRead.getState().readIds.sort()).toEqual(['a', 'b'])
})

test('rehydrates the namespaced map and projects the active company on a fresh module load', async () => {
  // jest.resetModules() clears the registry that the store, the auth store and
  // the mocked AsyncStorage all live in, so re-require them together (in that
  // order) to seed the same fresh mock instance the fresh store reads.
  jest.resetModules()
  const freshAsyncStorage = require('@react-native-async-storage/async-storage')
  await freshAsyncStorage.setItem(
    KEY,
    JSON.stringify({ state: { byCompany: { c1: { readIds: ['z1'] }, c2: { readIds: ['q1'] } } }, version: 1 }),
  )
  const { useAlertsRead: fresh } = require('../alertsRead')
  const { useAuth: freshAuth } = require('../auth')

  // The store auto-hydrates on creation (fire-and-forget); rehydrate() is
  // idempotent, so awaiting it here guarantees hydration has finished.
  await fresh.persist.rehydrate()
  freshAuth.setState({ status: 'signedIn', company: ALDER })

  expect(fresh.getState().readIds).toEqual(['z1'])
  expect(typeof fresh.getState().markAllRead).toBe('function')

  freshAuth.setState({ company: BETA })
  expect(fresh.getState().readIds).toEqual(['q1'])
})

test('pre-namespacing (flat) read markers are adopted by the first store opened', async () => {
  jest.resetModules()
  const freshAsyncStorage = require('@react-native-async-storage/async-storage')
  await freshAsyncStorage.setItem(KEY, JSON.stringify({ state: { readIds: ['old-1'] }, version: 0 }))
  const { useAlertsRead: fresh } = require('../alertsRead')
  const { useAuth: freshAuth } = require('../auth')

  await fresh.persist.rehydrate()
  expect(fresh.getState().readIds).toEqual([])

  freshAuth.setState({ status: 'signedIn', company: ALDER })
  expect(fresh.getState().readIds).toEqual(['old-1'])

  freshAuth.setState({ company: BETA })
  expect(fresh.getState().readIds).toEqual([])
})
