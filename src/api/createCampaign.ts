import { apiFetch } from './client'
import type { CreateCampaignBody } from '../utils/createTest'

// Write-side fetchers for the test wizard. Kept out of ./campaigns (owned by
// the read/list side and edited concurrently) — same apiFetch contract.
// Payload shapes come from src/utils/createTest.ts, which mirrors the server's
// normalizers.

export type CreatedCampaign = { id: string; name: string; status: string; kind: string }

// POST /api/campaigns — always lands as a 'draft' with Control/Variation 1.
// 402 PLAN_LIMIT_REACHED when kind 'personalization' isn't on the plan.
export const createCampaign = (body: CreateCampaignBody) =>
  apiFetch<{ campaign: CreatedCampaign }>('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(body),
  }).then((r) => r.campaign)

// PATCH /api/campaigns/:id — launch ({status:'running'}, can 402 on the
// running-test cap) or schedule ({startsAt, endsAt?}).
export const patchCampaign = (id: string, patch: Record<string, unknown>) =>
  apiFetch<{ campaign: unknown }>(`/api/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
