import { apiFetch } from './client'

export type AiIdea = {
  title: string; hypothesis: string; element: string | null; change: string | null
  evidence: string | null; page: string | null; path: string | null; metric: string | null
  impact: 'high' | 'medium' | 'low'; difficulty: 'easy' | 'medium' | 'hard'
}
export type SavedSuggestions = { ideas: AiIdea[]; source: 'you' | 'company' | null; goal: string | null; generatedAt: string | null }

export const fetchSuggestions = () => apiFetch<SavedSuggestions>('/api/ai/suggestions')
export const generateSuggestions = (goal: string) =>
  apiFetch<{ ideas: AiIdea[] }>('/api/ai/suggestions', { method: 'POST', body: JSON.stringify({ goal }) })
export const generateTestDraft = (input: { name: string; goal: string; path?: string | null }) =>
  apiFetch<{ campaign: { id: string }; hypothesis: string | null }>('/api/ai/generate-test', {
    method: 'POST',
    body: JSON.stringify({ name: input.name, goal: input.goal, ...(input.path ? { path: input.path } : {}) }),
  })
