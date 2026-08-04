import type { CampaignListItem } from '../api/campaigns'
import { wonLearning } from './learnings'

// Everything here is derived from the campaigns list — there is no
// program-level analytics endpoint. Every figure therefore traces back to a
// real campaign field; nothing is modelled or extrapolated.

export type AnalyticsSummary = {
  testsRun: number
  winnersShipped: number
  winRate: number
  avgWinningUplift: number
  winnersWithUplift: number
  revenueFromWinners: number
  inconclusive: number
  best: { name: string; uplift: number } | null
}

// A draft has never been in front of a visitor, so it isn't a test "run".
const launched = (c: CampaignListItem) => c.status !== 'draft'

// The uplift recorded at promotion time, falling back to the campaign's
// current figure when the rollout record doesn't carry one.
const winnerUplift = (c: CampaignListItem) => c.rollout?.uplift ?? c.uplift

export function summarize(campaigns: CampaignListItem[]): AnalyticsSummary {
  const run = campaigns.filter(launched)
  const winners = run.filter(wonLearning)
  const withUplift = winners.filter((c) => winnerUplift(c) > 0)
  const upliftTotal = withUplift.reduce((sum, c) => sum + winnerUplift(c), 0)

  const best = withUplift.reduce<{ name: string; uplift: number } | null>((top, c) => {
    const uplift = winnerUplift(c)
    return !top || uplift > top.uplift ? { name: c.name, uplift } : top
  }, null)

  return {
    testsRun: run.length,
    winnersShipped: winners.length,
    winRate: run.length === 0 ? 0 : Math.round(winners.length / run.length * 100),
    avgWinningUplift: withUplift.length === 0 ? 0 : upliftTotal / withUplift.length,
    winnersWithUplift: withUplift.length,
    revenueFromWinners: winners.reduce((sum, c) => sum + c.revenue, 0),
    inconclusive: run.length - winners.length,
    best,
  }
}

export type UpliftRow = { id: string; name: string; uplift: number }

// Measured tests only: a campaign with no challenger has no uplift to rank.
// Ties keep the backend's order; the caller renders bars relative to the
// largest absolute value so a big negative still reads at full width.
export function upliftLeaderboard(campaigns: CampaignListItem[], limit = 6): UpliftRow[] {
  return campaigns
    .filter((c) => launched(c) && c.challenger !== null && c.uplift !== 0)
    .map((c) => ({ id: c.id, name: c.name, uplift: c.uplift }))
    .sort((a, b) => b.uplift - a.uplift)
    .slice(0, limit)
}

export type VelocityWeek = { key: string; label: string; started: number }

// UTC Monday of the week containing `d` — the shared bucket key for velocity,
// so counts don't drift with the device timezone (same rule as dayKey()).
export function weekStart(d: Date | string): Date {
  const date = typeof d === 'string' ? new Date(d) : d
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dow = (utc.getUTCDay() + 6) % 7 // Monday = 0
  utc.setUTCDate(utc.getUTCDate() - dow)
  return utc
}

// Tests started per week for the last `weeks` weeks, oldest first. A test's
// start is startsAt when the backend has one, else when it was created.
export function velocity(campaigns: CampaignListItem[], now: Date = new Date(), weeks = 8): VelocityWeek[] {
  const thisWeek = weekStart(now)
  const buckets = new Map<string, VelocityWeek>()

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek.getTime() - i * 7 * 86_400_000)
    const key = start.toISOString().slice(0, 10)
    buckets.set(key, {
      key,
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      started: 0,
    })
  }

  for (const c of campaigns) {
    if (!launched(c)) continue
    const key = weekStart(c.startsAt ?? c.createdAt).toISOString().slice(0, 10)
    const bucket = buckets.get(key)
    if (bucket) bucket.started += 1
  }

  return [...buckets.values()]
}
