import { create } from 'zustand'
import { apiFetch, onSessionExpired } from '../api/client'
import { getTokens, setTokens, clearTokens } from '../api/tokens'

export type User = { id: string; name: string; email: string; role: string }
export type Company = { id: string; name: string; slug: string; websiteUrl: string | null }

type LoginResponse = {
  user: User
  company: Company
  stores: unknown[]
  tokens?: { accessToken: string; refreshToken: string }
}

type AuthState = {
  status: 'restoring' | 'signedOut' | 'signedIn'
  user: User | null
  company: Company | null
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  restore(): Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  status: 'restoring',
  user: null,
  company: null,

  async signIn(email, password) {
    const res = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password, includeTokens: true }),
    })
    if (!res.tokens) throw new Error('Backend did not return tokens — is Task 1 deployed?')
    await setTokens({ access: res.tokens.accessToken, refresh: res.tokens.refreshToken })
    set({ status: 'signedIn', user: res.user, company: res.company })
  },

  async signOut() {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    await clearTokens()
    set({ status: 'signedOut', user: null, company: null })
  },

  async restore() {
    try {
      const tokens = await getTokens()
      if (!tokens) return set({ status: 'signedOut', user: null, company: null })
      const me = await apiFetch<{ user: User; company: Company }>('/api/auth/me')
      set({ status: 'signedIn', user: me.user, company: me.company })
    } catch {
      try {
        await clearTokens()
      } catch {
        // best-effort: we're already failing closed to signedOut regardless
      }
      set({ status: 'signedOut', user: null, company: null })
    }
  },
}))

onSessionExpired(() => {
  useAuth.setState({ status: 'signedOut', user: null, company: null })
})
