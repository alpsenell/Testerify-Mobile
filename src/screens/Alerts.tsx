import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchCampaigns } from '../api/campaigns'
import { deriveAlerts, type AlertItem, type AlertKind } from '../utils/alerts'
import { useAlertsRead } from '../stores/alertsRead'
import { relTime } from '../utils/format'
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

export function AlertsScreen() {
  const camps = useQuery({ queryKey: ['campaigns'], queryFn: fetchCampaigns })
  const qc = useQueryClient()
  const readIds = useAlertsRead((s) => s.readIds)
  const markAllRead = useAlertsRead((s) => s.markAllRead)

  const groups = deriveAlerts(camps.data ?? [])
  const allIds = groups.flatMap((g) => g.items.map((i) => i.id))

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

      {/* Groups */}
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
    </ScrollView>
  )
}
