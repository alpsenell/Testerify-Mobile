import { Pressable, ScrollView, Text } from 'react-native'
import { colors, fonts } from '../theme'

export type FilterOption = { key: string; label: string; count: number }

export function FilterChips({ options, active, onPick }: {
  options: FilterOption[]; active: string; onPick: (key: string) => void
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {options.map((o) => {
        const isActive = o.key === active
        return (
          <Pressable key={o.key} onPress={() => onPick(o.key)} style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            minHeight: 40, borderRadius: 11, paddingHorizontal: 14,
            backgroundColor: isActive ? colors.accentSoft : colors.card,
            borderWidth: 1, borderColor: isActive ? colors.accent : colors.border,
          }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: isActive ? colors.accent : colors.secondary }}>
              {o.label}
            </Text>
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: isActive ? colors.accent : colors.secondary, opacity: 0.65 }}>
              {o.count}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
