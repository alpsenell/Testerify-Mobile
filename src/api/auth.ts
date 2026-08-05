import { apiFetch } from './client'
import type { Role } from './company'

// Endpoints that shape the session itself. Token *handling* for these lives in
// src/stores/auth.ts (one place writes SecureStore); this module is the plain
// typed transport, so screens and sheets can useQuery over it.

// The identity + tenant as the auth endpoints report them. Deliberately
// narrower than api/company.ts's Company: login/register/switch-store return a
// summary row, not the full company record that GET /api/company serves.
export type SessionUser = { id: string; name: string; email: string; role: string }
export type SessionCompany = { id: string; name: string; slug: string; websiteUrl: string | null }

// A store the signed-in identity can reach. `role` is the role *in that store*,
// which is not necessarily the role in the currently active one.
export type Store = { id: string; name: string; slug: string; role: Role }

export type StoresResponse = { stores: Store[]; activeCompanyId: string | null }

// `tokens` is only present when the request opted in with includeTokens:true —
// mobile can't read the httpOnly cookies the web panel relies on.
export type SessionTokens = { accessToken: string; refreshToken: string }

// login / register / invite-accept all answer with this envelope.
export type SessionResponse = {
  user: SessionUser
  company: SessionCompany
  stores?: Store[]
  tokens?: SessionTokens
}

// switch-store answers with the re-scoped company + the role in it — there is
// no user object, the identity is unchanged.
export type SwitchStoreResponse = {
  company: SessionCompany
  role: string
  stores: Store[]
  tokens?: SessionTokens
}

export type InvitePreview = { email: string; role: Role; companyName: string }

// Why an invite can no longer be accepted (server answers 410 + reason).
export type InviteRejection = 'not_found' | 'revoked' | 'accepted' | 'expired'

export const fetchStores = () => apiFetch<StoresResponse>('/api/auth/stores')

// Unauthenticated on purpose — the token in the link *is* the credential, and
// whoever opens it usually has no session yet.
export const fetchInvitePreview = (token: string) =>
  apiFetch<{ invitation: InvitePreview }>(`/api/auth/invite?token=${encodeURIComponent(token)}`, {
    auth: false,
  }).then((r) => r.invitation)
