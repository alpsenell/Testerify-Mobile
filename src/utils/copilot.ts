import { colors } from '../theme'
import type { AiIdea } from '../api/ai'

const titleCase = (s: string): string =>
  s.split(/[_\s]+/).filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')

const sentenceCase = (s: string): string => {
  const words = s.split(/[_\s]+/).filter(Boolean).map((w) => w.toLowerCase())
  if (words.length === 0) return ''
  return [words[0][0].toUpperCase() + words[0].slice(1), ...words.slice(1)].join(' ')
}

// 'Product · Add to cart' — page Title Cased (falls back to 'Store'),
// metric (snake_case) sentence-cased and appended when present.
export function ideaTag(idea: AiIdea): string {
  const base = titleCase(idea.page ?? 'store')
  return idea.metric ? `${base} · ${sentenceCase(idea.metric)}` : base
}

export function impactColor(impact: AiIdea['impact']): string {
  if (impact === 'high') return colors.pos
  if (impact === 'medium') return colors.warn
  return colors.muted
}

// Backend clips idea.title to 60 chars anyway — no client-side truncation needed.
export function draftRequestFor(idea: AiIdea): { name: string; goal: string; path?: string | null } {
  return {
    name: idea.title,
    goal: idea.hypothesis,
    ...(idea.path ? { path: idea.path } : {}),
  }
}
