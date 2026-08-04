import type { CampaignListItem } from '../../api/campaigns'
import { summarize, upliftLeaderboard, velocity, weekStart } from '../analytics'

const base: CampaignListItem = {
  id: 'x', name: '', kind: 'ab', status: 'completed', targetUrl: null, goals: null,
  rollout: null, learningNote: null,
  startsAt: null, endsAt: null, createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
  variants: 2, visitors: 0, conversions: 0, revenue: 0, conversionRate: 0, started: '2026-06-01T00:00:00Z',
  control: null, challenger: null, uplift: 0, confidence: 0, pValue: 1, sigStatus: 'inconclusive',
  forecast: null, trend: [],
}
const make = (over: Partial<CampaignListItem>): CampaignListItem => ({ ...base, ...over })
const challenger = { id: 'v2', name: 'B', visitors: 0, conversions: 0, impressions: 0, revenue: 0, rate: 0 }

const shipped = (id: string, name: string, uplift: number, revenue = 0) => make({
  id, name, status: 'rollout', revenue, uplift, challenger,
  rollout: { winnerVariantId: 'v2', promotedAt: '2026-07-01T00:00:00Z', uplift },
})

describe('summarize', () => {
  const campaigns = [
    shipped('a', 'Sticky add-to-cart', 14.2, 8000),
    shipped('b', 'Single-column checkout', 11.5, 4000),
    make({ id: 'c', status: 'completed', uplift: 0.4, challenger }),
    make({ id: 'd', status: 'running', uplift: -2, challenger }),
    make({ id: 'e', status: 'draft' }),
  ]

  test('counts launched tests only — drafts have never faced a visitor', () => {
    expect(summarize(campaigns).testsRun).toBe(4)
  })

  test('winners, win rate and the inconclusive remainder', () => {
    const s = summarize(campaigns)
    expect(s.winnersShipped).toBe(2)
    expect(s.winRate).toBe(50)
    expect(s.inconclusive).toBe(2)
  })

  test('average winning uplift averages the winners that carry one', () => {
    expect(summarize(campaigns).avgWinningUplift).toBeCloseTo(12.85)
    expect(summarize(campaigns).winnersWithUplift).toBe(2)
  })

  test('revenue sums the shipped winners', () => {
    expect(summarize(campaigns).revenueFromWinners).toBe(12000)
  })

  test('best names the strongest shipped winner', () => {
    expect(summarize(campaigns).best).toEqual({ name: 'Sticky add-to-cart', uplift: 14.2 })
  })

  test('an empty program divides by nothing instead of NaN', () => {
    expect(summarize([])).toMatchObject({ testsRun: 0, winRate: 0, avgWinningUplift: 0, best: null })
  })

  test('a winner promoted without a recorded uplift is still a win, just not an average', () => {
    const bare = make({ id: 'z', status: 'rollout', rollout: { winnerVariantId: 'v2', promotedAt: '2026-07-01T00:00:00Z' } })
    const s = summarize([bare])
    expect(s.winnersShipped).toBe(1)
    expect(s.winRate).toBe(100)
    expect(s.avgWinningUplift).toBe(0)
    expect(s.best).toBeNull()
  })
})

describe('upliftLeaderboard', () => {
  test('ranks measured tests by uplift, keeping negatives', () => {
    const rows = upliftLeaderboard([
      make({ id: 'a', name: 'A', uplift: 3, challenger }),
      make({ id: 'b', name: 'B', uplift: -6, challenger }),
      make({ id: 'c', name: 'C', uplift: 9, challenger }),
    ])
    expect(rows.map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })

  test('skips drafts, unmeasured tests and zero-uplift rows', () => {
    const rows = upliftLeaderboard([
      make({ id: 'draft', status: 'draft', uplift: 5, challenger }),
      make({ id: 'nochallenger', uplift: 5 }),
      make({ id: 'zero', uplift: 0, challenger }),
      make({ id: 'keep', uplift: 1, challenger }),
    ])
    expect(rows.map((r) => r.id)).toEqual(['keep'])
  })

  test('caps the list', () => {
    const many = Array.from({ length: 10 }, (_, i) => make({ id: `c${i}`, uplift: i + 1, challenger }))
    expect(upliftLeaderboard(many)).toHaveLength(6)
    expect(upliftLeaderboard(many, 3)).toHaveLength(3)
  })
})

describe('velocity', () => {
  // 2026-07-25 is a Saturday; its UTC week starts Monday 2026-07-20.
  const now = new Date('2026-07-25T12:00:00Z')

  test('weekStart snaps to the UTC Monday', () => {
    expect(weekStart('2026-07-25T12:00:00Z').toISOString()).toBe('2026-07-20T00:00:00.000Z')
    expect(weekStart('2026-07-20T00:00:00Z').toISOString()).toBe('2026-07-20T00:00:00.000Z')
    expect(weekStart('2026-07-19T23:59:00Z').toISOString()).toBe('2026-07-13T00:00:00.000Z')
  })

  test('returns 8 weeks, oldest first, ending with the current week', () => {
    const weeks = velocity([], now)
    expect(weeks).toHaveLength(8)
    expect(weeks[0].key).toBe('2026-06-01')
    expect(weeks[7].key).toBe('2026-07-20')
    expect(weeks[7].label).toBe('Jul 20')
    expect(weeks.every((w) => w.started === 0)).toBe(true)
  })

  test('buckets by start date, falling back to createdAt', () => {
    const weeks = velocity([
      make({ id: 'a', startsAt: '2026-07-21T09:00:00Z' }),
      make({ id: 'b', startsAt: '2026-07-23T09:00:00Z' }),
      make({ id: 'c', startsAt: null, createdAt: '2026-07-14T09:00:00Z' }),
      make({ id: 'draft', status: 'draft', startsAt: '2026-07-21T09:00:00Z' }),
    ], now)

    expect(weeks.find((w) => w.key === '2026-07-20')?.started).toBe(2)
    expect(weeks.find((w) => w.key === '2026-07-13')?.started).toBe(1)
  })

  test('ignores tests started outside the window', () => {
    const weeks = velocity([make({ id: 'old', startsAt: '2026-01-05T00:00:00Z' })], now)
    expect(weeks.reduce((sum, w) => sum + w.started, 0)).toBe(0)
  })
})
