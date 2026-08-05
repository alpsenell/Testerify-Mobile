import { ROLES, hasAtLeast, rankOf, roleLabel } from '../roles'

test('the hierarchy is member < manager < admin', () => {
  expect(ROLES).toEqual(['member', 'manager', 'admin'])
  expect(rankOf('member')).toBe(1)
  expect(rankOf('manager')).toBe(2)
  expect(rankOf('admin')).toBe(3)
})

test('an unknown or missing role clears no gate', () => {
  expect(rankOf('owner')).toBe(0)
  expect(rankOf(null)).toBe(0)
  expect(rankOf(undefined)).toBe(0)
  expect(hasAtLeast(undefined, 'member')).toBe(false)
  expect(hasAtLeast(null, 'member')).toBe(false)
  expect(hasAtLeast('nonsense', 'member')).toBe(false)
})

test('hasAtLeast compares rank, not equality', () => {
  expect(hasAtLeast('admin', 'member')).toBe(true)
  expect(hasAtLeast('manager', 'member')).toBe(true)
  expect(hasAtLeast('manager', 'manager')).toBe(true)
  expect(hasAtLeast('member', 'member')).toBe(true)
  expect(hasAtLeast('member', 'manager')).toBe(false)
  expect(hasAtLeast('manager', 'admin')).toBe(false)
})

test('roleLabel titles the role for display', () => {
  expect(roleLabel('member')).toBe('Member')
  expect(roleLabel('manager')).toBe('Manager')
  expect(roleLabel('admin')).toBe('Admin')
})
