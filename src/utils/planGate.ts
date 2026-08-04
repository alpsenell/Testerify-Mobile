import { ApiError } from '../api/client'

// The panel answers 402 PLAN_LIMIT_REACHED for features the store's plan
// doesn't include (AI insights, session replay). That isn't a failure to
// retry — the screen shows an upgrade note instead of a retry card.
export function isPlanGated(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  if (error.status === 402) return true
  const code = (error.body as { code?: string } | null)?.code
  return code === 'PLAN_LIMIT_REACHED'
}
