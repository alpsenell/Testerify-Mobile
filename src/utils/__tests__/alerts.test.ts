import { deriveAlerts } from '../alerts'
import { pct, signedPct, relTime } from '../format'
import { rollbackUntil } from '../testModel'
import type { CampaignListItem } from '../../api/campaigns'

const NOW = new Date('2026-07-25T12:00:00Z')

const base = {
  kind: 'ab' as const, targetUrl: null, goals: null, learningNote: null, startsAt: null,
  createdAt: '2026-07-01T00:00:00Z', started: '2026-07-01T00:00:00Z',
  variants: 2, visitors: 12000, conversions: 500, revenue: 10000, conversionRate: 4.1,
  control: null, pValue: 0.02, forecast: null, trend: [] as number[],
}

// Winning-running test — updatedAt is today (same UTC calendar day as NOW).
const WINNING_RUNNING: CampaignListItem = {
  ...base,
  id: 'c1', name: 'PDP: sticky add-to-cart', status: 'running',
  rollout: null, endsAt: null, updatedAt: '2026-07-25T09:00:00Z',
  challenger: { id: 'v2', name: 'Sticky bar', visitors: 6000, conversions: 300, impressions: 6000, revenue: 5000, rate: 5 },
  uplift: 14.2, confidence: 97, sigStatus: 'winning',
}

// Shipped 3 days ago — lands in "This week".
const RECENT_ROLLOUT: CampaignListItem = {
  ...base,
  id: 'c2', name: 'Homepage: hero video autoplay', status: 'rollout',
  rollout: { winnerVariantId: 'v2', promotedAt: '2026-07-22T12:00:00Z', uplift: 9.4 },
  endsAt: null, updatedAt: '2026-07-22T12:00:00Z',
  challenger: null, uplift: 9.4, confidence: 96, sigStatus: 'winning',
}

// Concluded 10 days ago with a winner — lands in "Earlier".
const CONCLUDED_WITH_WINNER: CampaignListItem = {
  ...base,
  id: 'c3', name: 'Checkout: one-click upsell', status: 'completed',
  rollout: { winnerVariantId: 'v2', promotedAt: '2026-07-14T00:00:00Z', uplift: 6.5 },
  endsAt: '2026-07-15T12:00:00Z', updatedAt: '2026-07-15T12:00:00Z',
  challenger: null, uplift: 6.5, confidence: 98, sigStatus: 'winning',
}

// Concluded 2 days ago with no winner — lands in "This week".
const CONCLUDED_NO_WINNER: CampaignListItem = {
  ...base,
  id: 'c4', name: 'Cart: free-shipping banner', status: 'completed',
  rollout: null, endsAt: '2026-07-23T12:00:00Z', updatedAt: '2026-07-23T12:00:00Z',
  challenger: null, uplift: -1.2, confidence: 40, sigStatus: 'inconclusive',
}

// Concluded 20 days ago — beyond the 14-day cap, must be excluded entirely.
const OLD_CONCLUDED: CampaignListItem = {
  ...base,
  id: 'c5', name: 'Footer: newsletter signup', status: 'completed',
  rollout: null, endsAt: '2026-07-05T12:00:00Z', updatedAt: '2026-07-05T12:00:00Z',
  challenger: null, uplift: 0, confidence: 0, sigStatus: 'not_enough_data',
}

test('winning running test → ship_ready in Today', () => {
  const groups = deriveAlerts([WINNING_RUNNING], NOW)
  const today = groups.find((g) => g.label === 'Today')
  expect(today).toBeTruthy()
  expect(today!.items).toHaveLength(1)
  const item = today!.items[0]
  expect(item.id).toBe('ship_ready:c1')
  expect(item.kind).toBe('ship_ready')
  expect(item.campaignId).toBe('c1')
  expect(item.tone).toBe('pos')
  expect(item.at).toBe('2026-07-25T09:00:00Z')
  expect(item.title).toBe(`PDP: sticky add-to-cart reached ${pct(97, 0)} confidence`)
  expect(item.title).toContain('reached')
  expect(item.body).toBe(`Sticky bar is up ${signedPct(14.2)}. Review and ship it.`)
})

