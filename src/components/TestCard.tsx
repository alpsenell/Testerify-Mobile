import { Pressable, Text, View } from 'react-native'
import type { CampaignListItem } from '../api/campaigns'
import { statusLabel, statusTone, statusPulse, confColor } from '../utils/testModel'
import { compact, pct, shortDate } from '../utils/format'
import { StatusPill } from './StatusPill'
import { ConfidenceBar } from './ConfidenceBar'
import { colors, fonts } from '../theme'

export function TestCard({ campaign: c, onPress }: { campaign: CampaignListItem; onPress: () => void }) {
  const isDraft = c.status === 'draft'
  const goalLine = isDraft
    ? 'Draft · not launched'
    : `${compact(c.visitors)} visitors · started ${shortDate(c.createdAt)}`
  const rate = c.challenger?.rate ?? c.conversionRate

  return (
    <Pressable onPress={onPress} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 14, gap: 10 }}>
      <View style={{ gap: 4 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink, lineHeight: 19 }}>{c.name}</Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.muted }}>{goalLine}</Text>
      </View>
      <StatusPill label={statusLabel(c.status)} tone={statusTone(c.status)} pulse={statusPulse(c.status)} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <ConfidenceBar confidence={isDraft ? 0 : c.confidence} />
        </View>
        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: isDraft ? colors.muted : confColor(c.confidence), minWidth: 28, textAlign: 'right' }}>
          {isDraft ? '—' : pct(c.confidence, 0)}
        </Text>
        <Text style={{ fontFamily: fonts.monoSemi, fontSize: 13, color: colors.ink, minWidth: 40, textAlign: 'right' }}>
          {isDraft ? '—' : pct(rate)}
        </Text>
      </View>
    </Pressable>
  )
}
