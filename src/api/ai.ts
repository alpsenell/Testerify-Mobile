import { apiFetch } from './client'
import type { PageBehaviorResponse } from './stats'

export type AiIdea = {
  title: string; hypothesis: string; element: string | null; change: string | null
  evidence: string | null; page: string | null; path: string | null; metric: string | null
  impact: 'high' | 'medium' | 'low'; difficulty: 'easy' | 'medium' | 'hard'
}
export type SavedSuggestions = { ideas: AiIdea[]; source: 'you' | 'company' | null; goal: string | null; generatedAt: string | null }

// 402 Plan-gated: Growth+ required (Scale-tier feature)
export type AiInsightsResponse = {
  behavior: PageBehaviorResponse
  summary: string
  insights: Array<{ title: string; detail: string; severity: 'high' | 'medium' | 'low' }>
  ideas: Array<{ title: string; hypothesis: string; pageType: string | null; path: string | null; impact: 'high' | 'medium' | 'low' }>
}

export const fetchSuggestions = () => apiFetch<SavedSuggestions>('/api/ai/suggestions')
export const generateSuggestions = (goal: string) =>
  apiFetch<{ ideas: AiIdea[] }>('/api/ai/suggestions', { method: 'POST', body: JSON.stringify({ goal }) })
export const generateTestDraft = (input: { name: string; goal: string; path?: string | null }) =>
  apiFetch<{ campaign: { id: string }; hypothesis: string | null }>('/api/ai/generate-test', {
    method: 'POST',
    body: JSON.stringify({ name: input.name, goal: input.goal, ...(input.path ? { path: input.path } : {}) }),
  })

// 402 Plan-gated: Growth+ required for AI behavior insights
export const fetchInsights = (args: { from: string; to: string }) =>
  apiFetch<AiInsightsResponse>('/api/ai/insights', { method: 'POST', body: JSON.stringify({ from: args.from, to: args.to }) })
