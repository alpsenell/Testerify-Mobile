import { act, cleanup, render, waitFor, fireEvent, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Alert, Share } from 'react-native'
import { router } from 'expo-router'
import { TeamScreen } from '../Team'
import * as companyApi from '../../api/company'
import type { Invitation, Member, Role } from '../../api/company'
import { useAuth } from '../../stores/auth'
import { useToast } from '../../stores/toast'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/company')

const ME = { id: 'u1', name: 'Alp', email: 'alp@example.com', role: 'admin' }

const MEMBERS: Member[] = [
  { id: 'u1', name: 'Alp', email: 'alp@example.com', role: 'admin', createdAt: '2026-01-01T00:00:00Z', lastLoginAt: '2026-08-05T09:00:00Z' },
  { id: 'u2', name: 'Robin Fell', email: 'robin@example.com', role: 'member', createdAt: '2026-02-01T00:00:00Z', lastLoginAt: null },
]

const INVITES: Invitation[] = [
  { id: 'i1', email: 'new@example.com', role: 'member', status: 'pending', expiresAt: '2026-08-12T00:00:00Z', createdAt: '2026-08-05T00:00:00Z', invitedByName: 'Alp' },
]

const confirmLastAlert = () => {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as { style?: string; onPress?: () => void }[]
  act(() => { buttons.find((b) => b.style === 'destructive')?.onPress?.() })
}

const realShow = useToast.getState().show
let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  // jest.mock()'s auto-mocks keep their call history across tests, and the
  // disabled-button test asserts an exact count.
  jest.clearAllMocks()
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never)
  ;(companyApi.fetchMembers as jest.Mock).mockResolvedValue(MEMBERS)
  ;(companyApi.fetchInvitations as jest.Mock).mockResolvedValue(INVITES)
  ;(companyApi.createInvitation as jest.Mock).mockResolvedValue({
    invitation: { ...INVITES[0], email: 'sam@example.com' }, link: 'https://panel.testerify.com/invite/abc',
  })
  ;(companyApi.regenerateInvitation as jest.Mock).mockResolvedValue({ invitation: INVITES[0], link: 'https://panel.testerify.com/invite/xyz' })
  ;(companyApi.revokeInvitation as jest.Mock).mockResolvedValue({ message: 'Invitation revoked' })
  ;(companyApi.updateMemberRole as jest.Mock).mockResolvedValue({ member: {} })
  ;(companyApi.removeMember as jest.Mock).mockResolvedValue({ message: 'removed' })
})

afterEach(async () => {
  // See learnings.test.tsx — drain react-query's notification batch in act().
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  useToast.setState({ show: realShow })
  useAuth.setState({ status: 'signedOut', user: null, company: null })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
  jest.restoreAllMocks()
})

// Renders the screen as someone holding `role` — the permission matrix is the
// point of most of this file.
const renderAs = async (role: Role, overrides: Partial<typeof ME> = {}) => {
  useAuth.setState({ status: 'signedIn', user: { ...ME, role, ...overrides }, company: null })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><TeamScreen /></QueryClientProvider>)
}

test('an admin sees the invite form, pending invites and members', async () => {
  const { getByText, getByLabelText } = await renderAs('admin')
  await waitFor(() => expect(getByText('Robin Fell')).toBeTruthy())

  expect(getByLabelText('Invite email')).toBeTruthy()
  expect(getByText('new@example.com')).toBeTruthy()
  expect(getByText('Expires Aug 12')).toBeTruthy()
  expect(getByText('2 people in this workspace.')).toBeTruthy()
  expect(getByText('Never signed in')).toBeTruthy()
})

test('a member sees the roster but no invite form and no member controls', async () => {
  const { getByText, queryByText, queryByLabelText } = await renderAs('member', { id: 'u2', name: 'Robin Fell', email: 'robin@example.com' })
  await waitFor(() => expect(getByText('Robin Fell')).toBeTruthy())

  expect(queryByLabelText('Invite email')).toBeNull()
  expect(queryByText('Pending invites')).toBeNull()
  expect(queryByLabelText('Remove Alp')).toBeNull()
  expect(queryByLabelText('Change role for Alp')).toBeNull()
})

test('a manager can invite and remove, but not change roles or grant admin', async () => {
  const { getByText, getByLabelText, getByTestId, queryByLabelText } = await renderAs('manager', { id: 'u3' })
  await waitFor(() => expect(getByText('Robin Fell')).toBeTruthy())

  expect(getByLabelText('Invite email')).toBeTruthy()
  expect(getByLabelText('Remove Robin Fell')).toBeTruthy()
  expect(queryByLabelText('Change role for Robin Fell')).toBeNull()
  // Only admins may grant admin, so the picker offers just two roles.
  const picker = within(getByTestId('invite-role-picker'))
  expect(picker.getByText('Member')).toBeTruthy()
  expect(picker.getByText('Manager')).toBeTruthy()
  expect(picker.queryByText('Admin')).toBeNull()
})

test('nobody can remove or demote themselves from here', async () => {
  const { getByText, queryByLabelText } = await renderAs('admin')
  await waitFor(() => expect(getByText('Robin Fell')).toBeTruthy())

  expect(queryByLabelText('Remove Alp')).toBeNull()
  expect(queryByLabelText('Change role for Alp')).toBeNull()
  expect(queryByLabelText('Remove Robin Fell')).toBeTruthy()
})

