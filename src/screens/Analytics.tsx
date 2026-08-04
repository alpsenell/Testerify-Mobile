import { useMemo } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchCampaigns } from '../api/campaigns'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { StatTile } from '../components/StatTile'
import { WinRateRing } from '../components/charts/WinRateRing'
import { Icon } from '../components/Icon'
import { compact, money, signedPct } from '../utils/format'
import { summarize, upliftLeaderboard, velocity } from '../utils/analytics'
import { colors, fonts, type } from '../theme'

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 13 }}>
      <View>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>{title}</Text>
        <Text style={[type.small, { marginTop: 2 }]}>{subtitle}</Text>
      </View>
      {children}
    </View>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.secondary }}>{label}</Text>
    </View>
  )
}

export function AnalyticsScreen() {
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: fetchCampaigns })
  const qc = useQueryClient()

  const data = campaigns.data
  const stats = useMemo(() => summarize(data ?? []), [data])
  const uplifts = useMemo(() => upliftLeaderboard(data ?? []), [data])
  const weeks = useMemo(() => velocity(data ?? []), [data])

  // Bars are drawn relative to the largest absolute uplift, so a heavy loss
  // reads as full-width in the negative colour rather than as a stub.
  const maxUplift = uplifts.reduce((max, u) => Math.max(max, Math.abs(u.uplift)), 0)
  const peakWeek = weeks.reduce((max, w) => Math.max(max, w.started), 0)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 13 }}
      refreshControl={<RefreshControl refreshing={campaigns.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>Home</Text>
      </Pressable>

      <View>
        <Text style={type.kicker}>Insights</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>Analytics</Text>
        <Text style={[type.body, { marginTop: 6 }]}>Program-wide test performance.</Text>
      </View>

      {campaigns.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={96} />
          <Skeleton height={96} />
          <Skeleton height={150} />
        </View>
      ) : campaigns.isError ? (
        <RetryCard onRetry={() => campaigns.refetch()} />
      ) : stats.testsRun === 0 ? (
        <EmptyState message="No launched tests yet — analytics appear once your first test starts collecting." />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
            <StatTile icon="beaker" label="Tests run" value={String(stats.testsRun)}
              sub={`${stats.inconclusive} without a winner`} />
            <StatTile icon="check" label="Winners shipped" value={String(stats.winnersShipped)}
              sub={`${stats.winRate}% win rate`} subColor={colors.pos} />
            <StatTile icon="trendUp" label="Avg winning uplift"
              value={stats.winnersWithUplift === 0 ? '—' : signedPct(stats.avgWinningUplift)}
              sub={stats.winnersWithUplift === 0 ? 'no measured winners' : `across ${stats.winnersWithUplift} winner${stats.winnersWithUplift === 1 ? '' : 's'}`}
              subColor={stats.winnersWithUplift === 0 ? colors.muted : colors.pos} />
            {/* The list endpoint reports each test's own revenue, not an
                incremental lift, so this tile is labelled for what it is —
                revenue measured on shipped winners. */}
            <StatTile icon="dollar" label="Winner revenue" value={money(stats.revenueFromWinners)}
              sub={`from ${stats.winnersShipped} shipped test${stats.winnersShipped === 1 ? '' : 's'}`} />
          </View>

          {/* Summary line — every clause reads off a real field; the "best
              result" half is dropped when no winner carries an uplift. */}
          <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start', backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: 14, padding: 14 }}>
            <Icon name="sparkle" size={17} color={colors.accent} />
            <Text style={[type.body, { flex: 1, lineHeight: 19.5 }]}>
              You've launched {stats.testsRun} test{stats.testsRun === 1 ? '' : 's'} and shipped {stats.winnersShipped} winner{stats.winnersShipped === 1 ? '' : 's'}.
              {stats.best ? (
                <Text> Your best result so far is <Text style={{ fontFamily: fonts.sansSemi, color: colors.ink }}>{stats.best.name} at {signedPct(stats.best.uplift)}</Text>.</Text>
              ) : null}
            </Text>
          </View>

          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <WinRateRing value={stats.winRate} />
            <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
              <LegendSwatch color={colors.accent} label={`${stats.winnersShipped} winner${stats.winnersShipped === 1 ? '' : 's'}`} />
              <LegendSwatch color={colors.border} label={`${stats.inconclusive} without a winner`} />
              <Text style={[type.small, { lineHeight: 17 }]}>Top-quartile teams ship a winner on ~1 in 3 tests.</Text>
            </View>
          </View>

          <Section title="Uplift leaderboard" subtitle="Challenger vs control, by test">
            {uplifts.length === 0 ? (
              <EmptyState message="No measured tests yet." />
            ) : uplifts.map((u) => {
              const color = u.uplift < 0 ? colors.neg : colors.accent
              return (
                <View key={u.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                    <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink }} numberOfLines={1}>{u.name}</Text>
                    <Text style={{ fontFamily: fonts.monoSemi, fontSize: 13, color }}>{signedPct(u.uplift)}</Text>
                  </View>
                  <View style={{ height: 9, borderRadius: 5, backgroundColor: colors.track, overflow: 'hidden' }}>
                    <View style={{ height: '100%', borderRadius: 5, backgroundColor: color, width: `${maxUplift === 0 ? 0 : Math.abs(u.uplift) / maxUplift * 100}%` }} />
                  </View>
                </View>
              )
            })}
          </Section>

          <Section title="Testing velocity" subtitle="Tests started per week">
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 150, paddingTop: 6 }}>
              {weeks.map((w) => (
                <View key={w.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 8, height: '100%' }}>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.muted }}>{w.started > 0 ? compact(w.started) : ''}</Text>
                  <View
                    accessibilityLabel={`${w.started} started week of ${w.label}`}
                    style={{
                      width: '100%', maxWidth: 30, minHeight: 6, borderTopLeftRadius: 7, borderTopRightRadius: 7,
                      backgroundColor: w.started === 0 ? colors.track : colors.accent,
                      height: peakWeek === 0 ? 6 : `${Math.max(4, w.started / peakWeek * 100)}%`,
                    }}
                  />
                  <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.muted }}>{w.label}</Text>
                </View>
              ))}
            </View>
          </Section>
        </>
      )}
    </ScrollView>
  )
}
