import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchCompany, fetchUsage, setDataCollection, updateNotifications } from '../api/company'
import { fetchStores } from '../api/auth'
import { readNotifications } from '../utils/notifications'
import type { NotificationSettings } from '../utils/notifications'
import { qk } from '../api/keys'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { Toggle } from '../components/Toggle'
import { Icon } from '../components/Icon'
import { useAuth } from '../stores/auth'
import { useSheets } from '../stores/sheets'
import { useToast } from '../stores/toast'
import { confirmDestructive } from '../utils/confirm'
import { compact } from '../utils/format'
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

// `onPress` is only passed where there is somewhere to go (today: the
// workspace row, when the identity belongs to more than one store) — the row
// stays inert otherwise, matching the panel.
function AccountRow({ k, v, onPress }: { k: string; v: string; onPress?: () => void }) {
  const body = (
    <>
      <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.secondary }}>{k}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: onPress ? colors.accent : colors.ink }} numberOfLines={1}>{v}</Text>
        {onPress ? <Icon name="chevron" size={14} color={colors.accent} /> : null}
      </View>
    </>
  )
  const style = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 11, minHeight: 44 } as const
  if (!onPress) return <View style={style}>{body}</View>
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${k}: ${v}. Switch workspace`} onPress={onPress} style={style}>
      {body}
    </Pressable>
  )
}

// This month's metering, read-only — plan changes stay on desktop/Shopify.
function UsageSection() {
  const usage = useQuery({ queryKey: qk.usage(), queryFn: fetchUsage })

  if (usage.isPending) return <Skeleton height={130} />
  if (usage.isError || !usage.data) return null

  const u = usage.data.usage
  const pctUsed = u.testedSessionsPct
  const barColor = u.overSessionLimit ? colors.neg : (pctUsed ?? 0) >= 80 ? colors.warn : colors.accent

  return (
    <Section title="Plan & usage" subtitle="Tested sessions reset monthly. Soft limits — nothing stops mid-test.">
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink }}>{usage.data.plan.name}</Text>
        <Text style={[type.small, { fontSize: 12.5 }]}>
          {usage.data.plan.price === 0 ? 'Free' : `$${usage.data.plan.price}/mo`}
        </Text>
      </View>
      <View style={{ gap: 7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.secondary }}>Tested sessions</Text>
          <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, color: colors.secondary }}>
            {compact(u.testedSessions)}{u.testedSessionsLimit !== null ? ` / ${compact(u.testedSessionsLimit)}` : ''}
          </Text>
        </View>
        {u.testedSessionsLimit !== null ? (
          <View style={{ height: 8, borderRadius: 99, backgroundColor: colors.track, overflow: 'hidden' }}>
            <View style={{ height: '100%', borderRadius: 99, backgroundColor: barColor, width: `${Math.max(0, Math.min(100, pctUsed ?? 0))}%` }} />
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.secondary }}>Running tests</Text>
        <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, color: u.atTestLimit ? colors.warn : colors.secondary }}>
          {u.runningTests}{u.runningTestsLimit !== null ? ` / ${u.runningTestsLimit}` : ' / unlimited'}
        </Text>
      </View>
      <Footnote>Plan changes and billing live in the desktop panel.</Footnote>
    </Section>
  )
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.secondary }}>{children}</Text>
}

// Where test alerts go: Slack webhook first, alert email as fallback. The
// server validates both and 400s with a human message on a bad value.
function NotificationsSection({ notifications, isAdmin, ownerFallbackEmail }: {
  notifications: NotificationSettings
  isAdmin: boolean
  ownerFallbackEmail: string | null
}) {
  const show = useToast((s) => s.show)
  const qc = useQueryClient()
  const [form, setForm] = useState<NotificationSettings>(notifications)

  const save = useMutation({
    mutationFn: () => updateNotifications(form),
    onSuccess: (company) => {
      qc.setQueryData(qk.company(), company)
      show('Notification settings saved.')
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not save notification settings.'),
  })

  const dirty = JSON.stringify(form) !== JSON.stringify(notifications)

  return (
    <Section title="Test alerts" subtitle="Winner found, traffic problems, tests with no data — sent every few hours when something changes.">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>Alerts</Text>
          <Text style={[type.small, { fontSize: 12, marginTop: 1 }]}>Notify when a test needs attention</Text>
        </View>
        <Toggle value={form.alertsEnabled} disabled={!isAdmin}
          onValueChange={(v) => setForm((f) => ({ ...f, alertsEnabled: v }))}
          accessibilityLabel="Toggle test alerts" />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>Auto-stop</Text>
          <Text style={[type.small, { fontSize: 12, marginTop: 1 }]}>Stop a test once its result is significant</Text>
        </View>
        <Toggle value={form.autoStop} disabled={!isAdmin}
          onValueChange={(v) => setForm((f) => ({ ...f, autoStop: v }))}
          accessibilityLabel="Toggle auto-stop" />
      </View>
      {isAdmin ? (
        <>
          <View style={{ gap: 6 }}>
            <FieldLabel>Slack webhook URL</FieldLabel>
            <TextInput
              value={form.slackWebhookUrl}
              onChangeText={(t) => setForm((f) => ({ ...f, slackWebhookUrl: t }))}
              placeholder="https://hooks.slack.com/services/…"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Slack webhook URL"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ height: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.paper, paddingHorizontal: 13, fontFamily: fonts.sans, fontSize: 14, color: colors.ink }}
            />
          </View>
          <View style={{ gap: 6 }}>
            <FieldLabel>Alert email</FieldLabel>
            <TextInput
              value={form.alertEmail}
              onChangeText={(t) => setForm((f) => ({ ...f, alertEmail: t }))}
              placeholder={ownerFallbackEmail ?? 'alerts@company.com'}
              placeholderTextColor={colors.muted}
              accessibilityLabel="Alert email"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={{ height: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.paper, paddingHorizontal: 13, fontFamily: fonts.sans, fontSize: 14, color: colors.ink }}
            />
            <Text style={[type.small, { fontSize: 11.5 }]}>Slack is used when set; email is the fallback.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={!dirty || save.isPending}
            onPress={() => save.mutate()}
            style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 11, backgroundColor: dirty && !save.isPending ? colors.accent : colors.track }}
          >
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: dirty && !save.isPending ? colors.white : colors.muted }}>
              {save.isPending ? 'Saving…' : 'Save alert settings'}
            </Text>
          </Pressable>
        </>
      ) : (
        <Footnote>Only admins can change alert delivery.</Footnote>
      )}
    </Section>
  )
}

export function SettingsScreen() {
  const user = useAuth((s) => s.user)
  const signOut = useAuth((s) => s.signOut)
  const show = useToast((s) => s.show)
  const openStoreSwitcher = useSheets((s) => s.openStoreSwitcher)
  const qc = useQueryClient()
  const company = useQuery({ queryKey: COMPANY_KEY, queryFn: fetchCompany })
  // Only the multi-store identities get a switcher — a single-store user would
  // open a sheet with one inert row (the panel hides it for the same reason).
  const stores = useQuery({ queryKey: qk.stores(), queryFn: fetchStores })
  const canSwitchStore = (stores.data?.stores.length ?? 0) >= 2

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

          <UsageSection />

          <NotificationsSection
            notifications={readNotifications(company.data.notifications)}
            isAdmin={isAdmin}
            ownerFallbackEmail={user?.email ?? null}
          />

          <Section title="Account">
            <AccountRow k="Workspace" v={company.data.name} onPress={canSwitchStore ? openStoreSwitcher : undefined} />
            <AccountRow k="Plan" v={company.data.plan} />
            {user ? <AccountRow k="Your role" v={roleLabel(user.role as Role)} /> : null}
            {user ? <AccountRow k="Signed in as" v={user.email} /> : null}
            <Text style={[type.small, { fontSize: 12.5, lineHeight: 18, marginTop: 4 }]}>
              Billing changes and page-type mapping are desktop-only — this screen covers what you may need to flip in a hurry.
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
