import { useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { fetchCampaign, rollbackCampaign } from '../api/campaigns'
import type { CampaignDetailData, CampaignVariant } from '../api/campaigns'
import { useSheets } from '../stores/sheets'
import { useToast } from '../stores/toast'
import { statusLabel, statusTone, statusPulse, rollbackUntil } from '../utils/testModel'
import { compact, pct, signedPct, money, daysBetween, shortDate } from '../utils/format'
import { StatusPill } from '../components/StatusPill'
import { Card } from '../components/Card'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { VariantCard } from '../components/VariantCard'
import { DetailChart } from '../components/charts/DetailChart'
import { colors, fonts, type } from '../theme'

// Best-effort "path" extraction from a target URL for the subtitle line. RN/Hermes
// doesn't guarantee a global URL parser, so this is a plain regex rather than `new URL()`.
function targetPath(url: string | null): string {
  if (!url) return 'No target URL'
  const noScheme = url.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '')
  const idx = noScheme.indexOf('/')
  return idx === -1 ? '/' : noScheme.slice(idx)
}

function verdictContent(c: CampaignDetailData): { kicker: string; headline: string; body?: string } {
  const kicker = c.status === 'rollout' ? 'SHIPPED · ROLLBACK AVAILABLE' : 'CO-PILOT VERDICT'
  const challenger = c.variants.find((v) => v.id === c.challengerId)
  const sig = c.significance

  if (c.status === 'rollout' && c.rollout) {
    const winner = c.variants.find((v) => v.id === c.rollout!.winnerVariantId)
    const until = rollbackUntil(c.rollout.promotedAt)
    return {
      kicker,
      headline: `${winner?.name ?? 'Winner'} is live for 100% of traffic`,
      body: `Shipped ${shortDate(c.rollout.promotedAt)} · rollback until ${shortDate(until)}`,
    }
  }
  if (c.status === 'running' && sig?.status === 'winning') {
    return {
      kicker,
      headline: `${challenger?.name ?? 'Challenger'} is winning by ${signedPct(sig.uplift)}`,
      body: `${compact(c.stats.visitors)} visitors over ${daysBetween(c.createdAt)} days, ${pct(sig.confidence, 0)} confidence.`,
    }
  }
  if (c.status === 'paused' && sig?.status === 'winning') {
    return {
      kicker,
      headline: `${challenger?.name ?? 'Challenger'} was ahead by ${signedPct(sig.uplift)}`,
      body: 'The test is paused — it stopped collecting with this lead. Resume it on the desktop panel to keep testing.',
    }
  }
  if (sig?.status === 'losing') {
    return {
      kicker,
      headline: `Control is ahead — ${challenger?.name ?? 'Challenger'} is down ${signedPct(sig.uplift)}.`,
    }
  }
  return {
    kicker,
    headline: `Too early to call. ${compact(c.stats.visitors)} visitors so far.`,
  }
}

function orderVariants(variants: CampaignVariant[]): CampaignVariant[] {
  return [...variants].sort((a, b) => (a.isControl === b.isControl ? 0 : a.isControl ? -1 : 1))
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text style={type.small}>{label}</Text>
    </View>
  )
}

function GridStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 3, flex: 1 }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted }}>{label}</Text>
      <Text style={{ fontFamily: fonts.monoSemi, fontSize: 16, color: colors.ink }}>{value}</Text>
    </View>
  )
}

