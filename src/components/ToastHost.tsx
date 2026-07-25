import { Text, View } from 'react-native'
import { useToast } from '../stores/toast'
import { colors, fonts } from '../theme'
import { Icon } from './Icon'

export function ToastHost() {
  const message = useToast((s) => s.message)
  if (!message) return null
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 104, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.ink, borderRadius: 14, padding: 15, shadowColor: colors.ink, shadowOpacity: 0.6, shadowRadius: 17, shadowOffset: { width: 0, height: 14 }, elevation: 10 }}>
      <Icon name="check" size={18} color="#7be3a8" />
      <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13.5, color: colors.paper, lineHeight: 19 }}>{message}</Text>
    </View>
  )
}
