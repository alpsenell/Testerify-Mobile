import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFavorites } from '../favorites'
import type { AiIdea } from '../../api/ai'

const KEY = 'testerify.favorites'

const idea: AiIdea = {
  title: 'Add urgency copy to PDP', hypothesis: 'Scarcity nudges lift conversion on PDPs',
  element: '.add-to-cart', change: 'Add low-stock badge', evidence: 'Heatmap shows drop-off near CTA',
  page: 'Product', path: '/products/[slug]', metric: 'Add to cart rate',
  impact: 'high', difficulty: 'easy',
}

// The mock's __INTERNAL_MOCK_STORAGE__ is a plain object shared by every
// setItem/getItem call for the lifetime of this test file's module registry
// (see jest.setup.js) — clear it between tests so persistence assertions
// don't see leftovers from a previous test.
beforeEach(async () => {
  useFavorites.setState({ pinnedIds: [], savedIdeas: [] })
  await AsyncStorage.clear()
  ;(AsyncStorage.setItem as jest.Mock).mockClear()
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

test('persists pinnedIds and savedIdeas to AsyncStorage under a stable, namespaced key', async () => {
  useFavorites.getState().togglePin('t1')
  await flushLastWrite()
  useFavorites.getState().saveIdea(idea)
  await flushLastWrite()

  const raw = await AsyncStorage.getItem(KEY)
  expect(raw).not.toBeNull()
  const parsed = JSON.parse(raw as string)
  expect(parsed.state.pinnedIds).toEqual(['t1'])
  expect(parsed.state.savedIdeas).toEqual([idea])
})

test('rehydrates pinnedIds and savedIdeas from AsyncStorage on a fresh module load', async () => {
  // jest.resetModules() clears the registry that both the store module and
  // the mocked AsyncStorage module live in, so re-require both together
  // (in that order) to seed the same fresh mock instance the fresh store
  // will read from.
  jest.resetModules()
  const freshAsyncStorage = require('@react-native-async-storage/async-storage')
  await freshAsyncStorage.setItem(
    KEY,
    JSON.stringify({ state: { pinnedIds: ['x1'], savedIdeas: [idea] }, version: 0 }),
  )
  const { useFavorites: freshUseFavorites } = require('../favorites')

  // The store auto-hydrates on creation (fire-and-forget); rehydrate() is
  // idempotent, so awaiting it here guarantees hydration has finished.
  await freshUseFavorites.persist.rehydrate()

  expect(freshUseFavorites.getState().pinnedIds).toEqual(['x1'])
  expect(freshUseFavorites.getState().savedIdeas).toEqual([idea])
  // actions must survive hydration merge, not just data
  expect(typeof freshUseFavorites.getState().togglePin).toBe('function')
})
