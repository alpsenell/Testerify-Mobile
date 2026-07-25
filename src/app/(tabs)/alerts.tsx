import { Text, View } from 'react-native'
import { colors, type } from '../../theme'

// Placeholder alerts screen so /(tabs)/alerts resolves end-to-end. Task 14 replaces this.
export default function TabsAlerts() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={type.h1}>Alerts</Text>
    </View>
  )
}
