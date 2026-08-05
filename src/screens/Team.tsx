import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Share, Text, TextInput, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import {
  createInvitation, fetchInvitations, fetchMembers,
  regenerateInvitation, removeMember, revokeInvitation, updateMemberRole,
} from '../api/company'
import type { Invitation, Member, Role } from '../api/company'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { SegmentedControl } from '../components/SegmentedControl'
import { Icon } from '../components/Icon'
import { useAuth } from '../stores/auth'
import { useToast } from '../stores/toast'
import { relTime, shortDate } from '../utils/format'
import { confirmDestructive } from '../utils/confirm'
import { hasAtLeast, ROLES, roleLabel } from '../utils/roles'
import { colors, fonts, type } from '../theme'

const MEMBERS_KEY = ['members']
const INVITATIONS_KEY = ['invitations']

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 11 }}>
      <View>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15.5, color: colors.ink }}>{title}</Text>
        {subtitle ? <Text style={[type.small, { fontSize: 12.5, marginTop: 3 }]}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  )
}

function RoleChip({ role }: { role: Role }) {
  const accent = role === 'admin'
  return (
    <Text style={{
      fontFamily: fonts.sansSemi, fontSize: 11.5, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20, overflow: 'hidden',
      color: accent ? colors.accent : colors.secondary, backgroundColor: accent ? colors.accentSoft : colors.track,
    }}>{roleLabel(role)}</Text>
  )
}

function InviteForm({ canGrantAdmin }: { canGrantAdmin: boolean }) {
  const qc = useQueryClient()
  const show = useToast((s) => s.show)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('member')
  // The join link is minted once per request and never re-served, so it lives
  // here in component state only — losing it means regenerating, which is
  // exactly what the API expects.
  const [link, setLink] = useState<string | null>(null)

  const options = (canGrantAdmin ? ROLES : ROLES.filter((r) => r !== 'admin'))
    .map((r) => ({ key: r, label: roleLabel(r) }))

  const invite = useMutation({
    mutationFn: () => createInvitation(email.trim(), role),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: INVITATIONS_KEY })
      setLink(result.link)
      setEmail('')
      show(`Invite created for ${result.invitation.email}.`)
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not create the invite. Try again.'),
  })

  const disabled = invite.isPending || email.trim().length === 0

  return (
    <Section title="Invite a colleague" subtitle="They'll get a private link to join this workspace.">
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="colleague@company.com"
        placeholderTextColor={colors.muted}
        accessibilityLabel="Invite email"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={{ height: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.paper, paddingHorizontal: 13, fontFamily: fonts.sans, fontSize: 14, color: colors.ink }}
      />
      <View testID="invite-role-picker" style={{ alignSelf: 'flex-start' }}>
        <SegmentedControl options={options} active={role} onPick={(k) => setRole(k as Role)} />
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => { if (!disabled) invite.mutate() }}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.accent, borderRadius: 11, minHeight: 48, opacity: disabled ? 0.6 : 1 }}
      >
        <Icon name="send" size={16} color={colors.white} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.white }}>
          {invite.isPending ? 'Creating…' : 'Create invite'}
        </Text>
      </Pressable>

      {link ? (
        <View style={{ gap: 8, padding: 12, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: 12 }}>
          <Text style={[type.small, { fontSize: 12 }]}>Send this link to your colleague — it won't be shown again.</Text>
          <Text selectable style={{ fontFamily: fonts.mono, fontSize: 11.5, color: colors.ink }}>{link}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => { Share.share({ message: link }).catch(() => {}) }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.accentBorder }}
          >
            <Icon name="link" size={15} color={colors.accent} />
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.accent }}>Share link</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={[type.small, { fontSize: 12.5, lineHeight: 18 }]}>
        <Text style={{ fontFamily: fonts.sansSemi, color: colors.secondary }}>Member</Text> can create and manage tests.{' '}
        <Text style={{ fontFamily: fonts.sansSemi, color: colors.secondary }}>Manager</Text> can also invite teammates.{' '}
        <Text style={{ fontFamily: fonts.sansSemi, color: colors.secondary }}>Admin</Text> can change roles and workspace settings.
      </Text>
    </Section>
  )
}

