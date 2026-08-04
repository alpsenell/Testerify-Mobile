import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchReplays } from '../api/stats'
import type { ReplayListResponse } from '../api/stats'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { SegmentedControl } from '../components/SegmentedControl'
import { Icon } from '../components/Icon'
import { useToast } from '../stores/toast'
import { compact, duration, relTime } from '../utils/format'
import { isPlanGated } from '../utils/planGate'
import { colors, fonts, type } from '../theme'

type TriggerFilter = 'all' | 'rage' | 'dead'

const TRIGGERS: { key: TriggerFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'rage', label: 'Rage' },
  { key: 'dead', label: 'Dead clicks' },
]

type Session = ReplayListResponse['sessions'][number]

const TRIGGER_STYLE: Record<'rage' | 'dead', { label: string; fg: string; bg: string }> = {
  rage: { label: 'Rage clicks', fg: colors.neg, bg: colors.warnSoft },
  dead: { label: 'Dead clicks', fg: colors.warn, bg: colors.warnSoft },
}

// The mobile app deliberately has no player — replays open on the desktop
// panel (design note), so the play affordance explains itself.
const PLAY_TOAST = 'Replays play on the desktop panel.'

function SessionRow({ session }: { session: Session }) {
  const show = useToast((s) => s.show)
  const trigger = session.trigger ? TRIGGER_STYLE[session.trigger] : null
  const meta = [
    session.device,
    `${session.pageCount} page${session.pageCount === 1 ? '' : 's'}`,
    `${compact(session.eventCount)} events`,
  ].filter(Boolean).join(' · ')

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.hairline, paddingVertical: 13, minHeight: 64 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.ink }} numberOfLines={1}>
          {session.entryPath ?? 'Unknown entry page'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted }}>{meta}</Text>
          {trigger ? (
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11, color: trigger.fg, backgroundColor: trigger.bg, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8, overflow: 'hidden' }}>
              {trigger.label}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.ink }}>{duration(session.durationMs)}</Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: 3 }}>{relTime(session.startedAt)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Play session on ${session.entryPath ?? 'unknown page'}`}
        onPress={() => show(PLAY_TOAST)}
        style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="play" size={15} color={colors.muted} />
      </Pressable>
    </View>
  )
}

function Kpi({ icon, value, label }: { icon: 'play' | 'bolt' | 'clock'; value: string; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 12, gap: 6 }}>
      <Icon name={icon} size={15} color={colors.faint} />
      <Text style={{ fontFamily: fonts.sans, fontSize: 21, lineHeight: 23, color: colors.ink }}>{value}</Text>
      <Text style={{ fontFamily: fonts.sans, fontSize: 10.5, lineHeight: 14, color: colors.muted }}>{label}</Text>
    </View>
  )
}

export function ReplaysScreen() {
  const [trigger, setTrigger] = useState<TriggerFilter>('all')
  const replays = useQuery({
    queryKey: ['replays', trigger],
    queryFn: () => fetchReplays(trigger === 'all' ? {} : { trigger }),
  })
  const qc = useQueryClient()

  const data = replays.data ?? { sessions: [], total: 0, totalEvents: 0, avgDurationMs: 0, limit: 0, origin: null }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 13 }}
      refreshControl={<RefreshControl refreshing={replays.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>Home</Text>
      </Pressable>

      <View>
        <Text style={type.kicker}>Behavior</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>Session replays</Text>
        <Text style={[type.body, { marginTop: 6 }]}>
          Sessions where something went wrong — rage clicks and dead clicks, with the lead-up included.
        </Text>
      </View>

      {replays.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={92} />
          <Skeleton height={200} />
        </View>
      ) : replays.isError ? (
        isPlanGated(replays.error) ? (
          <EmptyState message="Session replay is part of the Scale plan. Upgrade in the desktop panel to record and watch sessions." />
        ) : (
          <RetryCard onRetry={() => replays.refetch()} />
        )
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Kpi icon="play" value={compact(data.total)} label="sessions recorded" />
            <Kpi icon="bolt" value={compact(data.totalEvents)} label="interactions captured" />
            <Kpi icon="clock" value={duration(data.avgDurationMs)} label="average session" />
          </View>

          <View style={{ alignSelf: 'flex-start' }}>
            <SegmentedControl options={TRIGGERS} active={trigger} onPick={(k) => setTrigger(k as TriggerFilter)} />
          </View>

          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>Recent sessions</Text>
            <Text style={[type.small, { marginTop: 2, marginBottom: 6 }]}>
              {data.sessions.length === 0
                ? 'Nothing recorded for this filter'
                : `Showing ${data.sessions.length} of ${compact(data.total)} recorded sessions`}
            </Text>
            {data.sessions.length === 0 ? (
              <EmptyState message={trigger === 'all' ? 'No sessions recorded yet.' : 'No sessions with that signal yet.'} />
            ) : data.sessions.map((s) => <SessionRow key={s.sessionId} session={s} />)}
          </View>
        </>
      )}
    </ScrollView>
  )
}
