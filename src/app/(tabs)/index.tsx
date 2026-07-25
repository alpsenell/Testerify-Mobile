import { Text, View } from 'react-native'
import { colors, type } from '../../theme'

// Placeholder home screen so /(tabs) resolves end-to-end. Task 9 replaces this.
export default function TabsHome() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={type.h1}>Home</Text>
    </View>
  )
}
