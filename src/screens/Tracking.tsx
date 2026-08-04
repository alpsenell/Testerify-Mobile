import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchUtm } from '../api/stats'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { StatTile } from '../components/StatTile'
import { SegmentedControl } from '../components/SegmentedControl'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { compact, pct, signedPct } from '../utils/format'
import { lastNDays } from '../utils/range'
import { percentChange, trackingSummary, UTM_DIMENSIONS } from '../utils/tracking'
import type { UtmDimension } from '../utils/tracking'
import { colors, fonts, type } from '../theme'

export const TRACKING_DAYS = 7

// A total with its period-over-period change underneath — or, with no
// previous period to compare against, a plain note instead of a fake 0%.
function DeltaTile({ label, icon, current, previous }: {
  label: string; icon: IconName; current: number; previous: number
}) {
  const change = percentChange(current, previous)
  return (
    <StatTile
      icon={icon}
      label={label}
      value={compact(current)}
      sub={change === null ? `no previous ${TRACKING_DAYS} days` : `${signedPct(change, 0)} vs previous ${TRACKING_DAYS}d`}
      subColor={change === null ? colors.muted : change < 0 ? colors.neg : colors.pos}
    />
  )
}

export function TrackingScreen() {
  const [dimension, setDimension] = useState<UtmDimension>('source')
  const range = useMemo(() => lastNDays(TRACKING_DAYS), [])
  const utm = useQuery({
    queryKey: ['utm', dimension, range.from, range.to],
    queryFn: () => fetchUtm({ dimension, from: range.from, to: range.to }),
  })
  const qc = useQueryClient()

  const data = utm.data

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 13 }}
      refreshControl={<RefreshControl refreshing={utm.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>Home</Text>
      </Pressable>

      <View>
        <Text style={type.kicker}>Acquisition</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>Tracking</Text>
        <Text style={[type.body, { marginTop: 6 }]}>Where your UTM-tagged traffic comes from. Last {TRACKING_DAYS} days.</Text>
      </View>

      {utm.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={88} />
          <Skeleton height={88} />
          <Skeleton height={200} />
        </View>
      ) : utm.isError || !data ? (
        <RetryCard onRetry={() => utm.refetch()} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
            <DeltaTile icon="link" label="Tagged visits"
              current={data.summary.taggedVisits} previous={data.summary.previous.taggedVisits} />
            <DeltaTile icon="users" label="Unique visitors"
              current={data.summary.uniqueVisitors} previous={data.summary.previous.uniqueVisitors} />
            <StatTile icon="star" label="Top source" value={data.summary.topSource ?? '—'}
              sub={data.summary.topSource ? 'most tagged visits' : 'nothing tagged yet'} />
            <StatTile icon="bars" label="Distinct sources" value={String(data.summary.distinctSources)}
              sub={`over ${TRACKING_DAYS} days`} />
          </View>

          {trackingSummary(data, TRACKING_DAYS) ? (
            <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start', backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: 14, padding: 14 }}>
              <Icon name="sparkle" size={17} color={colors.accent} />
              <Text style={[type.body, { flex: 1, lineHeight: 19.5 }]}>{trackingSummary(data, TRACKING_DAYS)}</Text>
            </View>
          ) : null}

          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 13 }}>
            <View style={{ gap: 10 }}>
              <View>
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>Breakdown</Text>
                <Text style={[type.small, { marginTop: 2 }]}>UTM-tagged traffic by dimension</Text>
              </View>
              <SegmentedControl options={UTM_DIMENSIONS} active={dimension} onPick={(k) => setDimension(k as UtmDimension)} />
            </View>

            {data.breakdown.length === 0 ? (
              <EmptyState message={`No UTM-tagged ${dimension} traffic in the last ${TRACKING_DAYS} days.`} />
            ) : data.breakdown.map((row) => (
              <View key={row.value} style={{ gap: 7, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 11 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.ink }} numberOfLines={1}>{row.value}</Text>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, color: colors.secondary }}>
                    {compact(row.visits)} · {pct(row.share, 0)}
                  </Text>
                </View>
                <View style={{ height: 8, borderRadius: 99, backgroundColor: colors.track, overflow: 'hidden' }}>
                  <View style={{ height: '100%', borderRadius: 99, backgroundColor: colors.accent, width: `${Math.max(0, Math.min(100, row.share))}%` }} />
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  )
}
