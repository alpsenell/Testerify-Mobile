import { Redirect, Tabs } from 'expo-router'
import { TabBar } from '../../components/TabBar'
import { useAuth } from '../../stores/auth'

export default function TabsLayout() {
  const status = useAuth((s) => s.status)
  if (status === 'restoring') return null
  if (status === 'signedOut') return <Redirect href="/login" />
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tests" />
      <Tabs.Screen name="alerts" />
    </Tabs>
  )
}
