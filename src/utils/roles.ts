import type { Role } from '../api/company'

// Client-side mirror of the panel's api/_lib/roles.js. It exists so the UI can
// avoid offering taps the server is certain to 403 — the server remains the
// authority on every write.
export const ROLES: Role[] = ['member', 'manager', 'admin']

const RANK: Record<string, number> = { member: 1, manager: 2, admin: 3 }

// 0 for anything unknown, so an unrecognised role clears no gate.
export const rankOf = (role: string | null | undefined): number => (role ? RANK[role] ?? 0 : 0)

export const hasAtLeast = (role: string | null | undefined, min: Role): boolean =>
  rankOf(role) >= rankOf(min)

export const roleLabel = (role: Role): string => role[0].toUpperCase() + role.slice(1)
