// Device-local state (pinned tests, read alert markers) is *per tenant*: an
// identity can belong to several stores and switch between them without a
// re-login (Phase 3), so a single flat bucket would bleed one store's pins
// into another's. The persisted shape is therefore a { [companyId]: slice }
// map, and the store projects the active company's slice onto the flat fields
// its consumers already read.

// Before a session is restored (or after sign-out) there is no company. State
// written in that window lands in its own bucket rather than leaking into
// whichever tenant happens to sign in next.
export const NO_COMPANY = '__none'

// Where a pre-namespacing (flat) persisted payload is parked at migration
// time. The companyId isn't knowable then — persist hydrates before the auth
// session is restored — so the first real company to become active adopts it.
export const LEGACY_SCOPE = '__legacy'

export const scopeFor = (companyId: string | null | undefined): string => companyId ?? NO_COMPANY

// Fold any parked pre-namespacing data into `scope`, which is what "the old
// flat data belongs to the store you first open after upgrading" means in
// practice. Returns the map unchanged when there is nothing to adopt, so
// callers can assign the result unconditionally.
export function claimLegacy<T>(
  byCompany: Record<string, T>,
  scope: string,
  merge: (legacy: T, existing: T | undefined) => T,
): Record<string, T> {
  const legacy = byCompany[LEGACY_SCOPE]
  if (legacy === undefined) return byCompany
  // Never adopt into the signed-out bucket — that would hand the data to
  // whichever tenant signs in next, which is the bleed we're preventing.
  if (scope === NO_COMPANY || scope === LEGACY_SCOPE) return byCompany
  const next = { ...byCompany, [scope]: merge(legacy, byCompany[scope]) }
  delete next[LEGACY_SCOPE]
  return next
}
