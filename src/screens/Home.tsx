import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchDashboard } from '../api/dashboard'
import { fetchCampaigns } from '../api/campaigns'
import { useAuth } from '../stores/auth'
import { useSheets } from '../stores/sheets'
import { shipReady, rollbackUntil } from '../utils/testModel'
import { compact, pct, money, signedPct, dayKey, shortDate } from '../utils/format'
import { Card } from '../components/Card'
import { StatTile } from '../components/StatTile'
import { TestRow } from '../components/TestRow'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { colors, fonts, type } from '../theme'

export function HomeScreen() {
  const company = useAuth((s) => s.company)
  const user = useAuth((s) => s.user)
  const openCopilot = useSheets((s) => s.openCopilot)
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard })
  const camps = useQuery({ queryKey: ['campaigns'], queryFn: fetchCampaigns })
  const qc = useQueryClient()
  const refreshing = dash.isRefetching || camps.isRefetching

  const running = (camps.data ?? []).filter((c) => c.status === 'running')
  const ready = (camps.data ?? []).find(shipReady)
  const shippedToday = (camps.data ?? []).find(
    (c) => c.status === 'rollout' && c.rollout?.promotedAt &&
      dayKey(c.rollout.promotedAt) === dayKey(new Date())
  )
  const winners = (camps.data ?? []).filter((c) => c.status === 'rollout' || (c.status === 'completed' && c.rollout)).length

  const dateLine = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const firstName = user?.name?.split(' ')[0] ?? 'there'

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}>

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={type.kicker}>{dateLine}</Text>
          <Text style={[type.h2, { marginTop: 2 }]}>{company?.name ?? '—'}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account and settings"
          onPress={() => router.push('/screens/settings')}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.white, fontFamily: fonts.sans, fontSize: 17 }}>{(user?.name ?? '?')[0]}</Text>
          </View>
        </Pressable>
      </View>

      {/* Co-pilot hero */}
      <Card style={{ borderRadius: 20, padding: 18, gap: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkle" size={17} color={colors.white} />
          </View>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.ink }}>Testerify Co-pilot</Text>
        </View>
        <Text style={{ fontFamily: fonts.sans, fontSize: 27, lineHeight: 30, color: colors.ink }}>
          What should we test next, <Text style={{ fontStyle: 'italic', color: colors.accent }}>{firstName}</Text>?
        </Text>
        <Text style={[type.body, { marginTop: 8 }]}>
          {winners} winning test{winners === 1 ? '' : 's'} shipped so far. Describe a goal and I'll draft the test.
        </Text>
        <Pressable onPress={openCopilot} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 13, marginTop: 15, minHeight: 48 }}>
          <Icon name="sparkle" size={17} color={colors.accent} />
          <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.muted }}>Describe a goal…</Text>
          <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="send" size={16} color={colors.white} />
          </View>
        </Pressable>
      </Card>

      {/* Ready-to-ship / shipped-today callout */}
      {ready && (
        <Pressable onPress={() => router.push(`/test/${ready.id}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.posSoft, borderWidth: 1, borderColor: colors.posBorder, borderRadius: 16, padding: 16, minHeight: 48 }}>
          <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="flag" size={20} color={colors.pos} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.title}>1 test is ready to ship</Text>
            <Text style={[type.small, { marginTop: 2, color: colors.secondary }]}>
              {ready.name} · {signedPct(ready.uplift)} · {pct(ready.confidence, 0)} confident
            </Text>
          </View>
          <Icon name="chevron" size={18} color={colors.muted} />
        </Pressable>
      )}
      {!ready && shippedToday && (
        <Pressable onPress={() => router.push(`/test/${shippedToday.id}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: 16, padding: 16 }}>
          <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={18} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.title}>{shippedToday.name} is live for everyone</Text>
            <Text style={[type.small, { marginTop: 2 }]}>
              Shipped today{shippedToday.rollout!.uplift !== undefined ? ` · ${signedPct(shippedToday.rollout!.uplift)}` : ''} · rollback until {shortDate(rollbackUntil(shippedToday.rollout!.promotedAt))}
            </Text>
          </View>
          <Icon name="chevron" size={18} color={colors.muted} />
        </Pressable>
      )}

      {/* Stat tiles */}
      {dash.isPending ? (
        <View style={{ flexDirection: 'row', gap: 11 }}><Skeleton height={96} /><Skeleton height={96} /></View>
      ) : dash.isError ? (
        <RetryCard onRetry={() => dash.refetch()} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
          <StatTile label="Visitors tested" value={compact(dash.data.stats.visitors)} sub="all time" icon="users" />
          <StatTile label="Active tests" value={String(dash.data.stats.activeCampaigns)} sub={`${running.length} running`} icon="beaker" />
          <StatTile label="Avg. conversion" value={pct(dash.data.stats.avgConversionRate)} sub="tested sessions" icon="target" />
          <StatTile label="Revenue tested" value={money(dash.data.stats.revenue, dash.data.currency.code)} sub={`${winners} winners shipped`} icon="dollar" />
        </View>
      )}

      {/* Running now */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.ink }}>Running now</Text>
        <Pressable onPress={() => router.push('/(tabs)/tests')}><Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.accent }}>All tests</Text></Pressable>
      </View>
      {camps.isPending ? (
        <View style={{ gap: 10 }}><Skeleton height={72} /><Skeleton height={72} /><Skeleton height={72} /></View>
      ) : camps.isError ? (
        <RetryCard onRetry={() => camps.refetch()} />
      ) : running.length === 0 ? (
        <EmptyState message="No tests running. Ask the co-pilot for an idea." />
      ) : (
        <View style={{ gap: 10 }}>
          {running.map((c) => <TestRow key={c.id} campaign={c} onPress={() => router.push(`/test/${c.id}`)} />)}
        </View>
      )}
    </ScrollView>
  )
}
