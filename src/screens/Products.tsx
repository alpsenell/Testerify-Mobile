import { useMemo, useState } from 'react'
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchProducts } from '../api/stats'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { StatTile } from '../components/StatTile'
import { SearchField } from '../components/SearchField'
import { Icon } from '../components/Icon'
import { compact, money, pct } from '../utils/format'
import { lastNDays } from '../utils/range'
import { filterProducts, isLeaky } from '../utils/products'
import type { Product, ProductTotals } from '../utils/products'
import { colors, fonts, type } from '../theme'

export const PRODUCTS_DAYS = 7

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted }}>{k}</Text>
      <Text style={{ fontFamily: fonts.monoSemi, fontSize: 13, color: colors.ink }} numberOfLines={1}>{v}</Text>
    </View>
  )
}

function ProductCard({ product, totals, productCount, currency }: {
  product: Product; totals: ProductTotals; productCount: number; currency: string | null
}) {
  const leaky = isLeaky(product, totals, productCount)

  return (
    <View style={{
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 15, gap: 12,
      shadowColor: '#282214', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        {product.image ? (
          <Image source={{ uri: product.image }} accessibilityIgnoresInvertColors
            style={{ width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.border }} />
        ) : (
          <View style={{ width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="dollar" size={16} color={colors.muted} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 18, color: colors.ink }}>{product.title}</Text>
          {leaky ? (
            <Text style={{
              alignSelf: 'flex-start', fontFamily: fonts.sansSemi, fontSize: 11, color: colors.warn,
              borderWidth: 1, borderColor: colors.warn, borderRadius: 99, paddingVertical: 1, paddingHorizontal: 8, overflow: 'hidden',
            }}>High traffic · low conversion</Text>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 11 }}>
        <Cell k="Views" v={compact(product.views)} />
        <Cell k="Add rate" v={product.addRate === null ? '—' : pct(product.addRate, 0)} />
        <Cell k="Sold" v={compact(product.units)} />
        <Cell k="Revenue" v={money(product.revenue, currency)} />
      </View>
    </View>
  )
}

export function ProductsScreen() {
  const range = useMemo(() => lastNDays(PRODUCTS_DAYS), [])
  const products = useQuery({
    queryKey: ['products', range.from, range.to],
    queryFn: () => fetchProducts(range),
  })
  const qc = useQueryClient()
  const [query, setQuery] = useState('')

  const data = products.data
  const visible = useMemo(() => filterProducts(data?.products ?? [], query), [data, query])
  // A mixed-currency window has no single symbol to render honestly, so the
  // amounts stay unlabelled rather than claiming one store currency.
  const currency = data && !data.currency.mixed ? data.currency.code : null

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 13 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>Home</Text>
      </Pressable>

      <View>
        <Text style={[type.h1]}>Products</Text>
        <Text style={[type.body, { marginTop: 6 }]}>
          Which products get seen, get added, and actually sell. Last {PRODUCTS_DAYS} days.
        </Text>
      </View>

      {products.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={88} />
          <Skeleton height={44} />
          <Skeleton height={130} />
        </View>
      ) : products.isError || !data ? (
        <RetryCard onRetry={() => products.refetch()} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
            <StatTile icon="layers" label="Product views" value={compact(data.totals.views)}
              sub={`${compact(data.totals.viewers)} viewers`} />
            <StatTile icon="plus" label="Add rate"
              value={data.totals.addRate === null ? '—' : pct(data.totals.addRate)}
              sub={data.tracked.add ? `${compact(data.totals.adders)} added` : 'add tracking off'} />
            <StatTile icon="check" label="Units sold" value={compact(data.totals.units)}
              sub={data.tracked.purchase ? `${compact(data.totals.purchasers)} buyers` : 'purchase tracking off'} />
            <StatTile icon="dollar" label="Revenue" value={money(data.totals.revenue, currency)}
              sub={data.currency.mixed ? 'mixed currencies' : 'in the window'} />
          </View>

          <SearchField value={query} onChangeText={setQuery} placeholder="Search products…" />

          {visible.length === 0 ? (
            <EmptyState message={data.products.length === 0 ? 'No product activity in this window yet.' : 'No products match.'} />
          ) : visible.map((p) => (
            <ProductCard
              key={p.productId ?? p.handle ?? p.title}
              product={p}
              totals={data.totals}
              productCount={data.products.length}
              currency={currency}
            />
          ))}
        </>
      )}
    </ScrollView>
  )
}
