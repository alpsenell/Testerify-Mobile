import { apiFetch } from './client'

export type CampaignStatus = 'draft' | 'running' | 'paused' | 'rollout' | 'completed'
export type SigStatus = 'winning' | 'losing' | 'inconclusive' | 'not_enough_data'
export type VariantSummary = { id: string; name: string; visitors: number; conversions: number; impressions: number; revenue: number; rate: number }
export type RolloutRecord = { winnerVariantId: string; promotedAt: string; decision?: string; confidence?: number; uplift?: number } | null
export type CampaignListItem = {
  id: string; name: string; kind: 'ab' | 'nudge' | 'offer' | 'personalization'
  status: CampaignStatus; targetUrl: string | null; goals: unknown
  rollout: RolloutRecord; learningNote: string | null
  startsAt: string | null; endsAt: string | null; createdAt: string; updatedAt: string
  variants: number; visitors: number; conversions: number; revenue: number; conversionRate: number
  started: string
  control: VariantSummary | null; challenger: VariantSummary | null
  uplift: number; confidence: number; pValue: number; sigStatus: SigStatus
  forecast: { state: 'no_traffic' | 'forecast' | 'unreliable' | 'ready'; days?: number } | null
  trend: number[]
}
export type CampaignVariant = { id: string; name: string; isControl: boolean; stats: { visitors: number; conversions: number; impressions: number; revenue: number } }
export type Significance = { controlRate: number; variantRate: number; uplift: number; confidence: number; pValue: number; status: SigStatus }
export type CampaignDetailData = {
  id: string; name: string; status: CampaignStatus; kind: string
  targetUrl: string | null; startsAt: string | null; endsAt: string | null; createdAt: string
  rollout: RolloutRecord; learningNote: string | null
  variants: CampaignVariant[]
  stats: { visitors: number; conversions: number; impressions: number; revenue: number }
  forecast: unknown
  timeline: { labels: string[]; byVariant: Record<string, number[]> }
  revenueCurrency: { code: string | null; mixed: boolean }
  impact: unknown
  controlId: string | null; challengerId: string | null
  significance: Significance | null
}

export const fetchCampaigns = () => apiFetch<{ campaigns: CampaignListItem[] }>('/api/campaigns').then(r => r.campaigns)
export const fetchCampaign = (id: string) => apiFetch<{ campaign: CampaignDetailData }>(`/api/campaigns/${id}`).then(r => r.campaign)
export const promoteCampaign = (id: string, variantId: string) =>
  apiFetch<{ campaign: unknown; rollout: unknown }>(`/api/campaigns/${id}`, { method: 'POST', body: JSON.stringify({ action: 'promote', variantId }) })
export const updateLearningNote = (id: string, learningNote: string) =>
  apiFetch<{ campaign: unknown }>(`/api/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify({ learningNote }) })
export const rollbackCampaign = (id: string) =>
  apiFetch<{ campaign: unknown }>(`/api/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'running' }) })
