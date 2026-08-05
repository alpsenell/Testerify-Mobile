import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchUtm } from '../api/stats'
import { qk } from '../api/keys'
import { EmptyState } from '../components/EmptyState'
import { StatTile } from '../components/StatTile'
import { SegmentedControl } from '../components/SegmentedControl'
import { RangeChips } from '../components/RangeChips'
import { ScreenShell } from '../components/ScreenShell'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { compact, pct, signedPct } from '../utils/format'
import { inWindow, windowSentence } from '../utils/range'
import { useDateRange } from '../hooks/useDateRange'
import { percentChange, trackingSummary, UTM_DIMENSIONS } from '../utils/tracking'
import type { UtmDimension } from '../utils/tracking'
import { colors, fonts, type } from '../theme'

// A total with its period-over-period change underneath — or, with no
// previous period to compare against, a plain note instead of a fake 0%.
function DeltaTile({ label, icon, current, previous, days }: {
  label: string; icon: IconName; current: number; previous: number; days: number
}) {
  const change = percentChange(current, previous)
  return (
    <StatTile
      icon={icon}
      label={label}
      value={compact(current)}
      sub={change === null ? `no previous ${days} days` : `${signedPct(change, 0)} vs previous ${days}d`}
      subColor={change === null ? colors.muted : change < 0 ? colors.neg : colors.pos}
    />
  )
}

export function TrackingScreen() {
  const [dimension, setDimension] = useState<UtmDimension>('source')
  const { days, setDays, range } = useDateRange(7)
  const utm = useQuery({
    queryKey: qk.utm(dimension, range),
    queryFn: () => fetchUtm({ dimension, from: range.from, to: range.to }),
  })

  const data = utm.data

  return (
    <ScreenShell
      kicker="Acquisition"
      title="Tracking"
      subtitle={`Where your UTM-tagged traffic comes from. ${windowSentence(days)}.`}
      refreshing={utm.isRefetching}
      pending={utm.isPending}
      errored={utm.isError || (!utm.isPending && !data)}
      onRetry={() => utm.refetch()}
      toolbar={<RangeChips days={days} onPick={setDays} />}
    >
      {!data ? null : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
            <DeltaTile icon="link" label="Tagged visits" days={days}
              current={data.summary.taggedVisits} previous={data.summary.previous.taggedVisits} />
            <DeltaTile icon="users" label="Unique visitors" days={days}
              current={data.summary.uniqueVisitors} previous={data.summary.previous.uniqueVisitors} />
            <StatTile icon="star" label="Top source" value={data.summary.topSource ?? '—'}
              sub={data.summary.topSource ? 'most tagged visits' : 'nothing tagged yet'} />
            <StatTile icon="bars" label="Distinct sources" value={String(data.summary.distinctSources)}
              sub={days === 1 ? 'today' : `over ${days} days`} />
          </View>

          {trackingSummary(data, days) ? (
            <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start', backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: 14, padding: 14 }}>
              <Icon name="sparkle" size={17} color={colors.accent} />
              <Text style={[type.body, { flex: 1, lineHeight: 19.5 }]}>{trackingSummary(data, days)}</Text>
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
              <EmptyState message={`No UTM-tagged ${dimension} traffic ${inWindow(days)}.`} />
            ) : data.breakdown.map((row) => (
              <Pressable
                key={row.value}
                accessibilityRole="button"
                accessibilityLabel={`Open ${row.value} details`}
                onPress={() => router.push({ pathname: '/screens/utm-detail', params: { dimension, value: row.value } })}
                style={{ gap: 7, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 11, minHeight: 44 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.ink }} numberOfLines={1}>{row.value}</Text>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, color: colors.secondary }}>
                    {compact(row.visits)} · {pct(row.share, 0)}
                  </Text>
                </View>
                <View style={{ height: 8, borderRadius: 99, backgroundColor: colors.track, overflow: 'hidden' }}>
                  <View style={{ height: '100%', borderRadius: 99, backgroundColor: colors.accent, width: `${Math.max(0, Math.min(100, row.share))}%` }} />
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScreenShell>
  )
}
