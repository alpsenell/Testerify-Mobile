import { useEffect } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchCampaigns } from '../api/campaigns'
import { fetchAlerts, type ServerAlert } from '../api/alerts'
import { qk } from '../api/keys'
import { deriveAlerts, type AlertItem, type AlertKind } from '../utils/alerts'
import { useAlertsRead } from '../stores/alertsRead'
import { relTime } from '../utils/format'
import { registerForPush } from '../notifications'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { Icon, type IconName } from '../components/Icon'
import { colors, fonts, type } from '../theme'

const KIND_META: Record<AlertKind, { icon: IconName; solid: string; soft: string }> = {
  ship_ready: { icon: 'flag', solid: colors.pos, soft: colors.posSoft },
  shipped: { icon: 'check', solid: colors.accent, soft: colors.accentSoft },
  concluded: { icon: 'mail', solid: colors.secondary, soft: colors.track },
}

// Server alert keys the client can't derive from campaign state — the whole
// reason the feed exists. Anything unrecognised falls back to the neutral look.
const KEY_META: Record<string, { icon: IconName; solid: string; soft: string }> = {
  significant: { icon: 'flag', solid: colors.pos, soft: colors.posSoft },
  ended: { icon: 'mail', solid: colors.secondary, soft: colors.track },
  srm: { icon: 'warning', solid: colors.neg, soft: colors.warnSoft },
  no_data: { icon: 'warning', solid: colors.warn, soft: colors.warnSoft },
  no_data_48h: { icon: 'warning', solid: colors.neg, soft: colors.warnSoft },
  autoPromoted: { icon: 'check', solid: colors.accent, soft: colors.accentSoft },
  autoPaused: { icon: 'pause', solid: colors.warn, soft: colors.warnSoft },
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={[type.h2, { marginTop: 4 }]}>{label}</Text>
}

function AlertRow({ item, unread, onPress }: { item: AlertItem; unread: boolean; onPress: () => void }) {
  const meta = KIND_META[item.kind]
  const tinted = unread && item.kind === 'ship_ready'

  return (
    <Pressable onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      backgroundColor: tinted ? colors.posSoft : colors.card,
      borderWidth: 1, borderColor: tinted ? colors.posBorder : colors.border,
      borderRadius: 15, padding: 14,
    }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: meta.soft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={meta.icon} size={17} color={meta.solid} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type.title}>{item.title}</Text>
        <Text style={[type.body, { marginTop: 3 }]}>{item.body}</Text>
      </View>
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, marginTop: 2 }}>{relTime(item.at)}</Text>
    </Pressable>
  )
}

// A delivered alert from the server feed. Flatter than the derived cards: this
// is history, not a to-do — no tinting, and it only links out when the alert
// was actually about a test.
function HistoryRow({ alert, onPress }: { alert: ServerAlert; onPress?: () => void }) {
  const meta = KEY_META[alert.key ?? ''] ?? { icon: 'mail' as IconName, solid: colors.secondary, soft: colors.track }

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 15, padding: 14,
    }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: meta.soft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={meta.icon} size={17} color={meta.solid} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type.title}>{alert.title ?? 'Alert'}</Text>
        {alert.body ? <Text style={[type.body, { marginTop: 3 }]} numberOfLines={4}>{alert.body}</Text> : null}
      </View>
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, marginTop: 2 }}>{relTime(alert.createdAt)}</Text>
    </Pressable>
  )
}

export function AlertsScreen() {
  const camps = useQuery({ queryKey: qk.campaigns(), queryFn: fetchCampaigns })
  // The feed is additive: when it fails (404 until the backend ships, offline,
  // an old panel deploy) the derived section still carries the screen, so this
  // query never retries into a retry wall.
  const feed = useQuery({ queryKey: qk.alerts(), queryFn: fetchAlerts, retry: false })
  const qc = useQueryClient()
  const readIds = useAlertsRead((s) => s.readIds)
  const markAllRead = useAlertsRead((s) => s.markAllRead)

  // Permission is asked for IN CONTEXT — on the screen that is about alerts —
  // not at app boot. Fire-and-forget: registerForPush never throws and no-ops
  // wherever push can't work (simulator, iOS free signing, no EAS project).
  useEffect(() => { void registerForPush() }, [])

  const groups = deriveAlerts(camps.data ?? [])
  const history = feed.data ?? []
  // Server ids are UUIDs, derived ids are `kind:campaignId` — one namespace,
  // no collisions, so "Mark all read" covers both sections.
  const allIds = [...groups.flatMap((g) => g.items.map((i) => i.id)), ...history.map((a) => a.id)]

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 14 }}
      refreshControl={<RefreshControl refreshing={camps.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}>

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={type.h1}>Alerts</Text>
        <Pressable onPress={() => markAllRead(allIds)}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.accent }}>Mark all read</Text>
        </Pressable>
      </View>

      {/* Needs action — derived from live campaign state */}
      <SectionHeader label="Needs action" />
      {camps.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={72} /><Skeleton height={72} /><Skeleton height={72} />
        </View>
      ) : camps.isError ? (
        <RetryCard onRetry={() => camps.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState message="Nothing needs you right now." />
      ) : (
        <View style={{ gap: 18 }}>
          {groups.map((group) => (
            <View key={group.label} style={{ gap: 10 }}>
              <Text style={type.kicker}>{group.label}</Text>
              {group.items.map((item) => (
                <AlertRow
                  key={item.id}
                  item={item}
                  unread={!readIds.includes(item.id)}
                  onPress={() => router.push(`/test/${item.campaignId}`)}
                />
              ))}
            </View>
          ))}
        </View>
      )}

      {/* History — what the server actually sent (Slack/email/push) */}
      <SectionHeader label="History" />
      {feed.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={72} /><Skeleton height={72} />
        </View>
      ) : feed.isError ? (
        <Text style={type.small}>Alert history isn’t available yet.</Text>
      ) : history.length === 0 ? (
        <EmptyState message="No alerts have been sent yet." />
      ) : (
        <View style={{ gap: 10 }}>
          {history.map((alert) => (
            <HistoryRow
              key={alert.id}
              alert={alert}
              onPress={alert.campaignId ? () => router.push(`/test/${alert.campaignId}`) : undefined}
            />
          ))}
        </View>
      )}
    </ScrollView>
  )
}