function InviteRow({ invite }: { invite: Invitation }) {
  const qc = useQueryClient()
  const show = useToast((s) => s.show)
  const [link, setLink] = useState<string | null>(null)

  const regenerate = useMutation({
    mutationFn: () => regenerateInvitation(invite.id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: INVITATIONS_KEY })
      setLink(result.link)
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not make a new link. Try again.'),
  })

  const revoke = useMutation({
    mutationFn: () => revokeInvitation(invite.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVITATIONS_KEY })
      show(`Invite for ${invite.email} revoked.`)
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not revoke the invite. Try again.'),
  })

  return (
    <View style={{ gap: 9, borderTopWidth: 1, borderTopColor: colors.hairline, paddingVertical: 12 }}>
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.ink }} numberOfLines={1}>{invite.email}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <RoleChip role={invite.role} />
        <Text style={[type.small, { fontSize: 12.5 }]}>Expires {shortDate(invite.expiresAt)}</Text>
      </View>
      {link ? (
        <Text selectable style={{ fontFamily: fonts.mono, fontSize: 11.5, color: colors.ink }}>{link}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {/* An invite link can't be re-read — the panel stores only its hash —
            so "new link" is a regenerate, and it kills the previous one. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`New link for ${invite.email}`}
          onPress={() => confirmDestructive({
            title: 'Make a new link?',
            message: `Any link already sent to ${invite.email} stops working.`,
            confirmLabel: 'New link',
            onConfirm: () => regenerate.mutate(),
          })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }}
        >
          <Icon name="link" size={15} color={colors.secondary} />
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.secondary }}>
            {regenerate.isPending ? 'Working…' : link ? 'Share again' : 'New link'}
          </Text>
        </Pressable>
        {link ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Share link for ${invite.email}`}
            onPress={() => { Share.share({ message: link }).catch(() => {}) }}
            style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.accentBorder, borderRadius: 10 }}
          >
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.accent }}>Share</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Revoke invite for ${invite.email}`}
          onPress={() => confirmDestructive({
            title: 'Revoke this invite?',
            message: `${invite.email} will no longer be able to join with it.`,
            confirmLabel: 'Revoke',
            onConfirm: () => revoke.mutate(),
          })}
          style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10 }}
        >
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.neg }}>Revoke</Text>
        </Pressable>
      </View>
    </View>
  )
}

function MemberRow({ member, canChangeRole, canRemove }: {
  member: Member; canChangeRole: boolean; canRemove: boolean
}) {
  const qc = useQueryClient()
  const show = useToast((s) => s.show)

  const changeRole = useMutation({
    mutationFn: (role: Role) => updateMemberRole(member.id, role),
    onSuccess: (_result, role) => {
      qc.invalidateQueries({ queryKey: MEMBERS_KEY })
      show(`${member.name} is now ${role === 'admin' ? 'an admin' : 'a member'}.`)
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not change the role. Try again.'),
  })

  const remove = useMutation({
    mutationFn: () => removeMember(member.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MEMBERS_KEY })
      show(`${member.name} removed from the workspace.`)
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not remove them. Try again.'),
  })

  return (
    <View style={{ gap: 9, borderTopWidth: 1, borderTopColor: colors.hairline, paddingVertical: 13 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.ink }} numberOfLines={1}>{member.name}</Text>
          <Text style={[type.small, { fontSize: 12.5, marginTop: 2 }]} numberOfLines={1}>{member.email}</Text>
          <Text style={[type.small, { fontSize: 11.5, marginTop: 2 }]}>
            {member.lastLoginAt ? `Last seen ${relTime(member.lastLoginAt)}` : 'Never signed in'}
          </Text>
        </View>
        <RoleChip role={member.role} />
      </View>

      {canChangeRole || canRemove ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {canChangeRole ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Change role for ${member.name}`}
              onPress={() => {
                const next: Role = member.role === 'admin' ? 'member' : 'admin'
                confirmDestructive({
                  title: `Make ${member.name} ${next === 'admin' ? 'an admin' : 'a member'}?`,
                  message: next === 'admin'
                    ? 'Admins can change roles and workspace settings, including data collection.'
                    : 'They lose access to roles and workspace settings.',
                  confirmLabel: 'Change role',
                  onConfirm: () => changeRole.mutate(next),
                })
              }}
              style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10 }}
            >
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.secondary }}>
                {member.role === 'admin' ? 'Make member' : 'Make admin'}
              </Text>
            </Pressable>
          ) : null}
          {canRemove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${member.name}`}
              onPress={() => confirmDestructive({
                title: `Remove ${member.name}?`,
                message: 'They lose access to this workspace immediately.',
                confirmLabel: 'Remove',
                onConfirm: () => remove.mutate(),
              })}
              style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10 }}
            >
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.neg }}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

export function TeamScreen() {
  const user = useAuth((s) => s.user)
  const qc = useQueryClient()
  const members = useQuery({ queryKey: MEMBERS_KEY, queryFn: fetchMembers })
  const invitations = useQuery({ queryKey: INVITATIONS_KEY, queryFn: fetchInvitations })

  // Controls the signed-in role can't use are not rendered at all; the server
  // stays the authority either way.
  const canInvite = hasAtLeast(user?.role, 'manager')
  const isAdmin = hasAtLeast(user?.role, 'admin')

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 13 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={members.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>Home</Text>
      </Pressable>

      <View>
        <Text style={type.kicker}>Workspace</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>Team</Text>
        <Text style={[type.body, { marginTop: 6 }]}>Invite colleagues into this workspace and manage their access.</Text>
      </View>

      {canInvite ? <InviteForm canGrantAdmin={isAdmin} /> : null}

      {canInvite ? (
        <Section title="Pending invites" subtitle="Links waiting to be accepted.">
          {invitations.isPending ? (
            <Skeleton height={80} />
          ) : invitations.isError ? (
            <RetryCard onRetry={() => invitations.refetch()} />
          ) : invitations.data.length === 0 ? (
            <EmptyState message="No invites waiting." />
          ) : (
            invitations.data.map((i) => <InviteRow key={i.id} invite={i} />)
          )}
        </Section>
      ) : null}

      <Section
        title="Members"
        subtitle={members.data ? `${members.data.length} ${members.data.length === 1 ? 'person' : 'people'} in this workspace.` : undefined}
      >
        {members.isPending ? (
          <View style={{ gap: 10 }}>
            <Skeleton height={60} />
            <Skeleton height={60} />
          </View>
        ) : members.isError ? (
          <RetryCard onRetry={() => members.refetch()} />
        ) : members.data.length === 0 ? (
          <EmptyState message="No members yet." />
        ) : (
          members.data.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              // You can't demote or remove yourself from here — that's a
              // lock-yourself-out move that belongs on desktop, if anywhere.
              canChangeRole={isAdmin && m.id !== user?.id}
              canRemove={canInvite && m.id !== user?.id}
            />
          ))
        )}
      </Section>
    </ScrollView>
  )
}
