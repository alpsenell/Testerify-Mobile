import { Redirect, Tabs } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { TabBar } from '../../components/TabBar'
import { useAuth } from '../../stores/auth'
import { fetchCampaigns } from '../../api/campaigns'
import { deriveAlerts } from '../../utils/alerts'
import { useAlertsRead } from '../../stores/alertsRead'

export default function TabsLayout() {
  const status = useAuth((s) => s.status)
  // Shared with Home/Tests — same queryKey means TanStack serves this from cache, no extra fetch.
  const camps = useQuery({ queryKey: ['campaigns'], queryFn: fetchCampaigns })
  const readIds = useAlertsRead((s) => s.readIds)

  const groups = deriveAlerts(camps.data ?? [])
  const unreadCount = groups
    .filter((g) => g.label === 'Today' || g.label === 'This week')
    .reduce((n, g) => n + g.items.filter((i) => !readIds.includes(i.id)).length, 0)

  if (status === 'restoring') return null
  if (status === 'signedOut') return <Redirect href="/login" />
  return (
    <Tabs tabBar={(props) => <TabBar {...props} badgeCount={unreadCount} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tests" />
      <Tabs.Screen name="alerts" />
    </Tabs>
  )
}