export function TestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [chartOpen, setChartOpen] = useState(false)
  const openShip = useSheets((s) => s.openShip)
  const show = useToast((s) => s.show)
  const qc = useQueryClient()
  const detail = useQuery({ queryKey: ['campaign', id], queryFn: () => fetchCampaign(id as string) })
  const rollback = useMutation({
    mutationFn: () => rollbackCampaign(id as string),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      show('Rolled back — the test is collecting again.')
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not roll back.'),
  })

  if (detail.isPending) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.paper }}
        contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 150, gap: 14 }}>
        <Skeleton height={20} width={90} />
        <Skeleton height={32} width="70%" />
        <Skeleton height={140} />
        <Skeleton height={110} />
        <Skeleton height={110} />
        <Skeleton height={170} />
      </ScrollView>
    )
  }

  if (detail.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, padding: 16, paddingTop: 62 }}>
        <RetryCard onRetry={() => detail.refetch()} />
      </View>
    )
  }

  const c = detail.data
  const verdict = verdictContent(c)

  const ordered = orderVariants(c.variants)
  const rates = ordered.map((v) => (v.stats.impressions > 0 ? (v.stats.conversions / v.stats.impressions) * 100 : 0))
  const maxRate = rates.length ? Math.max(...rates) : 0

  const winnerId = c.status === 'rollout' && c.rollout
    ? c.rollout.winnerVariantId
    : c.status === 'running' && c.significance?.status === 'winning'
      ? c.challengerId
      : null
  const winnerTag = c.status === 'rollout' ? 'LIVE · 100%' : 'WINNER'

  const seriesA = c.controlId ? c.timeline.byVariant[c.controlId] : undefined
  const seriesB = c.challengerId ? c.timeline.byVariant[c.challengerId] : undefined
  const hasChartData = !!c.controlId && !!c.challengerId && (seriesA?.length ?? 0) >= 2 && (seriesB?.length ?? 0) >= 2

  const shipReadyNow = c.status === 'running' && c.significance?.status === 'winning'
    && c.significance.confidence >= 95 && c.significance.uplift > 0
  const showRollbackBar = c.status === 'rollout' && !!c.rollout
  const rollbackDate = showRollbackBar ? rollbackUntil(c.rollout!.promotedAt) : null
  const challengerForShip = c.variants.find((v) => v.id === c.challengerId)
  const confirmRollback = () =>
    Alert.alert('Roll back?', 'Every visitor returns to the A/B split and the test resumes collecting.', [
      { text: 'Keep it live', style: 'cancel' },
      { text: 'Roll back', style: 'destructive', onPress: () => rollback.mutate() },
    ])

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 150, gap: 14 }}>

        {/* Back */}
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
          <Icon name="arrowLeft" size={18} color={colors.secondary} />
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>Tests</Text>
        </Pressable>

        <StatusPill label={statusLabel(c.status)} tone={statusTone(c.status)} pulse={statusPulse(c.status)} />
        <Text style={type.h1}>{c.name}</Text>
        <Text style={type.small}>{targetPath(c.targetUrl)} · started {shortDate(c.createdAt)}</Text>

        {/* Verdict card */}
        <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accentBorder, borderRadius: 18 }}>
          <Text style={[type.kicker, { color: colors.accent }]}>{verdict.kicker}</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 19, lineHeight: 24, color: colors.ink, marginTop: 6 }}>{verdict.headline}</Text>
          {verdict.body ? <Text style={[type.body, { marginTop: 6 }]}>{verdict.body}</Text> : null}
        </Card>

        {/* Variant cards */}
        <View style={{ gap: 10 }}>
          {ordered.map((v, i) => {
            const rate = rates[i]
            const highlight = v.id === winnerId
            return (
              <VariantCard
                key={v.id}
                letter={String.fromCharCode(65 + i)}
                name={v.name}
                blurb={v.isControl ? 'Control' : undefined}
                tag={highlight ? winnerTag : undefined}
                rate={rate}
                barWidth={maxRate > 0 ? (rate / maxRate) * 100 : 0}
                barColor={v.isControl ? colors.faint : colors.accent}
                highlight={highlight}
                visitors={compact(v.stats.visitors)}
                conversions={compact(v.stats.conversions)}
                rpv={money(v.stats.revenue / Math.max(v.stats.visitors, 1), c.revenueCurrency.code)}
              />
            )
          })}
        </View>

        {/* Significance panel */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={type.title}>Significance</Text>
            {c.significance?.status === 'winning'
              ? <StatusPill label="Significant" tone="pos" />
              : <StatusPill label="Collecting" tone="neutral" />}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
            <GridStat label="Confidence" value={pct(c.significance?.confidence ?? 0, 0)} />
            <GridStat label="Uplift" value={signedPct(c.significance?.uplift ?? 0)} />
            <GridStat label="Days live" value={String(daysBetween(c.createdAt))} />
          </View>

          <Pressable onPress={() => setChartOpen((o) => !o)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 11, minHeight: 44 }}>
            <Icon name={chartOpen ? 'x' : 'bars'} size={15} color={colors.secondary} />
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.secondary }}>
              {chartOpen ? 'Hide daily chart' : 'Show daily conversion chart'}
            </Text>
          </Pressable>

          {chartOpen && (
            hasChartData ? (
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', gap: 16, marginBottom: 8 }}>
                  <LegendItem color={colors.muted} label="A control" />
                  <LegendItem color={colors.accent} label="B challenger" />
                </View>
                <DetailChart labels={c.timeline.labels} seriesA={seriesA!} seriesB={seriesB!} />
              </View>
            ) : (
              <View style={{ marginTop: 14 }}>
                <EmptyState message="Not enough daily data yet." />
              </View>
            )
          )}
        </Card>
      </ScrollView>

      {/* Floating bars — plain paper-colored container rather than a real gradient
          fade (react-native-linear-gradient/expo-linear-gradient isn't a project
          dependency); simplification noted in the task report. */}
      {shipReadyNow && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 18, backgroundColor: colors.paper }}>
          <Pressable onPress={() => openShip(c.id)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: 14, minHeight: 52 }}>
            <Icon name="flag" size={18} color="#fff" />
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: '#fff' }}>Ship {challengerForShip?.name ?? 'winner'}</Text>
          </Pressable>
        </View>
      )}
      {showRollbackBar && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 18, backgroundColor: colors.paper }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={type.title}>Live for everyone</Text>
              <Text style={[type.small, { marginTop: 2 }]}>rollback until {shortDate(rollbackDate!)}</Text>
            </View>
            <Pressable onPress={confirmRollback} disabled={rollback.isPending}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center', opacity: rollback.isPending ? 0.6 : 1 }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.ink }}>Roll back</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}
