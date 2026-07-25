import { confColor, shipReady, verdictFor, statusLabel, rollbackUntil } from '../testModel'
import { colors } from '../../theme'
import type { CampaignListItem } from '../../api/campaigns'

const base = {
  id: 't1', name: 'X', kind: 'ab', status: 'running', targetUrl: null, goals: null,
  rollout: null, learningNote: null, startsAt: null, endsAt: null,
  createdAt: '2026-07-16T00:00:00Z', updatedAt: '2026-07-25T00:00:00Z', started: '2026-07-16T00:00:00Z',
  variants: 2, visitors: 12500, conversions: 576, revenue: 24800, conversionRate: 4.6,
  control: null, challenger: null, uplift: 14.2, confidence: 97, pValue: 0.03,
  sigStatus: 'winning', forecast: null, trend: [],
} as CampaignListItem

test('confColor thresholds', () => {
  expect(confColor(97)).toBe(colors.pos)
  expect(confColor(84)).toBe(colors.warn)
  expect(confColor(38)).toBe(colors.muted)
})

test('shipReady requires running + winning + >=95 + positive uplift', () => {
  expect(shipReady(base)).toBe(true)
  expect(shipReady({ ...base, confidence: 84 })).toBe(false)
  expect(shipReady({ ...base, sigStatus: 'inconclusive' })).toBe(false)
  expect(shipReady({ ...base, status: 'rollout' })).toBe(false)
  expect(shipReady({ ...base, uplift: -2 })).toBe(false)
})

test('verdictFor', () => {
  expect(verdictFor(base).label).toBe('Ship it')
  expect(verdictFor({ ...base, confidence: 71 }).label).toBe('Collecting')
  expect(verdictFor({ ...base, status: 'rollout' }).label).toBe('Shipped')
  expect(verdictFor({ ...base, status: 'draft' }).label).toBe('Draft')
})

test('statusLabel + rollbackUntil', () => {
  expect(statusLabel('rollout')).toBe('Rolled out')
  expect(rollbackUntil('2026-07-25T10:00:00Z').toISOString().slice(0, 10)).toBe('2026-08-24')
})
