import { compact, pct, signedPct, money, relTime, daysBetween } from '../format'

const NOW = new Date('2026-07-25T12:00:00Z')

test('compact', () => {
  expect(compact(920)).toBe('920')
  expect(compact(48234)).toBe('48.2k')
  expect(compact(6100)).toBe('6.1k')
  expect(compact(1240000)).toBe('1.2m')
  expect(compact(0)).toBe('0')
  expect(compact(999999)).toBe('1m')
  expect(compact(999949)).toBe('999.9k')
})

test('pct / signedPct', () => {
  expect(pct(14.234)).toBe('14.2%')
  expect(pct(97, 0)).toBe('97%')
  expect(signedPct(14.2)).toBe('+14.2%')
  expect(signedPct(-1.4)).toBe('−1.4%')
})

test('money', () => {
  expect(money(41235, 'USD')).toBe('$41.2k')
  expect(money(52, 'USD')).toBe('$52')
  expect(money(41235, null)).toBe('41.2k')
  expect(money(9800, 'SEK')).toBe('9.8k SEK')
  expect(money(-41235, 'USD')).toBe('−$41.2k')
  expect(money(-310, 'USD')).toBe('−$310')
})

test('relTime', () => {
  expect(relTime('2026-07-25T10:00:00Z', NOW)).toBe('2 hours ago')
  expect(relTime('2026-07-25T11:59:40Z', NOW)).toBe('just now')
  expect(relTime('2026-07-25T11:42:00Z', NOW)).toBe('18 mins ago')
  expect(relTime('2026-07-24T09:00:00Z', NOW)).toBe('Yesterday')
  expect(relTime('2026-07-21T09:00:00Z', NOW)).toBe('Jul 21')
  // DST-sensitive test: UTC arithmetic must stay stable
  const DST_NOW = new Date('2026-03-08T23:00:00Z')
  expect(relTime('2026-03-07T12:00:00Z', DST_NOW)).toBe('Yesterday')
})

test('daysBetween', () => {
  expect(daysBetween('2026-07-16T00:00:00Z', NOW)).toBe(9)
})
