import { extractInviteToken, inviteRejectionCopy } from '../invite'

const TOKEN = 'a3f9c1d4e5b6a7c8d9e0f1a2b3c4d5e6a3f9c1d4e5b6a7c8d9e0f1a2b3c4d5e6'

test('takes the token off a pasted panel URL', () => {
  expect(extractInviteToken(`https://panel.testerify.com/invite/${TOKEN}`)).toBe(TOKEN)
})

test('takes the token off the app deep link', () => {
  expect(extractInviteToken(`testerifymobile://invite/${TOKEN}`)).toBe(TOKEN)
})

test('accepts a bare token, trimming whatever the clipboard added', () => {
  expect(extractInviteToken(`  ${TOKEN}\n`)).toBe(TOKEN)
})

test('ignores a query string or fragment appended to the link', () => {
  expect(extractInviteToken(`https://panel.testerify.com/invite/${TOKEN}?utm_source=email`)).toBe(TOKEN)
  expect(extractInviteToken(`https://panel.testerify.com/invite/${TOKEN}#top`)).toBe(TOKEN)
})

test('tolerates a trailing slash', () => {
  expect(extractInviteToken(`https://panel.testerify.com/invite/${TOKEN}/`)).toBe(TOKEN)
})

test('rejects a truncated paste that stops before the token', () => {
  expect(extractInviteToken('https://panel.testerify.com/invite/')).toBeNull()
  expect(extractInviteToken('https://panel.testerify.com/invite')).toBeNull()
})

test('rejects empty, whitespace and nullish input', () => {
  expect(extractInviteToken('')).toBeNull()
  expect(extractInviteToken('   ')).toBeNull()
  expect(extractInviteToken(null)).toBeNull()
  expect(extractInviteToken(undefined)).toBeNull()
})

test('rejects something that is clearly not a token', () => {
  expect(extractInviteToken('not a link')).toBeNull()
  expect(extractInviteToken('https://panel.testerify.com/login')).toBeNull()
})

test('each 410 reason gets its own next step', () => {
  expect(inviteRejectionCopy('expired')).toMatch(/expired/i)
  expect(inviteRejectionCopy('revoked')).toMatch(/revoked/i)
  expect(inviteRejectionCopy('accepted')).toMatch(/already been used/i)
  expect(inviteRejectionCopy('not_found')).toMatch(/isn't valid/i)
  // An unknown/absent reason still says something actionable.
  expect(inviteRejectionCopy(undefined)).toMatch(/isn't valid/i)
})
