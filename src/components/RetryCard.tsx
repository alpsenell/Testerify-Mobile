import { Pressable, Text } from 'react-native'
import { Card } from './Card'
import { colors, fonts, type } from '../theme'

export function RetryCard({ message = "Couldn't load. Check your connection.", onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
      <Text style={type.body}>{message}</Text>
      <Pressable onPress={onRetry} style={{ backgroundColor: colors.accent, borderRadius: 11, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: '#fff' }}>Retry</Text>
      </Pressable>
    </Card>
  )
}
