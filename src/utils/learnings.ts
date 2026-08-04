import type { CampaignListItem } from '../api/campaigns'
import { pct, signedPct } from './format'

export type LearningFilter = 'all' | 'won' | 'nowinner'

// The Learnings archive is the set of tests that stopped collecting: either a
// winner was shipped (`rollout`) or the test was concluded without one
// (`completed`). Running/paused/draft tests still belong to the Tests tab.
export const isConcluded = (c: CampaignListItem) => c.status === 'rollout' || c.status === 'completed'

// Mirrors the panel's LearningsPage.vue outcome(): the win is a challenger
// actually promoted (a rollout record exists). A concluded test without one
// reads as "No winner" regardless of how its significance landed.
export const wonLearning = (c: CampaignListItem) => c.rollout !== null

// When the test stopped collecting — the promotion date for a shipped test,
// otherwise the scheduled end. Null when the backend records neither.
export const concludedAt = (c: CampaignListItem): string | null =>
  c.rollout?.promotedAt ?? c.endsAt ?? null

export function outcomeLabel(c: CampaignListItem): string {
  if (!wonLearning(c)) return 'No winner'
  // The rollout record snapshots the figures at promotion time; fall back to
  // the campaign-level stats when it doesn't carry them (both fields are
  // optional on RolloutRecord).
  const uplift = c.rollout?.uplift ?? c.uplift
  const confidence = c.rollout?.confidence ?? c.confidence
  if (!uplift) return 'Won'
  const conf = confidence ? ` · ${pct(confidence, 0)} conf.` : ''
  return `Won ${signedPct(uplift)}${conf}`
}

// Concluded campaigns, newest conclusion first. Rows the backend gave no
// conclusion date for still render — they sort to the bottom rather than
// disappearing from the archive.
export function toLearnings(campaigns: CampaignListItem[]): CampaignListItem[] {
  return campaigns
    .filter(isConcluded)
    .slice()
    .sort((a, b) => {
      const at = concludedAt(a)
      const bt = concludedAt(b)
      if (!at && !bt) return 0
      if (!at) return 1
      if (!bt) return -1
      return new Date(bt).getTime() - new Date(at).getTime()
    })
}

export function filterLearnings(rows: CampaignListItem[], filter: LearningFilter, query: string): CampaignListItem[] {
  const q = query.trim().toLowerCase()
  return rows.filter((c) => {
    if (filter === 'won' && !wonLearning(c)) return false
    if (filter === 'nowinner' && wonLearning(c)) return false
    return !q || `${c.name} ${c.learningNote ?? ''}`.toLowerCase().includes(q)
  })
}

export const learningCounts = (rows: CampaignListItem[]) => ({
  all: rows.length,
  won: rows.filter(wonLearning).length,
  nowinner: rows.filter((c) => !wonLearning(c)).length,
})
