import { Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchFunnel } from '../api/stats'
import type { FunnelStep } from '../api/stats'
import { EmptyState } from '../components/EmptyState'
import { StatTile } from '../components/StatTile'
import { RangeChips } from '../components/RangeChips'
import { ScreenShell } from '../components/ScreenShell'
import { qk } from '../api/keys'
import { compact, pct } from '../utils/format'
import { windowSentence } from '../utils/range'
import { useDateRange } from '../hooks/useDateRange'
import { biggestDrop, isTracked, stepByKey } from '../utils/funnel'
import { colors, fonts, type } from '../theme'

function StepRow({ step, index }: { step: FunnelStep; index: number }) {
  const tracked = isTracked(step)
  const reach = tracked ? Math.max(0, Math.min(100, step.reachRate ?? 0)) : 0

  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.track, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.secondary }}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.ink }}>{step.label}</Text>
          <Text style={[type.small, { fontSize: 11 }]} numberOfLines={1}>
            {tracked ? step.source : step.hint ?? 'Not tracked on this store'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: fonts.monoSemi, fontSize: 13.5, color: tracked ? colors.ink : colors.faint }}>
            {tracked ? compact(step.visitors as number) : '—'}
          </Text>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: step.dropOff ? colors.neg : colors.muted }}>
            {tracked && step.dropOff !== null ? `−${pct(step.dropOff)}` : ''}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, height: 10, borderRadius: 99, backgroundColor: colors.border, overflow: 'hidden' }}>
          <View style={{ height: '100%', borderRadius: 99, backgroundColor: colors.accent, width: `${reach}%` }} />
        </View>
        <Text style={{ fontFamily: fonts.monoSemi, fontSize: 11.5, color: colors.secondary, minWidth: 42, textAlign: 'right' }}>
          {tracked && step.reachRate !== null ? pct(step.reachRate, 0) : '—'}
        </Text>
      </View>
      {step.note ? <Text style={[type.small, { fontSize: 11 }]}>{step.note}</Text> : null}
    </View>
  )
}

export function FunnelScreen() {
  const { days, setDays, range } = useDateRange(7)
  const funnel = useQuery({ queryKey: qk.funnel(range), queryFn: () => fetchFunnel(range) })

  const steps = funnel.data?.steps ?? []
  const entry = stepByKey(steps, 'view')
  const purchase = stepByKey(steps, 'purchase')
  const worst = biggestDrop(steps)

  return (
    <ScreenShell
      kicker="Conversion"
      title="Funnel"
      subtitle={`Where shoppers drop off between landing and purchase. ${windowSentence(days)}, all traffic.`}
      refreshing={funnel.isRefetching}
      pending={funnel.isPending}
      errored={funnel.isError}
      onRetry={() => funnel.refetch()}
      skeletonHeights={[88, 88, 220]}
      toolbar={<RangeChips days={days} onPick={setDays} />}
    >
      {steps.length === 0 ? (
        <EmptyState message="No funnel data for this window yet." />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
            <StatTile icon="users" label="Entered" value={entry && isTracked(entry) ? compact(entry.visitors as number) : '—'}
              sub={entry?.source ?? 'not tracked'} />
            <StatTile icon="dollar" label="Purchased" value={purchase && isTracked(purchase) ? compact(purchase.visitors as number) : '—'}
              sub={purchase?.source ?? 'not tracked'} />
            <StatTile icon="trendUp" label="Reach to purchase"
              value={purchase?.reachRate !== null && purchase !== null && isTracked(purchase) ? pct(purchase.reachRate as number) : '—'}
              sub="of everyone who landed" />
            <StatTile icon="warning" label="Biggest drop"
              value={worst?.dropOff !== undefined && worst !== null ? `−${pct(worst.dropOff as number, 0)}` : '—'}
              sub={worst ? `at ${worst.label}` : 'nothing measured'}
              subColor={worst ? colors.neg : colors.muted} />
          </View>

          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 12 }}>
            <View>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>Conversion funnel</Text>
              <Text style={[type.small, { marginTop: 2 }]}>Distinct visitors reaching each step</Text>
            </View>
            {steps.map((s, i) => <StepRow key={s.key} step={s} index={i} />)}
          </View>
        </>
      )}
    </ScreenShell>
  )
}