test('ship_ready body falls back to "The challenger" when there is no named challenger', () => {
  const noChallenger: CampaignListItem = { ...WINNING_RUNNING, id: 'c1b', challenger: null }
  const groups = deriveAlerts([noChallenger], NOW)
  const item = groups.find((g) => g.label === 'Today')!.items[0]
  expect(item.body).toBe(`The challenger is up ${signedPct(14.2)}. Review and ship it.`)
})

test('recent rollout → shipped in This week', () => {
  const groups = deriveAlerts([RECENT_ROLLOUT], NOW)
  const thisWeek = groups.find((g) => g.label === 'This week')
  expect(thisWeek).toBeTruthy()
  const shippedItems = thisWeek!.items.filter((i) => i.kind === 'shipped')
  expect(shippedItems).toHaveLength(1)
  const item = shippedItems[0]
  expect(item.id).toBe('shipped:c2')
  expect(item.campaignId).toBe('c2')
  expect(item.tone).toBe('accent')
  expect(item.at).toBe('2026-07-22T12:00:00Z')
  expect(item.title).toBe('Homepage: hero video autoplay shipped to 100%')
  const rollback = rollbackUntil('2026-07-22T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  expect(item.body).toBe(`Rolled out ${relTime('2026-07-22T12:00:00Z', NOW)} · rollback until ${rollback}`)
})

test('concluded with a winner → Earlier, "Won ..." copy', () => {
  const groups = deriveAlerts([CONCLUDED_WITH_WINNER], NOW)
  const earlier = groups.find((g) => g.label === 'Earlier')
  expect(earlier).toBeTruthy()
  const item = earlier!.items[0]
  expect(item.id).toBe('concluded:c3')
  expect(item.kind).toBe('concluded')
  expect(item.tone).toBe('neutral')
  expect(item.at).toBe('2026-07-15T12:00:00Z')
  expect(item.title).toBe('Checkout: one-click upsell concluded')
  expect(item.body).toBe(`Won ${signedPct(6.5)} — archived in Learnings.`)
})

test('concluded with no winner → "No winner" copy', () => {
  const groups = deriveAlerts([CONCLUDED_NO_WINNER], NOW)
  const thisWeek = groups.find((g) => g.label === 'This week')
  expect(thisWeek).toBeTruthy()
  const item = thisWeek!.items.find((i) => i.kind === 'concluded')
  expect(item).toBeTruthy()
  expect(item!.title).toBe('Cart: free-shipping banner concluded')
  expect(item!.body).toBe('No winner — the result is archived in Learnings.')
})

test('old concluded test (20d) → excluded entirely, even from Earlier', () => {
  const groups = deriveAlerts([OLD_CONCLUDED], NOW)
  expect(groups).toEqual([])
})

test('empty groups are omitted from the result', () => {
  // Only a "This week" item exists — Today and Earlier must not appear as empty groups.
  const groups = deriveAlerts([RECENT_ROLLOUT], NOW)
  expect(groups.map((g) => g.label)).toEqual(['This week'])
})

test('sorted newest-first within groups; empty input → []', () => {
  expect(deriveAlerts([], NOW)).toEqual([])

  const older: CampaignListItem = { ...WINNING_RUNNING, id: 'c6', name: 'Older today alert', updatedAt: '2026-07-25T01:00:00Z' }
  const newer: CampaignListItem = { ...WINNING_RUNNING, id: 'c7', name: 'Newer today alert', updatedAt: '2026-07-25T11:00:00Z' }
  const groups = deriveAlerts([older, newer], NOW)
  const today = groups.find((g) => g.label === 'Today')!
  expect(today.items.map((i) => i.campaignId)).toEqual(['c7', 'c6'])
})

test('mixed campaigns land in the right groups together, newest-first', () => {
  const groups = deriveAlerts([OLD_CONCLUDED, CONCLUDED_WITH_WINNER, RECENT_ROLLOUT, CONCLUDED_NO_WINNER, WINNING_RUNNING], NOW)
  expect(groups.map((g) => g.label)).toEqual(['Today', 'This week', 'Earlier'])

  const today = groups.find((g) => g.label === 'Today')!
  expect(today.items.map((i) => i.id)).toEqual(['ship_ready:c1'])

  const thisWeek = groups.find((g) => g.label === 'This week')!
  // c4 (2026-07-23) is newer than c2 (2026-07-22) → newest-first.
  expect(thisWeek.items.map((i) => i.id)).toEqual(['concluded:c4', 'shipped:c2'])

  const earlier = groups.find((g) => g.label === 'Earlier')!
  expect(earlier.items.map((i) => i.id)).toEqual(['concluded:c3'])
})

test('shipped body forwards the injected `now` to relTime (regression: must not read the wall clock)', () => {
  const promotedAt = '2026-07-25T11:30:00Z' // 30 minutes before the fixed NOW
  const justShipped: CampaignListItem = {
    ...base,
    id: 'c9', name: 'Nav: sticky search bar', status: 'rollout',
    rollout: { winnerVariantId: 'v2', promotedAt, uplift: 5 },
    endsAt: null, updatedAt: promotedAt,
    challenger: null, uplift: 5, confidence: 95, sigStatus: 'winning',
  }
  const groups = deriveAlerts([justShipped], NOW)
  const item = groups.flatMap((g) => g.items).find((i) => i.id === 'shipped:c9')
  expect(item).toBeTruthy()
  // With the real wall clock (the bug this guards against) this would not read "30 mins ago"
  // unless the suite happened to run at exactly this fixed NOW.
  expect(item!.body).toContain('Rolled out 30 mins ago')
})

test('exactly 7 days old lands in "This week" (boundary)', () => {
  const promotedAt = '2026-07-18T12:00:00Z' // exactly 7 days before NOW
  const c: CampaignListItem = {
    ...base,
    id: 'c10', name: 'Boundary: seven days', status: 'rollout',
    rollout: { winnerVariantId: 'v2', promotedAt, uplift: 3 },
    endsAt: null, updatedAt: promotedAt,
    challenger: null, uplift: 3, confidence: 96, sigStatus: 'winning',
  }
  const groups = deriveAlerts([c], NOW)
  expect(groups.map((g) => g.label)).toEqual(['This week'])
  expect(groups[0].items.map((i) => i.id)).toEqual(['shipped:c10'])
})

test('exactly 14 days old lands in "Earlier" (boundary; concluded\'s 14-day cap is inclusive)', () => {
  const anchor = '2026-07-11T12:00:00Z' // exactly 14 days before NOW
  const c: CampaignListItem = {
    ...base,
    id: 'c11', name: 'Boundary: fourteen days', status: 'completed',
    rollout: { winnerVariantId: 'v2', promotedAt: '2026-07-10T00:00:00Z', uplift: 4 },
    endsAt: anchor, updatedAt: anchor,
    challenger: null, uplift: 4, confidence: 97, sigStatus: 'winning',
  }
  const groups = deriveAlerts([c], NOW)
  expect(groups.map((g) => g.label)).toEqual(['Earlier'])
  expect(groups[0].items.map((i) => i.id)).toEqual(['concluded:c11'])
})

test('deriveAlerts defaults `now` to the current time when omitted', () => {
  const real = Date.now()
  const today: CampaignListItem = { ...WINNING_RUNNING, id: 'c8', updatedAt: new Date(real).toISOString() }
  const groups = deriveAlerts([today])
  expect(groups.find((g) => g.label === 'Today')?.items.some((i) => i.campaignId === 'c8')).toBe(true)
})
