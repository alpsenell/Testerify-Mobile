import { Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { fetchUtmDetail } from '../api/stats'
import { qk } from '../api/keys'
import { EmptyState } from '../components/EmptyState'
import { StatTile } from '../components/StatTile'
import { RangeChips } from '../components/RangeChips'
import { ScreenShell } from '../components/ScreenShell'
import { Sparkline } from '../components/charts/Sparkline'
import { compact, duration, pct, signedPct } from '../utils/format'
import { useDateRange } from '../hooks/useDateRange'
import { percentChange } from '../utils/tracking'
import { colors, fonts, type } from '../theme'

const DIMENSION_LABEL: Record<string, string> = { source: 'Source', medium: 'Medium', campaign: 'Campaign' }

function ShareRows({ rows, unitLabel }: {
  rows: Array<{ value: string; visits: number; share: number }>
  unitLabel: string
}) {
  return (
    <>
      {rows.map((row) => (
        <View key={row.value} style={{ gap: 7, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 11 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <Text style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.ink }} numberOfLines={1}>{row.value}</Text>
            <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, color: colors.secondary }}>
              {compact(row.visits)} {unitLabel} · {pct(row.share, 0)}
            </Text>
          </View>
          <View style={{ height: 8, borderRadius: 99, backgroundColor: colors.track, overflow: 'hidden' }}>
            <View style={{ height: '100%', borderRadius: 99, backgroundColor: colors.accent, width: `${Math.max(0, Math.min(100, row.share))}%` }} />
          </View>
        </View>
      ))}
    </>
  )
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 2 }}>
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>{title}</Text>
      {subtitle ? <Text style={[type.small, { marginBottom: 6 }]}>{subtitle}</Text> : null}
      {children}
    </View>
  )
}

export function UtmDetailScreen() {
  const { dimension, value } = useLocalSearchParams<{ dimension: string; value: string }>()
  const { days, setDays, range } = useDateRange(7)

  const dim = typeof dimension === 'string' ? dimension : 'source'
  const val = typeof value === 'string' ? value : ''

  const detail = useQuery({
    queryKey: qk.utmDetail(dim, val, range),
    queryFn: () => fetchUtmDetail({ dimension: dim, value: val, from: range.from, to: range.to }),
    enabled: val.length > 0,
  })

  const data = detail.data
  const visitChange = data ? percentChange(data.headline.visits, data.headline.previous.visits) : null
  const visitorChange = data ? percentChange(data.headline.visitors, data.headline.previous.visitors) : null

  return (
    <ScreenShell
      kicker={`${DIMENSION_LABEL[dim] ?? dim} · Acquisition`}
      title={val || 'Unknown'}
      subtitle="How this traffic behaves once it lands."
      backLabel="Tracking"
      refreshing={detail.isRefetching}
      pending={detail.isPending}
      errored={detail.isError || (!detail.isPending && !data)}
      onRetry={() => detail.refetch()}
      toolbar={<RangeChips days={days} onPick={setDays} />}
    >
      {!data ? null : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
            <StatTile icon="link" label="Tagged visits" value={compact(data.headline.visits)}
              sub={visitChange === null ? 'no previous window' : `${signedPct(visitChange, 0)} vs previous ${days}d`}
              subColor={visitChange === null ? colors.muted : visitChange < 0 ? colors.neg : colors.pos} />
            <StatTile icon="users" label="Visitors" value={compact(data.headline.visitors)}
              sub={visitorChange === null ? 'no previous window' : `${signedPct(visitorChange, 0)} vs previous ${days}d`}
              subColor={visitorChange === null ? colors.muted : visitorChange < 0 ? colors.neg : colors.pos} />
            <StatTile icon="bars" label="Share of tagged" value={pct(data.headline.share, 0)}
              sub={`of all ${dim}-tagged visits`} />
            <StatTile icon="clock" label="Avg time on page"
              value={data.headline.avgDurationMs === null ? '—' : duration(data.headline.avgDurationMs)}
              sub={data.headline.avgDurationMs === null ? 'nothing timed' : 'per timed view'} />
          </View>

          {data.trend.length >= 2 ? (
            <SectionCard title="Visits over the window">
              <View style={{ marginTop: 8 }}>
                <Sparkline data={data.trend.map((t) => t.visits)} color={colors.accent} width={300} height={64} />
              </View>
            </SectionCard>
          ) : null}

          {data.subBreakdowns.map((sub) => (
            sub.rows.length === 0 ? null : (
              <SectionCard key={sub.key} title={sub.label}>
                <ShareRows rows={sub.rows.map((r) => ({ value: r.value, visits: r.visits, share: r.share }))} unitLabel="visits" />
              </SectionCard>
            )
          ))}

          {data.topPaths.length > 0 ? (
            <SectionCard title="Top landing paths">
              <ShareRows rows={data.topPaths} unitLabel="visits" />
            </SectionCard>
          ) : null}

          {data.topCountries.length > 0 ? (
            <SectionCard title="Top countries">
              <ShareRows rows={data.topCountries} unitLabel="visits" />
            </SectionCard>
          ) : null}

          {data.trend.length < 2 && data.subBreakdowns.every((s) => s.rows.length === 0)
            && data.topPaths.length === 0 && data.topCountries.length === 0 ? (
            <EmptyState message="No detail recorded for this window yet." />
          ) : null}
        </>
      )}
    </ScreenShell>
  )
}
