import { useEffect, useRef } from 'react'
import { Animated, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchLive } from '../api/stats'
import type { LiveStatsResponse } from '../api/stats'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { compact, relTime } from '../utils/format'
import { isTestEnv } from '../utils/env'
import { colors, fonts, type } from '../theme'

// The one polling screen in the app — 15s keeps "on site now" close to
// real-time without hammering the API. The screen stays mounted while on the
// stack (expo-router doesn't unmount pushed screens on blur), so the interval
// keeps ticking in the background if the user navigates away without popping
// this route. Accepted for now: the payload is tiny, 15s is gentle, and every
// other screen already tolerates a stale cache while backgrounded — see the
// self-review note in the task report for the pause-on-blur trade-off.
export const REFETCH_MS = 15000

// Best-effort display label for an aggregated location row — falls back
// outward (city → region → country) since any of the three can be null.
function locationLabel(l: LiveStatsResponse['locations'][number]): string {
  return l.city || l.region || l.country || 'Unknown location'
}

function PulseDot() {
  const opacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    // See Skeleton.tsx / StatusPill.tsx: Animated.loop's real timer never
    // settles under Jest and leaks, forcing the worker to be killed on exit.
    // The pulse is cosmetic and untested — skip starting it under test.
    if (isTestEnv()) return
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.35, duration: 800, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [opacity])
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.pos, opacity }} />
}

export function LiveScreen() {
  const live = useQuery({ queryKey: ['live'], queryFn: fetchLive, refetchInterval: REFETCH_MS })
  const qc = useQueryClient()

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 14 }}
      refreshControl={<RefreshControl refreshing={live.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}>

      {/* Back */}
      <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>Home</Text>
      </Pressable>

      {/* Header */}
      <View>
        <Text style={type.kicker}>Monitoring</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>Live</Text>
      </View>

      {live.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={140} />
          <Skeleton height={64} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </View>
      ) : live.isError ? (
        <RetryCard onRetry={() => live.refetch()} />
      ) : (
        <>
          {/* On site now */}
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingVertical: 22, alignItems: 'center', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <PulseDot />
              <Text style={type.kicker}>On site now</Text>
            </View>
            <Text style={{ fontFamily: fonts.sans, fontSize: 64, lineHeight: 68, color: colors.accent }}>
              {compact(live.data.summary.activeNow)}
            </Text>
          </View>

          {/* Aggregate breakdown — the design's per-visitor "Latest sessions" rows
              have no backend source (no row-level session feed exists, see
              phase2-api-shapes.md §1), so this renders the real `locations`
              aggregate instead, in the same card-row visual style. */}
          <Text style={type.kicker}>By location</Text>
          {live.data.locations.length === 0 ? (
            <EmptyState message="No location data yet." />
          ) : (
            <View style={{ gap: 8 }}>
              {live.data.locations.slice(0, 20).map((l, i) => (
                <View key={`${l.country ?? 'x'}-${l.region ?? 'x'}-${l.city ?? 'x'}-${i}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 13 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="globe" size={15} color={colors.secondary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, color: colors.ink }} numberOfLines={1}>{locationLabel(l)}</Text>
                    <Text style={[type.small, { marginTop: 2 }]}>{compact(l.visitors)} visitors · {compact(l.active)} active</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>{relTime(l.lastSeen)}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}
