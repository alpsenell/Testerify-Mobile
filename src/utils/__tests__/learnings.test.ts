import type { CampaignListItem } from '../../api/campaigns'
import { concludedAt, filterLearnings, isConcluded, learningCounts, outcomeLabel, toLearnings, wonLearning } from '../learnings'

const base: CampaignListItem = {
  id: 'c1', name: 'Single-column checkout form', kind: 'ab', status: 'rollout',
  targetUrl: '/checkout', goals: null, rollout: null, learningNote: null,
  startsAt: '2026-06-24T00:00:00Z', endsAt: null, createdAt: '2026-06-20T00:00:00Z', updatedAt: '2026-07-08T00:00:00Z',
  variants: 2, visitors: 21400, conversions: 900, revenue: 12000, conversionRate: 4.2,
  started: '2026-06-24T00:00:00Z',
  control: null, challenger: null,
  uplift: 11.5, confidence: 99, pValue: 0.01, sigStatus: 'winning',
  forecast: null, trend: [],
}

const make = (over: Partial<CampaignListItem>): CampaignListItem => ({ ...base, ...over })

const won = make({
  id: 'won', rollout: { winnerVariantId: 'v2', promotedAt: '2026-07-08T00:00:00Z', uplift: 11.5, confidence: 99 },
  learningNote: 'Trimming the payment step paid for itself.',
})
const noWinner = make({
  id: 'nowin', name: 'Hero image: lifestyle vs product-only', status: 'completed',
  rollout: null, endsAt: '2026-06-30T00:00:00Z', uplift: 0.4, confidence: 61, sigStatus: 'inconclusive',
  learningNote: null,
})
const running = make({ id: 'run', status: 'running', rollout: null })
const draft = make({ id: 'draft', status: 'draft', rollout: null })

test('only shipped/completed campaigns count as concluded', () => {
  expect(isConcluded(won)).toBe(true)
  expect(isConcluded(noWinner)).toBe(true)
  expect(isConcluded(running)).toBe(false)
  expect(isConcluded(draft)).toBe(false)
  expect(isConcluded(make({ status: 'paused', rollout: null }))).toBe(false)
})

test('a promoted challenger is the win — everything else concluded is not', () => {
  expect(wonLearning(won)).toBe(true)
  expect(wonLearning(noWinner)).toBe(false)
})

test('concludedAt prefers the promotion date, then the end date', () => {
  expect(concludedAt(won)).toBe('2026-07-08T00:00:00Z')
  expect(concludedAt(noWinner)).toBe('2026-06-30T00:00:00Z')
  expect(concludedAt(make({ rollout: null, endsAt: null, status: 'completed' }))).toBeNull()
})

test('outcome label uses the rollout record when it carries uplift/confidence', () => {
  expect(outcomeLabel(won)).toBe('Won +11.5% · 99% conf.')
})

test('outcome label falls back to the campaign-level stats when the rollout omits them', () => {
  const sparse = make({ rollout: { winnerVariantId: 'v2', promotedAt: '2026-07-08T00:00:00Z' } })
  expect(outcomeLabel(sparse)).toBe('Won +11.5% · 99% conf.')
})

test('outcome label degrades to a bare "Won" when no uplift figure exists', () => {
  const bare = make({ rollout: { winnerVariantId: 'v2', promotedAt: '2026-07-08T00:00:00Z' }, uplift: 0, confidence: 0 })
  expect(outcomeLabel(bare)).toBe('Won')
})

test('outcome label for a concluded test with no promotion', () => {
  expect(outcomeLabel(noWinner)).toBe('No winner')
})

test('toLearnings keeps only concluded campaigns, newest conclusion first', () => {
  const older = make({ id: 'older', status: 'completed', rollout: null, endsAt: '2026-05-18T00:00:00Z' })
  const rows = toLearnings([older, running, won, draft, noWinner])
  expect(rows.map((r) => r.id)).toEqual(['won', 'nowin', 'older'])
})

test('rows with no conclusion date sort last rather than being dropped', () => {
  const undated = make({ id: 'undated', status: 'completed', rollout: null, endsAt: null })
  const rows = toLearnings([undated, noWinner])
  expect(rows.map((r) => r.id)).toEqual(['nowin', 'undated'])
})

test('filter narrows to won / no-winner', () => {
  const rows = toLearnings([won, noWinner])
  expect(filterLearnings(rows, 'all', '').map((r) => r.id)).toEqual(['won', 'nowin'])
  expect(filterLearnings(rows, 'won', '').map((r) => r.id)).toEqual(['won'])
  expect(filterLearnings(rows, 'nowinner', '').map((r) => r.id)).toEqual(['nowin'])
})

test('search matches name and note, case-insensitively, and trims', () => {
  const rows = toLearnings([won, noWinner])
  expect(filterLearnings(rows, 'all', 'HERO').map((r) => r.id)).toEqual(['nowin'])
  expect(filterLearnings(rows, 'all', '  payment step ').map((r) => r.id)).toEqual(['won'])
  expect(filterLearnings(rows, 'all', 'nothing here')).toEqual([])
})

test('search and filter compose', () => {
  const rows = toLearnings([won, noWinner])
  expect(filterLearnings(rows, 'won', 'hero')).toEqual([])
})

test('counts are computed over the unfiltered rows', () => {
  expect(learningCounts(toLearnings([won, noWinner, running]))).toEqual({ all: 2, won: 1, nowinner: 1 })
})
