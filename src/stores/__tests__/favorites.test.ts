import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFavorites } from '../favorites'
import { useAuth } from '../auth'
import type { AiIdea } from '../../api/ai'

const KEY = 'testerify.favorites'

const idea: AiIdea = {
  title: 'Add urgency copy to PDP', hypothesis: 'Scarcity nudges lift conversion on PDPs',
  element: '.add-to-cart', change: 'Add low-stock badge', evidence: 'Heatmap shows drop-off near CTA',
  page: 'Product', path: '/products/[slug]', metric: 'Add to cart rate',
  impact: 'high', difficulty: 'easy',
}

const ALDER = { id: 'c1', name: 'Alder & Ash', slug: 'alder-ash', websiteUrl: null }
const BETA = { id: 'c2', name: 'Beta Store', slug: 'beta', websiteUrl: null }

// The mock's __INTERNAL_MOCK_STORAGE__ is a plain object shared by every
// setItem/getItem call for the lifetime of this test file's module registry
// (see jest.setup.js) — clear it between tests so persistence assertions
// don't see leftovers from a previous test.
beforeEach(async () => {
  useAuth.setState({ status: 'signedIn', user: null, company: ALDER })
  useFavorites.setState({ pinnedIds: [], savedIdeas: [], byCompany: {}, scope: ALDER.id })
  await AsyncStorage.clear()
  ;(AsyncStorage.setItem as jest.Mock).mockClear()
})

afterEach(() => {
  useAuth.setState({ status: 'signedOut', user: null, company: null })
})

// persist wraps every `set` call (including ones made via the store's own
// actions) with a fire-and-forget storage.setItem write. Awaiting the exact
// promise that the last setItem call returned is a deterministic way to wait
// for that write to actually land in the mock, instead of guessing at a
// number of microtask ticks.
async function flushLastWrite() {
  const calls = (AsyncStorage.setItem as jest.Mock).mock.results
  await calls[calls.length - 1]?.value
}

test('starts with empty arrays pre-hydration, never undefined', () => {
  expect(useFavorites.getState().pinnedIds).toEqual([])
  expect(useFavorites.getState().savedIdeas).toEqual([])
})

test('togglePin adds an id, then removes it on a second toggle', () => {
  useFavorites.getState().togglePin('t1')
  expect(useFavorites.getState().pinnedIds).toEqual(['t1'])
  useFavorites.getState().togglePin('t1')
  expect(useFavorites.getState().pinnedIds).toEqual([])
})

test('togglePin tracks multiple distinct ids independently', () => {
  useFavorites.getState().togglePin('t1')
  useFavorites.getState().togglePin('t2')
  expect(useFavorites.getState().pinnedIds.slice().sort()).toEqual(['t1', 't2'])
  useFavorites.getState().togglePin('t1')
  expect(useFavorites.getState().pinnedIds).toEqual(['t2'])
})

test('saveIdea appends a new idea', () => {
  useFavorites.getState().saveIdea(idea)
  expect(useFavorites.getState().savedIdeas).toEqual([idea])
})

test('saveIdea replaces an existing idea with the same title instead of duplicating', () => {
  useFavorites.getState().saveIdea(idea)
  const revised = { ...idea, hypothesis: 'Revised hypothesis' }
  useFavorites.getState().saveIdea(revised)
  expect(useFavorites.getState().savedIdeas).toEqual([revised])
})

test('removeIdea removes the matching idea by title', () => {
  useFavorites.getState().saveIdea(idea)
  useFavorites.getState().removeIdea(idea.title)
  expect(useFavorites.getState().savedIdeas).toEqual([])
})

test('removeIdea is a no-op for an unknown title', () => {
  useFavorites.getState().saveIdea(idea)
  useFavorites.getState().removeIdea('does not exist')
  expect(useFavorites.getState().savedIdeas).toEqual([idea])
})

test('persists under the active company, not a flat shared bucket', async () => {
  useFavorites.getState().togglePin('t1')
  await flushLastWrite()
  useFavorites.getState().saveIdea(idea)
  await flushLastWrite()

  const raw = await AsyncStorage.getItem(KEY)
  expect(raw).not.toBeNull()
  const parsed = JSON.parse(raw as string)
  expect(parsed.version).toBe(1)
  expect(parsed.state.byCompany[ALDER.id]).toEqual({ pinnedIds: ['t1'], savedIdeas: [idea] })
  // The flat fields are a projection of the map, so they must not be written
  // durably — a flat copy is exactly what bleeds across tenants.
  expect(parsed.state.pinnedIds).toBeUndefined()
})

