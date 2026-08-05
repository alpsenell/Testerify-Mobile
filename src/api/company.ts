import { apiFetch } from './client'

// Transcribed from the panel's api/company/{index,members,invitations} — see
// docs/superpowers/specs/2026-08-05-testerify-mobile-phase-3-design.md §2.
export type Role = 'member' | 'manager' | 'admin'

export type Company = {
  id: string
  name: string
  slug: string
  apiKey: string
  websiteUrl: string | null
  onboardingCompleted: boolean
  plan: string
  billingStatus: string
  trialEndsAt: string | null
  shopifyDomain: string | null
  // Opaque config blobs — owned by desktop screens this app doesn't build.
  notifications: unknown
  pageTypeConfig: unknown
  dataCollectionEnabled: boolean
  createdAt: string
}

export type Member = {
  id: string
  name: string
  email: string
  role: Role
  createdAt: string
  lastLoginAt: string | null
}

export type Invitation = {
  id: string
  email: string
  role: Role
  status: string
  expiresAt: string
  createdAt: string
  invitedByName: string | null
}

// The join link is minted per request and never re-served by the list
// endpoint (the panel stores only its hash), so create and regenerate keep
// the whole envelope while the list drops to the rows.
export type InvitationWithLink = { invitation: Invitation; link: string }

export const fetchCompany = () => apiFetch<{ company: Company }>('/api/company').then((r) => r.company)

// Admin-only on the server (403 otherwise).
export const setDataCollection = (enabled: boolean) =>
  apiFetch<{ company: Company }>('/api/company', {
    method: 'PATCH',
    body: JSON.stringify({ dataCollectionEnabled: enabled }),
  }).then((r) => r.company)

export const fetchMembers = () =>
  apiFetch<{ members: Member[] }>('/api/company/members').then((r) => r.members)

// Admin-only on the server.
export const updateMemberRole = (id: string, role: Role) =>
  apiFetch<{ member: unknown }>(`/api/company/members/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })

// Manager or above on the server.
export const removeMember = (id: string) =>
  apiFetch<{ message: string }>(`/api/company/members/${id}`, { method: 'DELETE' })

export const fetchInvitations = () =>
  apiFetch<{ invitations: Invitation[] }>('/api/company/invitations').then((r) => r.invitations)

export const createInvitation = (email: string, role: Role) =>
  apiFetch<InvitationWithLink>('/api/company/invitations', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  })

// Mints a new token and resets the expiry — which invalidates any link
// already shared for this invite.
export const regenerateInvitation = (id: string) =>
  apiFetch<InvitationWithLink>(`/api/company/invitations/${id}`, { method: 'POST' })

export const revokeInvitation = (id: string) =>
  apiFetch<{ message: string }>(`/api/company/invitations/${id}`, { method: 'DELETE' })

// ── Notification settings (companies.notifications jsonb) ──────────────
// The type + pure reader live in utils/notifications.ts so screen tests that
// auto-mock this module keep the real normalization.
import type { NotificationSettings } from '../utils/notifications'
export type { NotificationSettings }

// Admin-only on the server (403 otherwise); 400 carries the validation message.
export const updateNotifications = (notifications: NotificationSettings) =>
  apiFetch<{ company: Company }>('/api/company', {
    method: 'PATCH',
    body: JSON.stringify({ notifications }),
  }).then((r) => r.company)

// ── Plan & usage (soft metering) ───────────────────────────────────────
export type UsageResponse = {
  usage: {
    plan: string
    planName: string
    testedSessions: number
    testedSessionsLimit: number | null
    testedSessionsPct: number | null
    overSessionLimit: boolean
    runningTests: number
    runningTestsLimit: number | null
    atTestLimit: boolean
    periodStart: string
    periodEnd: string
  }
  plan: {
    key: string
    name: string
    price: number
    features: string[]
    maxRunningTests: number | null
    testedSessionsPerMonth: number | null
  }
}

export const fetchUsage = () => apiFetch<UsageResponse>('/api/company/usage')
