import { apiFetch } from './client'

// Transcribed from the panel's api/nudges/index.js + api/_lib/testTemplates.js
// (listNudges / instantiateNudge). GET lists the curated widget catalog; POST
// turns one widget into a DRAFT kind:'nudge' campaign — a Holdout control that
// sees nothing plus one "Nudge" variation. Launching is a separate status
// PATCH (setCampaignStatus in ./campaigns).

export type NudgeParam = {
  key: string
  label: string
  default: string | number
  type?: 'number' | 'color'
  min?: number
  max?: number
  hint?: string
  optional?: boolean
}

export type NudgeTemplate = {
  id: string
  name: string
  description: string
  impact: string
  targeting: unknown
  params: NudgeParam[]
}

export type NudgeCatalog = { nudges: NudgeTemplate[]; defaultHoldout: number }

export const fetchNudgeCatalog = () => apiFetch<NudgeCatalog>('/api/nudges')

export type CreatedNudge = {
  campaign: { id: string; name: string; status: string; kind: string }
  variation: unknown
  // The holdout the server actually stored (clamped 10–50).
  holdout: number
  nudge: { id: string; name: string }
}

export const createNudge = (body: {
  nudgeId: string
  name?: string
  holdout: number
  params: Record<string, string | number>
}) => apiFetch<CreatedNudge>('/api/nudges', { method: 'POST', body: JSON.stringify(body) })
