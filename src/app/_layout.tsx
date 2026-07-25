import { useEffect } from 'react'
import { useFonts, InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans'
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { Stack } from 'expo-router'
import { useAuth } from '../stores/auth'
import { SheetHost } from '../components/SheetHost'
import { ToastHost } from '../components/ToastHost'
import { OfflineBanner } from '../components/OfflineBanner'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

export default function RootLayout() {
  const [loaded] = useFonts({
    InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold,
    IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold,
  })
  const restore = useAuth((s) => s.restore)
  useEffect(() => {
    restore().catch(() => useAuth.setState({ status: 'signedOut', user: null, company: null }))
  }, [restore])
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
