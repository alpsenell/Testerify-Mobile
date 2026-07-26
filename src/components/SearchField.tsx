import { TextInput, View } from 'react-native'
import { Icon } from './Icon'
import { colors, fonts } from '../theme'

// Port of the design's search row (docs/design/Testerify-Mobile.dc.html
// lines 302-305) — 44px min-height, card bg, border, radius 12, search icon
// + flex-1 text input.
export function SearchField({ value, onChangeText, placeholder }: {
  value: string; onChangeText: (v: string) => void; placeholder: string
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 13,
    }}>
      <Icon name="search" color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        accessibilityLabel={placeholder}
        style={{ flex: 1, minWidth: 0, fontFamily: fonts.sans, fontSize: 14, color: colors.ink }}
      />
    </View>
  )
}
