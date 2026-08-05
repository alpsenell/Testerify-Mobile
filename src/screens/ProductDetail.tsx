import { Image, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { fetchProductDetail } from '../api/stats'
import type { FunnelStep } from '../api/stats'
import { qk } from '../api/keys'
import { EmptyState } from '../components/EmptyState'
import { StatTile } from '../components/StatTile'
import { RangeChips } from '../components/RangeChips'
import { ScreenShell } from '../components/ScreenShell'
import { Icon } from '../components/Icon'
import { DetailChart } from '../components/charts/DetailChart'
import { compact, money, pct } from '../utils/format'
import { useDateRange } from '../hooks/useDateRange'
import { isTracked } from '../utils/funnel'
import { colors, fonts, type } from '../theme'

// Same row treatment as the Funnel screen, minus the numbered bullet — the
// product funnel is only 4 steps and reads fine without it.
function StepRow({ step }: { step: FunnelStep }) {
  const tracked = isTracked(step)
  const reach = tracked ? Math.max(0, Math.min(100, step.reachRate ?? 0)) : 0

  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
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
    </View>
  )
}

export function ProductDetailScreen() {
  const { product } = useLocalSearchParams<{ product: string }>()
  const { days, setDays, range } = useDateRange(7)

  const param = typeof product === 'string' ? product : ''
  const detail = useQuery({
    queryKey: qk.productDetail(param, range),
    queryFn: () => fetchProductDetail({ product: param, from: range.from, to: range.to }),
    enabled: param.length > 0,
  })

  const data = detail.data
  const currency = data && !data.currency.mixed ? data.currency.code : null
  const hasChart = !!data && data.trend.labels.length >= 2 && data.trend.views.length >= 2

  return (
    <ScreenShell
      kicker="Product"
      title={data?.product.title ?? 'Product'}
      backLabel="Products"
      refreshing={detail.isRefetching}
      pending={detail.isPending}
      errored={detail.isError || (!detail.isPending && !data)}
      onRetry={() => detail.refetch()}
      toolbar={<RangeChips days={days} onPick={setDays} />}
    >
      {!data ? null : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 14 }}>
            {data.product.image ? (
              <Image source={{ uri: data.product.image }} accessibilityIgnoresInvertColors
                style={{ width: 44, height: 44, borderRadius: 9, borderWidth: 1, borderColor: colors.border }} />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="dollar" size={17} color={colors.muted} />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.ink }} numberOfLines={2}>{data.product.title}</Text>
              <Text style={[type.small, { marginTop: 2 }]} numberOfLines={1}>
                {data.product.price !== null ? money(data.product.price, currency) : data.product.handle ?? ''}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
            <StatTile icon="layers" label="Views" value={compact(data.headline.views)}
              sub={`${compact(data.headline.viewers)} viewers`} />
            <StatTile icon="plus" label="Added to cart" value={compact(data.headline.adders)}
              sub={data.tracked.add ? 'in the window' : 'add tracking off'} />
            <StatTile icon="check" label="Units sold" value={compact(data.headline.units)}
              sub={data.headline.conversionRate === null ? 'purchase tracking off' : `${pct(data.headline.conversionRate)} view → buy`} />
            <StatTile icon="dollar" label="Revenue" value={money(data.headline.revenue, currency)}
              sub={data.currency.mixed ? 'mixed currencies' : 'in the window'} />
          </View>

          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 12 }}>
            <View>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>Product funnel</Text>
              <Text style={[type.small, { marginTop: 2 }]}>Distinct visitors reaching each step</Text>
            </View>
            {data.funnel.length === 0 ? (
              <EmptyState message="No funnel activity in this window yet." />
            ) : data.funnel.map((s) => <StepRow key={s.key} step={s} />)}
          </View>

          {hasChart ? (
            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>Views vs purchases</Text>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 8, marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.muted }} />
                  <Text style={type.small}>Views</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.accent }} />
                  <Text style={type.small}>Purchases</Text>
                </View>
              </View>
              <DetailChart labels={data.trend.labels} seriesA={data.trend.views} seriesB={data.trend.purchases} />
            </View>
          ) : null}

          {data.variants.length > 0 ? (
            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 2 }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>By variant</Text>
              <Text style={[type.small, { marginBottom: 6 }]}>Units sold per product variant</Text>
              {data.variants.map((v) => (
                <View key={v.variantId ?? v.variantTitle} style={{ gap: 7, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 11 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                    <Text style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.ink }} numberOfLines={1}>{v.variantTitle}</Text>
                    <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, color: colors.secondary }}>
                      {compact(v.units)} sold · {money(v.revenue, currency)}
                    </Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 99, backgroundColor: colors.track, overflow: 'hidden' }}>
                    <View style={{ height: '100%', borderRadius: 99, backgroundColor: colors.accent, width: `${Math.max(0, Math.min(100, v.share ?? 0))}%` }} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScreenShell>
  )
}
