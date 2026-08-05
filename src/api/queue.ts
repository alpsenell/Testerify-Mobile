import { apiFetch } from './client'

// Transcribed from the panel's api/queue/* + api/_lib/testQueue.js. The
// priority score (3..9, impact weighs double) is derived server-side and
// arrives on every item; it is never stored.
export type QueueImpact = 'high' | 'medium' | 'low'
export type QueueEffort = 'easy' | 'medium' | 'hard'
export type QueueStatus = 'queued' | 'drafted' | 'dismissed'
export type QueueSource = 'ai_scan' | 'revenue_map' | 'manual' | 'followup'

export type QueueItem = {
  id: string
  title: string
  hypothesis: string | null
  element: string | null
  change: string | null
  evidence: string | null
  page: string | null
  path: string | null
  metric: string | null
  impact: QueueImpact
  effort: QueueEffort
  source: QueueSource
  status: QueueStatus
  sourceCampaignId: string | null
  draftedCampaignId: string | null
  createdAt: string
  updatedAt: string
  score: number
}

// Sorted server-side: score desc, oldest first among equals.
export const fetchQueue = () => apiFetch<{ items: QueueItem[] }>('/api/queue').then((r) => r.items)

export const updateQueueItem = (
  id: string,
  patch: Partial<Pick<QueueItem, 'status' | 'impact' | 'effort' | 'draftedCampaignId'>>,
) => apiFetch<{ item: QueueItem }>(`/api/queue/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => r.item)

// Duplicate titles upsert server-side: a dismissed twin revives to 'queued'.
// 409 when the queue is at its cap (100 queued ideas).
export const addQueueItem = (idea: { title: string; hypothesis?: string; page?: string; path?: string; impact?: QueueImpact; effort?: QueueEffort }) =>
  apiFetch<{ item: QueueItem; existed?: boolean }>('/api/queue', {
    method: 'POST',
    body: JSON.stringify({ ...idea, source: 'manual' }),
  })
