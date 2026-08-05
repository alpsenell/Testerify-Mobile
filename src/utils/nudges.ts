import type { CampaignListItem } from '../api/campaigns'

// Nudges have no endpoint of their own — they are campaigns with kind
// 'nudge' (see the Phase 3 spec §2). Everything else on the campaign means
// the same thing it does for an A/B test, holdout included: the control
// variant IS the holdout.
export const onlyNudges = (campaigns: CampaignListItem[]): CampaignListItem[] =>
  campaigns.filter((c) => c.kind === 'nudge')
