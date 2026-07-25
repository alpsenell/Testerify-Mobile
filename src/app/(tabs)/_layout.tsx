import { Stack } from 'expo-router'

// Placeholder tabs group so post-login navigation resolves end-to-end.
// Task 9 replaces this with the real tab bar.
export default function TabsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
