import { Redirect } from 'expo-router'
import { useAuth } from '../stores/auth'

export default function Index() {
  const status = useAuth((s) => s.status)
  if (status === 'restoring') return null
  return <Redirect href={status === 'signedIn' ? '/(tabs)' : '/login'} />
}
