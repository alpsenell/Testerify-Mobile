import { LEGACY_SCOPE, NO_COMPANY, claimLegacy, scopeFor } from '../tenantScope'

type Slice = { ids: string[] }
const merge = (legacy: Slice, existing: Slice | undefined): Slice =>
  existing ? { ids: Array.from(new Set([...legacy.ids, ...existing.ids])) } : legacy

test('scopeFor falls back to the signed-out bucket', () => {
  expect(scopeFor('c1')).toBe('c1')
  expect(scopeFor(null)).toBe(NO_COMPANY)
  expect(scopeFor(undefined)).toBe(NO_COMPANY)
})

test('claimLegacy moves parked data into the given company and drops the parking slot', () => {
  const next = claimLegacy<Slice>({ [LEGACY_SCOPE]: { ids: ['a'] } }, 'c1', merge)
  expect(next).toEqual({ c1: { ids: ['a'] } })
})

test('claimLegacy merges rather than clobbering what the company already has', () => {
  const next = claimLegacy<Slice>({ [LEGACY_SCOPE]: { ids: ['a'] }, c1: { ids: ['b'] } }, 'c1', merge)
  expect(next.c1.ids.sort()).toEqual(['a', 'b'])
  expect(next[LEGACY_SCOPE]).toBeUndefined()
})

test('claimLegacy leaves other companies untouched', () => {
  const next = claimLegacy<Slice>({ [LEGACY_SCOPE]: { ids: ['a'] }, c2: { ids: ['z'] } }, 'c1', merge)
  expect(next.c2).toEqual({ ids: ['z'] })
})

test('claimLegacy refuses to hand parked data to the signed-out bucket', () => {
  const before = { [LEGACY_SCOPE]: { ids: ['a'] } }
  expect(claimLegacy<Slice>(before, NO_COMPANY, merge)).toBe(before)
})

test('claimLegacy is a no-op (same reference) when there is nothing parked', () => {
  const before = { c1: { ids: ['a'] } }
  expect(claimLegacy<Slice>(before, 'c1', merge)).toBe(before)
})
