import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import NetInfo from '@react-native-community/netinfo'
import { colors, fonts } from '../theme'

export function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  const insets = useSafeAreaInsets()
  useEffect(() => NetInfo.addEventListener((s) => setOffline(!(s.isConnected && s.isInternetReachable !== false))), [])
  if (!offline) return null
  return (
    // Sits above the Stack with no header of its own, so its own top padding is
    // what keeps it clear of the status bar / notch. expo-router wraps the app
    // in SafeAreaProvider at the root, so the real inset is always available
    // here at runtime; +6 gives a little breathing room below it.
    <View style={{ backgroundColor: colors.warn, paddingTop: insets.top + 6, paddingBottom: 6, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: colors.white }}>Offline — showing cached data</Text>
    </View>
  )
}
