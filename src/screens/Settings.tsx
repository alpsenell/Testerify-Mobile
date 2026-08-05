import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchCompany, setDataCollection } from '../api/company'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { Toggle } from '../components/Toggle'
import { Icon } from '../components/Icon'
import { useAuth } from '../stores/auth'
import { useToast } from '../stores/toast'
import { confirmDestructive } from '../utils/confirm'
import { hasAtLeast, roleLabel } from '../utils/roles'
import type { Role } from '../api/company'
import { colors, fonts, type } from '../theme'

const COMPANY_KEY = ['company']

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 12 }}>
      <View>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15.5, color: colors.ink }}>{title}</Text>
        {subtitle ? <Text style={[type.small, { fontSize: 12.5, marginTop: 3, lineHeight: 18 }]}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  )
}

function Footnote({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <Icon name="info" size={14} color={colors.muted} />
      <Text style={[type.small, { fontSize: 12.5, flex: 1 }]}>{children}</Text>
    </View>
  )
}

function AccountRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 11, minHeight: 44 }}>
      <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.secondary }}>{k}</Text>
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.ink }} numberOfLines={1}>{v}</Text>
    </View>
  )
}

export function SettingsScreen() {
  const user = useAuth((s) => s.user)
  const signOut = useAuth((s) => s.signOut)
  const show = useToast((s) => s.show)
  const qc = useQueryClient()
  const company = useQuery({ queryKey: COMPANY_KEY, queryFn: fetchCompany })

  const isAdmin = hasAtLeast(user?.role, 'admin')

  // Wide-reaching and not cheap to undo, so the switch waits for the server
  // rather than moving optimistically.
  const collection = useMutation({
    mutationFn: (enabled: boolean) => setDataCollection(enabled),
    // The PATCH returns the updated company, so the response is written
    // straight into the cache — an invalidate here would only re-fetch what
    // we already hold.
    onSuccess: (updated) => {
      qc.setQueryData(COMPANY_KEY, updated)
      show(updated.dataCollectionEnabled ? 'Data collection resumed.' : 'Data collection paused.')
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not change data collection. Try again.'),
  })

  const askToggle = (next: boolean) => {
    // Turning it back on is harmless; turning it off empties every other
    // screen in the app, so that direction gets the consequence spelled out.
    if (next) return collection.mutate(true)
    confirmDestructive({
      title: 'Pause data collection?',
      message: 'Testerify stops receiving data from your storefront within a minute. Running tests keep their existing results but stop collecting new ones.',
      confirmLabel: 'Pause collection',
      onConfirm: () => collection.mutate(false),
    })
  }

  const askLogOut = () => confirmDestructive({
    title: 'Log out?',
    message: "You'll need your email and password to sign back in.",
    confirmLabel: 'Log out',
    onConfirm: () => { signOut().catch(() => show('Could not log out. Try again.')) },
  })

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 13 }}
      refreshControl={<RefreshControl refreshing={company.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>Home</Text>
      </Pressable>

      <View>
        <Text style={type.kicker}>Workspace</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>Settings</Text>
        <Text style={[type.body, { marginTop: 6 }]}>Manage how Testerify integrates with your storefront.</Text>
      </View>

      {company.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={150} />
          <Skeleton height={170} />
        </View>
      ) : company.isError || !company.data ? (
        <RetryCard onRetry={() => company.refetch()} />
      ) : (
        <>
          <Section
            title="Data collection"
            subtitle="Controls whether Testerify receives any data from your integrated storefront."
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.hairline }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: company.data.dataCollectionEnabled ? colors.pos : colors.warn }} />
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.ink }}>
                    {company.data.dataCollectionEnabled ? 'Collecting' : 'Paused'}
                  </Text>
                </View>
                <Text style={[type.body, { lineHeight: 20 }]}>
                  {company.data.dataCollectionEnabled
                    ? 'Your storefront is sending page views, events and test assignments.'
                    : 'Nothing is being recorded. Running tests keep their existing results but collect nothing new.'}
                </Text>
              </View>
              {/* Admin-only on the server, so non-admins see the state without
                  a control that would only 403. */}
              {isAdmin ? (
                <Toggle
                  value={company.data.dataCollectionEnabled}
                  disabled={collection.isPending}
                  onValueChange={askToggle}
                  accessibilityLabel="Toggle data collection"
                />
              ) : null}
            </View>
            <Footnote>Pausing takes effect within a minute for new page views. Only admins can change this.</Footnote>
          </Section>

          <Section title="Account">
            <AccountRow k="Workspace" v={company.data.name} />
            <AccountRow k="Plan" v={company.data.plan} />
            {user ? <AccountRow k="Your role" v={roleLabel(user.role as Role)} /> : null}
            {user ? <AccountRow k="Signed in as" v={user.email} /> : null}
            <Text style={[type.small, { fontSize: 12.5, lineHeight: 18, marginTop: 4 }]}>
              Plan &amp; billing, team invites and page-type mapping are desktop-only — this screen covers what you may need to flip in a hurry.
            </Text>
          </Section>

          <Pressable
            accessibilityRole="button"
            onPress={askLogOut}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 14, minHeight: 48 }}
          >
            <Icon name="logout" size={16} color={colors.neg} />
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.neg }}>Log out</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  )
}
