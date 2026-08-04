import type { FunnelStep } from '../../api/stats'
import { biggestDrop, isTracked, stepByKey } from '../funnel'
import { lastNDays } from '../range'

const step = (over: Partial<FunnelStep> & { key: FunnelStep['key'] }): FunnelStep => ({
  label: over.key, source: 'pageview', visitors: 100, notTracked: false, hint: null, note: null,
  reachRate: 100, stepRate: 100, dropOff: 0, ...over,
})

test('a not-tracked step is a gap, not a zero', () => {
  expect(isTracked(step({ key: 'cart' }))).toBe(true)
  expect(isTracked(step({ key: 'cart', notTracked: true, visitors: null }))).toBe(false)
  expect(isTracked(step({ key: 'cart', visitors: null }))).toBe(false)
})

test('biggestDrop picks the worst tracked drop-off', () => {
  const steps = [
    step({ key: 'view', dropOff: null }),
    step({ key: 'product', dropOff: 41.2 }),
    step({ key: 'cart', dropOff: 63.8 }),
    step({ key: 'checkout', dropOff: 12.5 }),
  ]
  expect(biggestDrop(steps)?.key).toBe('cart')
})

test('biggestDrop ignores untracked steps and returns null when nothing qualifies', () => {
  expect(biggestDrop([
    step({ key: 'view', dropOff: null }),
    step({ key: 'cart', notTracked: true, visitors: null, dropOff: 90 }),
  ])).toBeNull()
  expect(biggestDrop([])).toBeNull()
})

test('stepByKey finds a step or returns null', () => {
  const steps = [step({ key: 'view' }), step({ key: 'purchase' })]
  expect(stepByKey(steps, 'purchase')?.key).toBe('purchase')
  expect(stepByKey(steps, 'cart')).toBeNull()
})

test('lastNDays covers an inclusive UTC window ending today', () => {
  expect(lastNDays(7, new Date('2026-07-25T12:00:00Z'))).toEqual({ from: '2026-07-19', to: '2026-07-25' })
  expect(lastNDays(1, new Date('2026-07-25T00:30:00Z'))).toEqual({ from: '2026-07-25', to: '2026-07-25' })
  // Crossing a month boundary.
  expect(lastNDays(7, new Date('2026-08-02T23:00:00Z'))).toEqual({ from: '2026-07-27', to: '2026-08-02' })
})
