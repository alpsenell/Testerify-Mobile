import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchCustomEvents } from '../api/stats'
import type { EventStat } from '../api/stats'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { SearchField } from '../components/SearchField'
import { Icon } from '../components/Icon'
import { compact, pct, relTime, shortDate } from '../utils/format'
import { filterEvents, firedBuckets, metadataLine, reach, sampleChips } from '../utils/events'
import { colors, fonts, type } from '../theme'

function Overview({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ width: '47%', gap: 2 }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted }}>{k}</Text>
      <Text style={{ fontFamily: fonts.monoSemi, fontSize: 14, color: colors.ink }}>{v}</Text>
    </View>
  )
}

function EventRow({ event, totalVisitors }: { event: EventStat; totalVisitors: number }) {
  const [open, setOpen] = useState(false)
  const buckets = firedBuckets(event)
  const peak = buckets.reduce((max, b) => Math.max(max, b.count), 0)
  const share = reach(event, totalVisitors)
  const campaignName = (id: string) => event.campaigns.find((c) => c.campaignId === id)?.name ?? null

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.hairline, paddingVertical: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${event.name} details`}
        onPress={() => setOpen((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 44 }}
      >
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Icon name="chevron" size={14} color={colors.muted} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.ink }}>{event.name}</Text>
            {event.siteWide ? (
              <Text style={{
                fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted,
                borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6, overflow: 'hidden',
              }}>site-wide</Text>
            ) : null}
          </View>
          <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted }}>
            {compact(event.visitors)} visitors
            {share === null ? '' : ` · ${pct(share, 0)} of visitors`}
            {event.lastFired ? ` · last ${relTime(event.lastFired)}` : ''}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.monoSemi, fontSize: 14, color: colors.ink }}>{compact(event.total)}</Text>
      </Pressable>

      {open ? (
        <View style={{ gap: 14, marginTop: 12, padding: 13, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Overview k="Total fires" v={compact(event.total)} />
            <Overview k="Visitors" v={compact(event.visitors)} />
            <Overview k="First fired" v={event.firstFired ? shortDate(event.firstFired) : '—'} />
            <Overview k="In tests" v={String(event.campaignCount)} />
          </View>

          <View style={{ gap: 9 }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted }}>Where it fired</Text>
            {buckets.length === 0 ? (
              <Text style={[type.small, { fontSize: 12 }]}>No breakdown reported.</Text>
            ) : buckets.map((b) => (
              <View key={b.key} style={{ gap: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink }} numberOfLines={1}>{b.label}</Text>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 11.5, color: colors.muted }}>
                    {compact(b.count)} · {compact(b.visitors)} visitors
                  </Text>
                </View>
                <View style={{ height: 7, borderRadius: 99, backgroundColor: colors.border, overflow: 'hidden' }}>
                  <View style={{ height: '100%', borderRadius: 99, backgroundColor: b.isSiteWide ? colors.muted : colors.accent, width: `${peak === 0 ? 0 : b.count / peak * 100}%` }} />
                </View>
              </View>
            ))}
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted }}>Recent activity</Text>
            {event.samples.length === 0 ? (
              <Text style={[type.small, { fontSize: 12 }]}>No recent samples.</Text>
            ) : event.samples.slice(0, 5).map((sample, i) => (
              <View key={`${sample.createdAt ?? 'sample'}-${i}`} style={{ gap: 5, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, color: colors.muted }}>
                    {sample.createdAt ? relTime(sample.createdAt) : 'unknown time'}
                  </Text>
                  {sampleChips(sample, campaignName).map((chip) => (
                    <Text key={chip} style={{ fontFamily: fonts.sans, fontSize: 10.5, color: colors.secondary, backgroundColor: colors.track, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7, overflow: 'hidden' }}>
                      {chip}
                    </Text>
                  ))}
                </View>
                <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.secondary }}>{metadataLine(sample.metadata)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
}

export function EventsScreen() {
  const events = useQuery({ queryKey: ['custom-events'], queryFn: () => fetchCustomEvents() })
  const qc = useQueryClient()
  const [query, setQuery] = useState('')

  const data = events.data
  const visible = useMemo(() => filterEvents(data?.events ?? [], query), [data, query])

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 13 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={events.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>Home</Text>
      </Pressable>

      <View>
        <Text style={type.kicker}>Behavior</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>Events</Text>
        <Text style={[type.body, { marginTop: 6 }]}>
          Custom events your storefront sends with <Text style={{ fontFamily: fonts.mono, fontSize: 12 }}>testerify.customEvent()</Text>.
        </Text>
      </View>

      {events.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={44} />
          <Skeleton height={200} />
        </View>
      ) : events.isError || !data ? (
        <RetryCard onRetry={() => events.refetch()} />
      ) : (
        <>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search events" />

          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>Custom events</Text>
            <Text style={[type.small, { marginTop: 2, marginBottom: 6 }]}>Triggers per event — tap a row for the breakdown</Text>
            {visible.length === 0 ? (
              <EmptyState message={data.events.length === 0 ? 'No custom events received yet.' : 'No events match.'} />
            ) : visible.map((e) => <EventRow key={e.name} event={e} totalVisitors={data.totalVisitors} />)}
          </View>
        </>
      )}
    </ScrollView>
  )
}
