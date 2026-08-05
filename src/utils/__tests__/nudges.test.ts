import type { CampaignListItem } from '../../api/campaigns'
import { onlyNudges } from '../nudges'

const campaign = (id: string, kind: CampaignListItem['kind']): CampaignListItem => ({
  id, name: id, kind, status: 'running', targetUrl: null, goals: null,
  rollout: null, learningNote: null,
  startsAt: null, endsAt: null, createdAt: '', updatedAt: '',
  variants: 2, visitors: 0, conversions: 0, revenue: 0, conversionRate: 0, started: '',
  control: null, challenger: null, uplift: 0, confidence: 0, pValue: 1, sigStatus: 'inconclusive',
  forecast: null, trend: [],
})

test('keeps nudges and drops every other campaign kind', () => {
  const rows = onlyNudges([
    campaign('n1', 'nudge'),
    campaign('a1', 'ab'),
    campaign('o1', 'offer'),
    campaign('p1', 'personalization'),
    campaign('n2', 'nudge'),
  ])
  expect(rows.map((c) => c.id)).toEqual(['n1', 'n2'])
})

test('an empty campaign list yields no nudges', () => {
  expect(onlyNudges([])).toEqual([])
})