// --- Phase 3: tenant namespacing (store switching happens without a re-login) ---

test('switching store swaps the visible pins and never merges the tenants', () => {
  useFavorites.getState().togglePin('t1')
  useFavorites.getState().saveIdea(idea)

  useAuth.setState({ company: BETA })
  expect(useFavorites.getState().pinnedIds).toEqual([])
  expect(useFavorites.getState().savedIdeas).toEqual([])

  useFavorites.getState().togglePin('t2')
  expect(useFavorites.getState().pinnedIds).toEqual(['t2'])

  useAuth.setState({ company: ALDER })
  expect(useFavorites.getState().pinnedIds).toEqual(['t1'])
  expect(useFavorites.getState().savedIdeas).toEqual([idea])

  const { byCompany } = useFavorites.getState()
  expect(byCompany[ALDER.id].pinnedIds).toEqual(['t1'])
  expect(byCompany[BETA.id].pinnedIds).toEqual(['t2'])
})

test('a pin made while signed out is not handed to the next tenant', () => {
  useAuth.setState({ status: 'signedOut', company: null })
  useFavorites.getState().togglePin('stray')
  expect(useFavorites.getState().pinnedIds).toEqual(['stray'])

  useAuth.setState({ status: 'signedIn', company: BETA })
  expect(useFavorites.getState().pinnedIds).toEqual([])
})

test('rehydrates the namespaced map and projects the active company on a fresh module load', async () => {
  // jest.resetModules() clears the registry that the store, the auth store and
  // the mocked AsyncStorage all live in, so re-require them together (in that
  // order) to seed the same fresh mock instance the fresh store will read.
  jest.resetModules()
  const freshAsyncStorage = require('@react-native-async-storage/async-storage')
  await freshAsyncStorage.setItem(
    KEY,
    JSON.stringify({
      state: { byCompany: { c1: { pinnedIds: ['x1'], savedIdeas: [idea] }, c2: { pinnedIds: ['y1'], savedIdeas: [] } } },
      version: 1,
    }),
  )
  const { useFavorites: fresh } = require('../favorites')
  const { useAuth: freshAuth } = require('../auth')

  // The store auto-hydrates on creation (fire-and-forget); rehydrate() is
  // idempotent, so awaiting it here guarantees hydration has finished.
  await fresh.persist.rehydrate()
  freshAuth.setState({ status: 'signedIn', company: ALDER })

  expect(fresh.getState().pinnedIds).toEqual(['x1'])
  expect(fresh.getState().savedIdeas).toEqual([idea])
  // actions must survive hydration merge, not just data
  expect(typeof fresh.getState().togglePin).toBe('function')

  freshAuth.setState({ company: BETA })
  expect(fresh.getState().pinnedIds).toEqual(['y1'])
})

test('pre-namespacing (flat) persisted data is adopted by the first store opened', async () => {
  jest.resetModules()
  const freshAsyncStorage = require('@react-native-async-storage/async-storage')
  // Exactly what a device upgrading from Phase 2 has on disk: version 0, flat.
  await freshAsyncStorage.setItem(
    KEY,
    JSON.stringify({ state: { pinnedIds: ['legacy-1'], savedIdeas: [idea] }, version: 0 }),
  )
  const { useFavorites: fresh } = require('../favorites')
  const { useAuth: freshAuth } = require('../auth')

  await fresh.persist.rehydrate()
  // Hydration lands before the session is restored, so nothing is claimed yet.
  expect(fresh.getState().pinnedIds).toEqual([])

  freshAuth.setState({ status: 'signedIn', company: ALDER })
  expect(fresh.getState().pinnedIds).toEqual(['legacy-1'])
  expect(fresh.getState().savedIdeas).toEqual([idea])

  // Claimed once and for all: the other store sees its own (empty) slice.
  freshAuth.setState({ company: BETA })
  expect(fresh.getState().pinnedIds).toEqual([])
  freshAuth.setState({ company: ALDER })
  expect(fresh.getState().pinnedIds).toEqual(['legacy-1'])
})
