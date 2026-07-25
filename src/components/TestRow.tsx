import { Pressable, Text, View } from 'react-native'
import type { CampaignListItem } from '../api/campaigns'
import { verdictFor } from '../utils/testModel'
import { compact, pct, signedPct, daysBetween } from '../utils/format'
import { StatusPill } from './StatusPill'
import { colors, fonts } from '../theme'

export function TestRow({ campaign: c, onPress }: { campaign: CampaignListItem; onPress: () => void }) {
  const verdict = verdictFor(c)
  const rate = c.challenger?.rate ?? c.conversionRate
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 14, minHeight: 72 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.ink, lineHeight: 18 }}>{c.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 }}>
          <StatusPill label={verdict.label} tone={verdict.tone} />
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>
            {compact(c.visitors)} · {daysBetween(c.started)}d
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: fonts.monoSemi, fontSize: 16, color: colors.ink }}>{pct(rate)}</Text>
        {c.uplift !== 0 && (
          <Text style={{ fontFamily: fonts.monoSemi, fontSize: 12, color: c.uplift > 0 ? colors.pos : colors.neg }}>
            {signedPct(c.uplift)}
          </Text>
        )}
      </View>
    </Pressable>
  )
}
