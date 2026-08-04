import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchPageBehavior } from '../api/stats'
import { fetchInsights } from '../api/ai'
import type { AiInsightsResponse } from '../api/ai'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { StatTile } from '../components/StatTile'
import { Icon } from '../components/Icon'
import { compact, duration, pct, signedPct } from '../utils/format'
import { lastNDays } from '../utils/range'
import { percentChange } from '../utils/tracking'
import { behaviorSummary, longestPageType, overallAvgMs } from '../utils/pages'
import { isPlanGated } from '../utils/planGate'
import { colors, fonts, type } from '../theme'

export const PAGES_DAYS = 7

function FunnelNode({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.sansBold, fontSize: 20, color: colors.ink }}>{compact(value)}</Text>
      <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  )
}

const SEVERITY: Record<AiInsightsResponse['insights'][number]['severity'], string> = {
  high: colors.neg, medium: colors.warn, low: colors.muted,
}

export function PagesScreen() {
  const range = useMemo(() => lastNDays(PAGES_DAYS), [])
  const [pageType, setPageType] = useState<string | null>(null)
  const qc = useQueryClient()

  const behavior = useQuery({
    queryKey: ['page-behavior', range.from, range.to],
    queryFn: () => fetchPageBehavior(range),
  })

  // Tapping a page type asks the endpoint for that slice — the top-paths table
  // below swaps to it while the totals above stay on the whole window.
  const scoped = useQuery({
    queryKey: ['page-behavior', range.from, range.to, pageType],
    queryFn: () => fetchPageBehavior({ ...range, pageType: pageType as string }),
    enabled: pageType !== null,
  })

  // The insight call runs as long as the server needs — no client timeout.
  const analyze = useMutation({ mutationFn: () => fetchInsights(range) })

  const data = behavior.data
  const paths = (pageType !== null ? scoped.data?.topPaths : data?.topPaths) ?? []
  const avgMs = data ? overallAvgMs(data.pages) : null
  const longest = data ? longestPageType(data.pages) : null
  const summary = data ? behaviorSummary(data, PAGES_DAYS) : null
  const viewChange = data?.totals.previous ? percentChange(data.totals.views, data.totals.previous.views) : null
  const visitorChange = data?.totals.previous ? percentChange(data.totals.visitors, data.totals.previous.visitors) : null

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 13 }}
      refreshControl={<RefreshControl refreshing={behavior.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>Home</Text>
      </Pressable>

      <View>
        <Text style={type.kicker}>Behavior</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>Shopper behavior</Text>
        <Text style={[type.body, { marginTop: 6 }]}>Page views and time on page. Last {PAGES_DAYS} days.</Text>
      </View>

      {behavior.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={88} />
          <Skeleton height={88} />
          <Skeleton height={180} />
        </View>
      ) : behavior.isError || !data ? (
        <RetryCard onRetry={() => behavior.refetch()} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
            <StatTile icon="layers" label="Page views" value={compact(data.totals.views)}
              sub={viewChange === null ? 'no previous window' : `${signedPct(viewChange, 0)} vs previous ${PAGES_DAYS}d`}
              subColor={viewChange === null ? colors.muted : viewChange < 0 ? colors.neg : colors.pos} />
            <StatTile icon="users" label="Visitors" value={compact(data.totals.visitors)}
              sub={visitorChange === null ? 'no previous window' : `${signedPct(visitorChange, 0)} vs previous ${PAGES_DAYS}d`}
              subColor={visitorChange === null ? colors.muted : visitorChange < 0 ? colors.neg : colors.pos} />
            <StatTile icon="clock" label="Avg time on page" value={duration(avgMs)}
              sub={`${compact(data.totals.timedViews)} timed views`} />
            <StatTile icon="star" label="Longest read" value={longest?.pageType ?? '—'}
              sub={longest ? duration(longest.avgMs) : 'nothing timed'} />
          </View>

          {summary ? (
            <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start', backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: 14, padding: 14 }}>
              <Icon name="sparkle" size={17} color={colors.accent} />
              <Text style={[type.body, { flex: 1, lineHeight: 19.5 }]}>{summary}</Text>
            </View>
          ) : null}

          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>By page type</Text>
            <Text style={[type.small, { marginTop: 2, marginBottom: 6 }]}>Tap a row to filter the top pages below</Text>
            {data.pages.length === 0 ? (
              <EmptyState message="No page views in this window yet." />
            ) : data.pages.map((p) => {
              const isActive = p.pageType === pageType
              return (
                <Pressable
                  key={p.pageType}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => setPageType(isActive ? null : p.pageType)}
                  style={{ gap: 7, borderTopWidth: 1, borderTopColor: colors.hairline, paddingVertical: 11, paddingHorizontal: 6, borderRadius: 8, minHeight: 44, backgroundColor: isActive ? colors.accentSoft : 'transparent' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                    <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.ink }}>{p.pageType}</Text>
                    <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.muted }}>
                      {compact(p.views)} views · {duration(p.avgMs)}
                    </Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 99, backgroundColor: colors.border, overflow: 'hidden' }}>
                    <View style={{ height: '100%', borderRadius: 99, backgroundColor: colors.accent, width: `${Math.max(0, Math.min(100, p.share))}%` }} />
                  </View>
                </Pressable>
              )
            })}
          </View>

          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>Top pages</Text>
              {pageType !== null ? (
                <Pressable accessibilityRole="button" onPress={() => setPageType(null)} style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.accent }}>{pageType} · Clear</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={[type.monoSmall, { flex: 1, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' }]}>Path</Text>
              <Text style={[type.monoSmall, { width: 62, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'right' }]}>Views</Text>
              <Text style={[type.monoSmall, { width: 68, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'right' }]}>Avg time</Text>
            </View>
            {pageType !== null && scoped.isPending ? (
              <Skeleton height={44} />
            ) : paths.length === 0 ? (
              <Text style={[type.small, { paddingVertical: 14 }]}>No paths reported for this window.</Text>
            ) : paths.map((row) => (
              <View key={row.path} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.hairline, minHeight: 44 }}>
                <Text style={{ flex: 1, fontFamily: fonts.mono, fontSize: 12.5, color: colors.ink }} numberOfLines={1}>{row.path}</Text>
                <Text style={{ width: 62, textAlign: 'right', fontFamily: fonts.mono, fontSize: 12.5, color: colors.secondary }}>{compact(row.views)}</Text>
                <Text style={{ width: 68, textAlign: 'right', fontFamily: fonts.mono, fontSize: 12.5, color: colors.secondary }}>{duration(row.avgMs)}</Text>
              </View>
            ))}
          </View>

          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 12 }}>
            <View>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>Conversion funnel</Text>
              <Text style={[type.small, { marginTop: 2 }]}>Unique visitors by stage</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 4 }}>
              <FunnelNode value={data.funnel.product} label="Product" />
              <Text style={[type.small, { fontSize: 12 }]}>{pct(data.funnel.productToCart, 0)} →</Text>
              <FunnelNode value={data.funnel.cart} label="Cart" />
              <Text style={[type.small, { fontSize: 12 }]}>{pct(data.funnel.cartToCheckout, 0)} →</Text>
              <FunnelNode value={data.funnel.checkout} label="Checkout" />
            </View>
          </View>

          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>AI behavior insight</Text>
                <Text style={[type.small, { marginTop: 2 }]}>What your shoppers' time tells us</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={analyze.isPending}
                onPress={() => analyze.mutate()}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 2 }}
              >
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: analyze.isPending ? colors.muted : colors.accent }}>
                  {analyze.isPending ? 'Analyzing…' : analyze.data ? 'Analyze again' : 'Analyze'}
                </Text>
              </Pressable>
            </View>

            {analyze.isPending ? (
              <Skeleton height={72} />
            ) : analyze.isError ? (
              isPlanGated(analyze.error) ? (
                <EmptyState message="AI behavior insights are part of the Growth plan. Upgrade in the desktop panel to turn time-on-page into insights." />
              ) : (
                <RetryCard onRetry={() => analyze.mutate()} />
              )
            ) : analyze.data ? (
              <View style={{ gap: 12 }}>
                <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color: colors.ink }}>{analyze.data.summary}</Text>
                {analyze.data.insights.map((insight) => (
                  <View key={insight.title} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <View style={{ width: 8, height: 8, marginTop: 6, borderRadius: 99, backgroundColor: SEVERITY[insight.severity] }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.ink }}>{insight.title}</Text>
                      <Text style={[type.body, { fontSize: 12.5, marginTop: 2 }]}>{insight.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[type.small, { textAlign: 'center', paddingVertical: 26 }]}>
                Tap Analyze to turn shopper time-on-page into insights.
              </Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  )
}