test('creating an invite sends email + role and shows the one-time link', async () => {
  const { getByText, getByLabelText, getByTestId } = await renderAs('admin')
  await waitFor(() => expect(getByLabelText('Invite email')).toBeTruthy())

  const input = getByLabelText('Invite email')
  fireEvent.changeText(input, 'sam@example.com')
  await waitFor(() => expect(input.props.value).toBe('sam@example.com'))
  fireEvent.press(within(getByTestId('invite-role-picker')).getByText('Manager'))
  await waitFor(() => expect(getByText('Create invite')).toBeTruthy())
  fireEvent.press(getByText('Create invite'))

  await waitFor(() => expect(companyApi.createInvitation).toHaveBeenCalledWith('sam@example.com', 'manager'))
  await waitFor(() => expect(getByText('https://panel.testerify.com/invite/abc')).toBeTruthy())
  expect(getByText("Send this link to your colleague — it won't be shown again.")).toBeTruthy()
})

test('the share sheet carries the link', async () => {
  const { getByText, getByLabelText } = await renderAs('admin')
  await waitFor(() => expect(getByLabelText('Invite email')).toBeTruthy())

  fireEvent.changeText(getByLabelText('Invite email'), 'sam@example.com')
  await waitFor(() => expect(getByLabelText('Invite email').props.value).toBe('sam@example.com'))
  fireEvent.press(getByText('Create invite'))
  await waitFor(() => expect(getByText('Share link')).toBeTruthy())

  fireEvent.press(getByText('Share link'))
  expect(Share.share).toHaveBeenCalledWith({ message: 'https://panel.testerify.com/invite/abc' })
})

test('create invite is disabled until an email is typed', async () => {
  const { getByText } = await renderAs('admin')
  await waitFor(() => expect(getByText('Create invite')).toBeTruthy())

  fireEvent.press(getByText('Create invite'))
  expect(companyApi.createInvitation).not.toHaveBeenCalled()
})

test('a failed invite toasts', async () => {
  const show = jest.fn()
  useToast.setState({ show })
  ;(companyApi.createInvitation as jest.Mock).mockRejectedValueOnce(new Error('Already invited'))

  const { getByText, getByLabelText } = await renderAs('admin')
  await waitFor(() => expect(getByLabelText('Invite email')).toBeTruthy())

  fireEvent.changeText(getByLabelText('Invite email'), 'dupe@example.com')
  await waitFor(() => expect(getByLabelText('Invite email').props.value).toBe('dupe@example.com'))
  fireEvent.press(getByText('Create invite'))

  await waitFor(() => expect(show).toHaveBeenCalledWith('Already invited'))
})

test('a new link confirms first, warning the old one dies', async () => {
  const { getByText, getByLabelText } = await renderAs('admin')
  await waitFor(() => expect(getByLabelText('New link for new@example.com')).toBeTruthy())

  fireEvent.press(getByLabelText('New link for new@example.com'))
  expect(Alert.alert).toHaveBeenCalled()
  expect((Alert.alert as jest.Mock).mock.calls.at(-1)?.[1]).toContain('stops working')
  expect(companyApi.regenerateInvitation).not.toHaveBeenCalled()

  confirmLastAlert()
  await waitFor(() => expect(companyApi.regenerateInvitation).toHaveBeenCalledWith('i1'))
  await waitFor(() => expect(getByText('https://panel.testerify.com/invite/xyz')).toBeTruthy())
})

test('revoking an invite confirms first', async () => {
  const { getByLabelText } = await renderAs('admin')
  await waitFor(() => expect(getByLabelText('Revoke invite for new@example.com')).toBeTruthy())

  fireEvent.press(getByLabelText('Revoke invite for new@example.com'))
  expect(companyApi.revokeInvitation).not.toHaveBeenCalled()

  confirmLastAlert()
  await waitFor(() => expect(companyApi.revokeInvitation).toHaveBeenCalledWith('i1'))
})

test('promoting a member confirms, then calls the role endpoint', async () => {
  const { getByLabelText } = await renderAs('admin')
  await waitFor(() => expect(getByLabelText('Change role for Robin Fell')).toBeTruthy())

  fireEvent.press(getByLabelText('Change role for Robin Fell'))
  confirmLastAlert()
  await waitFor(() => expect(companyApi.updateMemberRole).toHaveBeenCalledWith('u2', 'admin'))
})

test('removing a member confirms, then calls the remove endpoint', async () => {
  const { getByLabelText } = await renderAs('admin')
  await waitFor(() => expect(getByLabelText('Remove Robin Fell')).toBeTruthy())

  fireEvent.press(getByLabelText('Remove Robin Fell'))
  expect(companyApi.removeMember).not.toHaveBeenCalled()

  confirmLastAlert()
  await waitFor(() => expect(companyApi.removeMember).toHaveBeenCalledWith('u2'))
})

test('an empty invite list says so', async () => {
  ;(companyApi.fetchInvitations as jest.Mock).mockResolvedValue([])
  const { getByText } = await renderAs('admin')
  await waitFor(() => expect(getByText('No invites waiting.')).toBeTruthy())
})

test('back returns to Home and a failed member load renders a retry card', async () => {
  ;(companyApi.fetchMembers as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderAs('admin')
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('Robin Fell')).toBeTruthy())

  fireEvent.press(getByText('Home'))
  expect(router.back).toHaveBeenCalled()
})
