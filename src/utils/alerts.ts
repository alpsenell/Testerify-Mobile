import type { CampaignListItem } from '../api/campaigns'
import { shipReady, rollbackUntil } from './testModel'
import { pct, signedPct, relTime, dayKey, shortDate } from './format'

export type AlertKind = 'ship_ready' | 'shipped' | 'concluded'

export type AlertItem = {
  id: string // `${kind}:${campaignId}`
  kind: AlertKind
  campaignId: string
  title: string
  body: string
  at: string // ISO
  tone: 'pos' | 'accent' | 'neutral'
}

export type AlertGroupLabel = 'Today' | 'This week' | 'Earlier'
export type AlertGroup = { label: AlertGroupLabel; items: AlertItem[] }

const daysAgo = (iso: string, now: Date) => Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)

function alertFor(c: CampaignListItem, now: Date): AlertItem | null {
  if (shipReady(c)) {
    return {
      id: `ship_ready:${c.id}`,
      kind: 'ship_ready',
      campaignId: c.id,
      title: `${c.name} reached ${pct(c.confidence, 0)} confidence`,
      body: `${c.challenger?.name ?? 'The challenger'} is up ${signedPct(c.uplift)}. Review and ship it.`,
      at: c.updatedAt,
      tone: 'pos',
    }
  }

  if (c.status === 'rollout' && c.rollout) {
    const rollback = shortDate(rollbackUntil(c.rollout.promotedAt))
    return {
      id: `shipped:${c.id}`,
      kind: 'shipped',
      campaignId: c.id,
      title: `${c.name} shipped to 100%`,
      body: `Rolled out ${relTime(c.rollout.promotedAt, now)} · rollback until ${rollback}`,
      at: c.rollout.promotedAt,
      tone: 'accent',
    }
  }

  if (c.status === 'completed') {
    const anchor = c.endsAt ?? c.updatedAt
    return {
      id: `concluded:${c.id}`,
      kind: 'concluded',
      campaignId: c.id,
      title: `${c.name} concluded`,
      body: c.rollout
        ? `Won ${signedPct(c.rollout.uplift ?? 0)} — archived in Learnings.`
        : 'No winner — the result is archived in Learnings.',
      at: anchor,
      tone: 'neutral',
    }
  }

  return null
}

// `now` defaults to the current time — the only place "now" is computed;
// everything below only ever reads the `now` parameter, never Date.now()/new Date() directly,
// so the function stays pure and deterministic under test.
export function deriveAlerts(campaigns: CampaignListItem[], now: Date = new Date()): AlertGroup[] {
  const items = campaigns
    .map((c) => alertFor(c, now))
    .filter((item): item is AlertItem => item !== null)

  const today: AlertItem[] = []
  const thisWeek: AlertItem[] = []
  const earlier: AlertItem[] = []

  for (const item of items) {
    const age = daysAgo(item.at, now)
    if (dayKey(new Date(item.at)) === dayKey(now)) today.push(item)
    else if (age >= 0 && age <= 7) thisWeek.push(item)
    else if (age > 7 && age <= 14) earlier.push(item)
    // older than 14 days (or negative/future beyond today) is dropped
  }

  const byNewestFirst = (a: AlertItem, b: AlertItem) => new Date(b.at).getTime() - new Date(a.at).getTime()
  today.sort(byNewestFirst)
  thisWeek.sort(byNewestFirst)
  earlier.sort(byNewestFirst)

  const groups: AlertGroup[] = []
  if (today.length) groups.push({ label: 'Today', items: today })
  if (thisWeek.length) groups.push({ label: 'This week', items: thisWeek })
  if (earlier.length) groups.push({ label: 'Earlier', items: earlier })
  return groups
}
