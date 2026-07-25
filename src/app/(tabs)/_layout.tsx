import { Redirect, Stack } from 'expo-router'
import { useAuth } from '../../stores/auth'

// Placeholder tabs group so post-login navigation resolves end-to-end.
// Task 9 replaces this with the real tab bar.
export default function TabsLayout() {
  const status = useAuth((s) => s.status)
  if (status === 'signedOut') return <Redirect href="/login" />
  return <Stack screenOptions={{ headerShown: false }} />
}
