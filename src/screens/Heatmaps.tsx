import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchHeatmap } from '../api/stats'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { StatTile } from '../components/StatTile'
import { Icon } from '../components/Icon'
import { compact, pct } from '../utils/format'
import { clickShare, deviceSplit, frustration, totalClicks } from '../utils/heatmap'
import type { HeatmapPage } from '../utils/heatmap'
import { colors, fonts, type } from '../theme'

function PageRow({ page, total }: { page: HeatmapPage; total: number }) {
  const signal = frustration(page)

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderTopColor: colors.hairline, paddingVertical: 12, minHeight: 60 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.ink }} numberOfLines={1}>{page.path}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted }}>{deviceSplit(page)}</Text>
          {signal ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.warnSoft, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }}>
              <Icon name="warning" size={13} color={colors.warn} />
              <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.warn }}>{signal}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: colors.ink, backgroundColor: colors.track, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 9, overflow: 'hidden' }}>
          {pct(clickShare(page, total), 0)}
        </Text>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11.5, color: colors.secondary, marginTop: 5 }}>
          {compact(page.total)} clicks
        </Text>
      </View>
    </View>
  )
}

export function HeatmapsScreen() {
  const heatmap = useQuery({ queryKey: ['heatmap'], queryFn: fetchHeatmap })
  const qc = useQueryClient()

  const pages = heatmap.data?.pages ?? []
  const total = totalClicks(pages)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 13 }}
      refreshControl={<RefreshControl refreshing={heatmap.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>Home</Text>
      </Pressable>

      <View>
        <Text style={type.kicker}>Behavior</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>Heatmaps</Text>
        <Text style={[type.body, { marginTop: 6 }]}>
          Where visitors click on each page. The overlay itself opens on desktop — here you get the ranking and the frustration signals.
        </Text>
      </View>

      {heatmap.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={92} />
          <Skeleton height={220} />
        </View>
      ) : heatmap.isError ? (
        <RetryCard onRetry={() => heatmap.refetch()} />
      ) : pages.length === 0 ? (
        <EmptyState message="No page has enough clicks to read a heatmap yet." />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
            <StatTile icon="target" label="Clicks tracked" value={compact(total)} sub="across ranked pages" />
            <StatTile icon="layers" label="Pages ranked" value={String(pages.length)}
              sub={`min ${compact(heatmap.data.minClicks)} clicks`} />
          </View>

          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>Pages</Text>
            <Text style={[type.small, { marginTop: 2, marginBottom: 6 }]}>Pages with enough clicks to read a heatmap</Text>
            {pages.map((p) => <PageRow key={p.path} page={p} total={total} />)}
            {heatmap.data.hiddenCount > 0 ? (
              <Text style={[type.small, { marginTop: 10 }]}>
                {heatmap.data.hiddenCount} page{heatmap.data.hiddenCount === 1 ? '' : 's'} hidden for having fewer than {compact(heatmap.data.minClicks)} clicks.
              </Text>
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  )
}
