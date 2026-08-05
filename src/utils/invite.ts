import type { InviteRejection } from '../api/auth'

// Invite links are minted by the panel (api/_lib/invites.js: 32 random bytes,
// hex) and arrive on a phone in several shapes: the app's own deep link
// (testerifymobile://invite/<token>), a pasted panel URL
// (https://panel.testerify.com/invite/<token>), or the bare token. In every
// case the token is the last path segment.
export function extractInviteToken(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim()
  if (!raw) return null
  const path = raw.split(/[?#]/)[0]
  const segments = path.split('/').filter(Boolean)
  const candidate = segments[segments.length - 1] ?? ''
  // Long and opaque: enough to reject a truncated paste ("…/invite/") without
  // hard-coding the server's current 64-hex-char format.
  return /^[A-Za-z0-9_-]{16,}$/.test(candidate) ? candidate : null
}

// The server answers 410 + a reason for a link that can never work again. Each
// reason has a different next step, so each gets its own sentence (mirrors the
// panel's AcceptInvitePage.vue).
export function inviteRejectionCopy(reason: string | null | undefined): string {
  switch (reason as InviteRejection) {
    case 'expired':
      return 'This invitation link has expired. Ask your teammate to send a new one.'
    case 'revoked':
      return 'This invitation has been revoked. Ask your teammate for a new link.'
    case 'accepted':
      return 'This invitation has already been used. Try signing in instead.'
    default:
      return "This invitation link isn't valid. Check you copied all of it, or ask for a new one."
  }
}
