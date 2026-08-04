import type { UtmSummaryResponse } from '../../api/stats'
import { percentChange, trackingSummary } from '../tracking'

const data = (over: Partial<UtmSummaryResponse> = {}): UtmSummaryResponse => ({
  dimension: 'source', days: 7,
  summary: {
    taggedVisits: 1180, uniqueVisitors: 940, topSource: 'instagram', distinctSources: 6,
    previous: { taggedVisits: 1000, uniqueVisitors: 820 },
  },
  breakdown: [
    { value: 'instagram', visits: 484, visitors: 390, share: 41 },
    { value: 'google', visits: 300, visitors: 250, share: 25.4 },
  ],
  trend: [],
  ...over,
})

test('percentChange refuses to divide by an empty previous period', () => {
  expect(percentChange(120, 100)).toBe(20)
  expect(percentChange(80, 100)).toBe(-20)
  expect(percentChange(10, 0)).toBeNull()
})

test('summary reports the trend and the leading row', () => {
  expect(trackingSummary(data(), 7)).toBe(
    'Tagged visits are up 18% on the previous 7 days. instagram drove 41% of tagged visits.',
  )
})

test('summary drops the trend clause when there is no previous period to compare', () => {
  const d = data()
  d.summary.previous = { taggedVisits: 0, uniqueVisitors: 0 }
  expect(trackingSummary(d, 7)).toBe('instagram drove 41% of tagged visits.')
})

test('summary ignores a negligible change rather than reporting "up 0%"', () => {
  const d = data()
  d.summary.taggedVisits = 1002
  d.summary.previous = { taggedVisits: 1000, uniqueVisitors: 820 }
  expect(trackingSummary(d, 7)).toBe('instagram drove 41% of tagged visits.')
})

test('summary follows the selected dimension, not the source field', () => {
  const d = data({ dimension: 'medium', breakdown: [{ value: 'cpc', visits: 700, visitors: 600, share: 59.3 }] })
  expect(trackingSummary(d, 7)).toContain('cpc drove 59% of tagged visits.')
})

test('summary is null when there is nothing real to say', () => {
  const d = data({ breakdown: [] })
  d.summary.previous = { taggedVisits: 0, uniqueVisitors: 0 }
  expect(trackingSummary(d, 7)).toBeNull()
})
