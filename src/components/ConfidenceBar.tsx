import { View } from 'react-native'
import { confColor } from '../utils/testModel'
import { colors } from '../theme'

export function ConfidenceBar({ confidence }: { confidence: number }) {
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' }}>
      <View style={{ height: 6, borderRadius: 3, width: `${confidence}%`, backgroundColor: confColor(confidence) }} />
    </View>
  )
}
