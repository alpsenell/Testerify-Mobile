import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAlertsRead } from '../alertsRead'

const KEY = 'testerify.alertsRead'

beforeEach(async () => {
  useAlertsRead.setState({ readIds: [] })
  await AsyncStorage.clear()
  ;(AsyncStorage.setItem as jest.Mock).mockClear()
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
// These two tests were unaffected by the upgrade (see below); the following
// are new, covering the persistence round-trip and hydration that Task 3
// requires. Same deterministic-flush technique as favorites.test.ts: await
// the exact promise the last setItem call returned instead of guessing at a
// number of microtask ticks.
async function flushLastWrite() {
  const calls = (AsyncStorage.setItem as jest.Mock).mock.results
  await calls[calls.length - 1]?.value
}

test('persists readIds to AsyncStorage under a stable, namespaced key', async () => {
  useAlertsRead.getState().markAllRead(['a', 'b'])
  await flushLastWrite()

  const raw = await AsyncStorage.getItem(KEY)
  expect(raw).not.toBeNull()
  const parsed = JSON.parse(raw as string)
  expect(parsed.state.readIds.sort()).toEqual(['a', 'b'])
})

test('rehydrates readIds from AsyncStorage on a fresh module load', async () => {
  // jest.resetModules() clears the registry that both the store module and
  // the mocked AsyncStorage module live in, so re-require both together (in
  // that order) to seed the same fresh mock instance the fresh store reads.
  jest.resetModules()
  const freshAsyncStorage = require('@react-native-async-storage/async-storage')
  await freshAsyncStorage.setItem(KEY, JSON.stringify({ state: { readIds: ['z1'] }, version: 0 }))
  const { useAlertsRead: freshUseAlertsRead } = require('../alertsRead')

  // The store auto-hydrates on creation (fire-and-forget); rehydrate() is
  // idempotent, so awaiting it here guarantees hydration has finished.
  await freshUseAlertsRead.persist.rehydrate()

  expect(freshUseAlertsRead.getState().readIds).toEqual(['z1'])
  expect(typeof freshUseAlertsRead.getState().markAllRead).toBe('function')
})
