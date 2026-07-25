import { Text, View } from 'react-native'
import { colors, type } from '../theme'

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={{ padding: 36, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 15 }}>
      <Text style={[type.body, { textAlign: 'center' }]}>{message}</Text>
    </View>
  )
}
