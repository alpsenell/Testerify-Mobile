import { View, ViewStyle, StyleProp } from 'react-native'
import { colors, radius } from '../theme'

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: radius.card, padding: 14,
      shadowColor: '#282214', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    }, style]}>{children}</View>
  )
}
