import { useEffect } from 'react'
import { useFonts, InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans'
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import * as Notifications from 'expo-notifications'
import { Stack, router } from 'expo-router'
import { useAuth } from '../stores/auth'
import { configureNotificationHandler } from '../notifications'
import { SheetHost } from '../components/SheetHost'
import { ToastHost } from '../components/ToastHost'
import { OfflineBanner } from '../components/OfflineBanner'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

// Show notifications that arrive while the app is in the foreground. Set once,
// at module scope, per the SDK 57 docs.
configureNotificationHandler()

export default function RootLayout() {
  const [loaded] = useFonts({
    InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold,
    IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold,
  })
  const restore = useAuth((s) => s.restore)
  useEffect(() => {
    restore().catch(() => useAuth.setState({ status: 'signedOut', user: null, company: null }))
  }, [restore])

  // Tapping a push notification lands on the test it is about; alerts with no
  // campaign (or an unreadable payload) fall back to the Alerts tab.
  useEffect(() => {
    let sub: { remove(): void } | undefined
    try {
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response?.notification?.request?.content?.data as { campaignId?: string } | undefined
        if (data?.campaignId) router.push(`/test/${data.campaignId}`)
        else router.push('/(tabs)/alerts')
      })
    } catch {
      // No native notifications module (web preview / tests) — nothing to listen to.
    }
    return () => sub?.remove()
  }, [])
  if (!loaded) return null
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <BottomSheetModalProvider>
          <OfflineBanner />
          <Stack screenOptions={{ headerShown: false }} />
          <SheetHost />
          <ToastHost />
        </BottomSheetModalProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
