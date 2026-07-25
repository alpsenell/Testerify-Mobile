import { useEffect, useState } from 'react'
import { Platform, Text, View } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { colors, fonts } from '../theme'

export function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  useEffect(() => NetInfo.addEventListener((s) => setOffline(!(s.isConnected && s.isInternetReachable !== false))), [])
  if (!offline) return null
  return (
    // Sits above the Stack with no header of its own, so its own top padding is
    // what keeps it clear of the status bar / notch (Platform-branched per the
    // repo's existing convention — see TabBar/TestDetail bottom bars — rather
    // than react-native-safe-area-context, which the rest of the app doesn't use).
    <View style={{ backgroundColor: colors.warn, paddingTop: Platform.OS === 'ios' ? 54 : 28, paddingBottom: 6, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: '#fff' }}>Offline — showing cached data</Text>
    </View>
  )
}
