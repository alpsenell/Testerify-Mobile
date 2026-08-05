import { create } from 'zustand'
import { apiFetch, onSessionExpired } from '../api/client'
import { getTokens, setTokens, clearTokens } from '../api/tokens'
import { registerForPush, unregisterPush } from '../notifications'
import type { SessionCompany, SessionResponse, SessionUser, SwitchStoreResponse } from '../api/auth'

export type User = SessionUser
export type Company = SessionCompany

type AuthState = {
  status: 'restoring' | 'signedOut' | 'signedIn'
  user: User | null
  company: Company | null
  signIn(email: string, password: string): Promise<void>
  signUp(companyName: string, name: string, email: string, password: string): Promise<void>
  acceptInvite(token: string, name: string, password: string): Promise<void>
  switchStore(companyId: string): Promise<Company>
  signOut(): Promise<void>
  restore(): Promise<void>
}

// The three ways into a session (sign in / sign up / accept an invite) all
// answer with the same envelope and all have to land the tokens before any
// authenticated request goes out — so they share one landing path.
const MISSING_TOKENS = 'Backend did not return tokens — is the mobile includeTokens support deployed?'

async function landSession(res: SessionResponse) {
  if (!res.tokens) throw new Error(MISSING_TOKENS)
  await setTokens({ access: res.tokens.accessToken, refresh: res.tokens.refreshToken })
  return { status: 'signedIn' as const, user: res.user, company: res.company }
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'restoring',
  user: null,
  company: null,

  async signIn(email, password) {
    const res = await apiFetch<SessionResponse>('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password, includeTokens: true }),
    })
    set(await landSession(res))
  },

  // Creates a brand-new workspace *and* its first admin. A taken email comes
  // back as a 409 whose body.error ApiError already carries, so callers just
  // surface err.message.
  async signUp(companyName, name, email, password) {
    const res = await apiFetch<SessionResponse>('/api/auth/register', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ companyName, name, email, password, includeTokens: true }),
    })
    set(await landSession(res))
  },

  // Accepting an invite creates a NEW user (the invite's email + role), so it
  // replaces whatever session was active.
  async acceptInvite(token, name, password) {
    const res = await apiFetch<SessionResponse>('/api/auth/invite', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ token, name, password, includeTokens: true }),
    })
    set(await landSession(res))
  },

  // Re-scopes the session to another store. The server verifies membership and
  // re-mints both tokens for the target tenant; the identity is unchanged but
  // the role can differ per store, so it is patched onto the current user.
  // Callers must clear their query cache — every cached query is tenant-scoped.
  async switchStore(companyId) {
    const res = await apiFetch<SwitchStoreResponse>('/api/auth/switch-store', {
      method: 'POST',
      body: JSON.stringify({ companyId, includeTokens: true }),
    })
    if (!res.tokens) throw new Error(MISSING_TOKENS)
    await setTokens({ access: res.tokens.accessToken, refresh: res.tokens.refreshToken })
    const user = get().user
    set({ company: res.company, user: user ? { ...user, role: res.role } : user })
    // Rebind this device's push token to the new tenant (server upserts on
    // token). Fire-and-forget — a no-op wherever push is dormant.
    void registerForPush()
    return res.company
  },

  async signOut() {
    // Forget this device's push registration first — the DELETE needs the
    // Bearer token that clearTokens() is about to drop. Never throws.
    await unregisterPush()
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
