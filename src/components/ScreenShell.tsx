import type { ReactNode } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'
import { RetryCard } from './RetryCard'
import { colors, fonts, type } from '../theme'

// The chrome every secondary screen shares: paper ScrollView clearing the
// status bar, back link, kicker/title/subtitle header, pull-to-refresh and
// the pending/error branches. Screens with several queries or an extra
// empty-state branch keep those branches in `children` and leave
// pending/errored unset.
export function ScreenShell({
  kicker, title, subtitle, backLabel = 'Home', refreshing = false,
  pending, errored, onRetry, skeletonHeights = [88, 88, 200],
  keyboardShouldPersistTaps, toolbar, children,
}: {
  kicker?: string
  title: string
  subtitle?: string
  backLabel?: string
  refreshing?: boolean
  pending?: boolean
  errored?: boolean
  onRetry?: () => void
  skeletonHeights?: number[]
  keyboardShouldPersistTaps?: 'handled' | 'always' | 'never'
  // Rendered above the pending/error triad and kept visible through it —
  // range chips live here so a fresh window can be picked mid-load.
  toolbar?: ReactNode
  children: ReactNode
}) {
  const qc = useQueryClient()

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 13 }}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>{backLabel}</Text>
      </Pressable>

      <View>
        {kicker ? <Text style={type.kicker}>{kicker}</Text> : null}
        <Text style={[type.h1, kicker ? { marginTop: 4 } : null]}>{title}</Text>
        {subtitle ? <Text style={[type.body, { marginTop: 6 }]}>{subtitle}</Text> : null}
      </View>

      {toolbar}

      {pending ? (
        <View style={{ gap: 10 }}>
          {skeletonHeights.map((height, i) => <Skeleton key={i} height={height} />)}
        </View>
      ) : errored ? (
        <RetryCard onRetry={onRetry ?? (() => {})} />
      ) : (
        children
      )}
    </ScrollView>
  )
}
