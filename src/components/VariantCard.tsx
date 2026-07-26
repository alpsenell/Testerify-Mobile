import { Text, View } from 'react-native'
import { pct } from '../utils/format'
import { colors, fonts } from '../theme'

export function VariantCard({ letter, name, blurb, tag, rate, barWidth, barColor, highlight = false, visitors, conversions, rpv }: {
  letter: string
  name: string
  blurb?: string
  tag?: string
  rate: number
  barWidth: number
  barColor: string
  highlight?: boolean
  visitors: string
  conversions: string
  rpv: string
}) {
  return (
    <View style={{
      backgroundColor: highlight ? colors.accentSoft : colors.card,
      borderWidth: 1, borderColor: highlight ? colors.accentBorder : colors.border,
      borderRadius: 15, padding: 14, gap: 12,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{
          width: 32, height: 32, borderRadius: 9,
          backgroundColor: highlight ? colors.accent : colors.track,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: highlight ? colors.white : colors.secondary }}>{letter}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>{name}</Text>
          {blurb ? <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted, marginTop: 1 }}>{blurb}</Text> : null}
        </View>
        <Text style={{ fontFamily: fonts.monoSemi, fontSize: 15, color: colors.ink }}>{pct(rate, 1)}</Text>
      </View>

      {tag ? (
        <View style={{ alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10.5, color: colors.white }}>{tag}</Text>
        </View>
      ) : null}

      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' }}>
        <View style={{ height: 6, borderRadius: 3, width: `${Math.max(0, Math.min(100, barWidth))}%`, backgroundColor: barColor }} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <VariantStat label="Visitors" value={visitors} />
        <VariantStat label="Conversions" value={conversions} />
        <VariantStat label="Rev/visitor" value={rpv} />
      </View>
    </View>
  )
}

function VariantStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted }}>{label}</Text>
      <Text style={{ fontFamily: fonts.monoSemi, fontSize: 13, color: colors.ink }}>{value}</Text>
    </View>
  )
}
