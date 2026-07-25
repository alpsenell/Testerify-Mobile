import { colors } from '../theme'
import type { PillTone } from '../components/StatusPill'
import type { CampaignListItem, CampaignStatus } from '../api/campaigns'

export const confColor = (confidence: number) =>
  confidence >= 95 ? colors.pos : confidence >= 70 ? colors.warn : colors.muted

export const statusLabel = (s: CampaignStatus) =>
  ({ draft: 'Draft', running: 'Running', paused: 'Paused', rollout: 'Rolled out', completed: 'Completed' })[s]

export const statusTone = (s: CampaignStatus): PillTone =>
  s === 'running' ? 'pos' : s === 'rollout' ? 'accent' : 'neutral'

export const statusPulse = (s: CampaignStatus) => s === 'running'

export const shipReady = (c: CampaignListItem) =>
  c.status === 'running' && c.sigStatus === 'winning' && c.confidence >= 95 && c.uplift > 0

export function verdictFor(c: CampaignListItem): { label: string; tone: PillTone } {
  if (c.status === 'rollout') return { label: 'Shipped', tone: 'accent' }
  if (c.status === 'draft') return { label: 'Draft', tone: 'neutral' }
  if (shipReady(c)) return { label: 'Ship it', tone: 'pos' }
  return { label: 'Collecting', tone: 'neutral' }
}

export const rollbackUntil = (promotedAtIso: string) =>
  new Date(new Date(promotedAtIso).getTime() + 30 * 86_400_000)
