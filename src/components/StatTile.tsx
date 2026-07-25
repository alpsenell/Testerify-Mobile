import { Text, View } from 'react-native'
import { Icon, IconName } from './Icon'
import { colors, fonts } from '../theme'

export function StatTile({ label, value, sub, subColor = colors.muted, icon }: {
  label: string; value: string; sub: string; subColor?: string; icon: IconName
}) {
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 14, gap: 8, minHeight: 96 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.muted }}>{label}</Text>
        <Icon name={icon} size={15} color={colors.faint} />
      </View>
      <Text style={{ fontFamily: fonts.sans, fontSize: 30, lineHeight: 32, color: colors.ink }}>{value}</Text>
      <Text style={{ fontFamily: fonts.monoSemi, fontSize: 11.5, color: subColor }}>{sub}</Text>
    </View>
  )
}
