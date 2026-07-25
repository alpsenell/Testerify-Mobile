import { Text, View } from 'react-native'
import { colors, type } from '../../theme'

// Placeholder tests screen so /(tabs)/tests resolves end-to-end. Task 11 replaces this.
export default function TabsTests() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={type.h1}>Tests</Text>
    </View>
  )
}
