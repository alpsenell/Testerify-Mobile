import { API_URL } from './config'
import { getTokens, setTokens, clearTokens } from './tokens'

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown) {
    super((body as { error?: string })?.error ?? `Request failed (${status})`)
    this.status = status
    this.body = body
  }
}

let sessionExpiredCb: (() => void) | null = null
export function onSessionExpired(cb: () => void) { sessionExpiredCb = cb }

// Single-flight: concurrent 401s share one refresh (backend rotates with a
// 60s grace window, but one request is still the polite shape).
let refreshing: Promise<boolean> | null = null

async function refreshTokens(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const tokens = await getTokens()
      if (!tokens) return false
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refresh }),
      })
      if (!res.ok) return false
      const body = (await res.json()) as { tokens?: { accessToken: string; refreshToken: string } }
      if (!body.tokens) return false
      await setTokens({ access: body.tokens.accessToken, refresh: body.tokens.refreshToken })
      return true
    })().finally(() => { refreshing = null })
  }
  return refreshing
}

export async function apiFetch<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth = true, headers, ...rest } = init
  const doFetch = async (): Promise<Response> => {
    const tokens = auth ? await getTokens() : null
    return fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(tokens ? { Authorization: `Bearer ${tokens.access}` } : {}),
        ...(headers as Record<string, string>),
      },
    })
  }

  let res = await doFetch()
  if (res.status === 401 && auth) {
    const refreshed = await refreshTokens()
    if (!refreshed) {
      await clearTokens()
      sessionExpiredCb?.()
      throw new ApiError(401, await res.json().catch(() => null))
    }
    res = await doFetch()
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}
