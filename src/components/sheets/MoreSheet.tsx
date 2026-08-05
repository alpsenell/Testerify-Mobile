import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Icon, IconName } from '../Icon'
import { colors, fonts } from '../../theme'
import { useToast } from '../../stores/toast'
import { useSheets } from '../../stores/sheets'

const ITEMS: { label: string; icon: IconName }[] = [
  { label: 'Learnings', icon: 'flag' },
  { label: 'Nudges', icon: 'megaphone' },
  { label: 'Flows', icon: 'flow' },
  { label: 'Audiences', icon: 'users' },
  { label: 'Analytics', icon: 'bars' },
  { label: 'Products', icon: 'dollar' },
  { label: 'Events', icon: 'bolt' },
  { label: 'Heatmaps', icon: 'target' },
  { label: 'Replays', icon: 'play' },
  { label: 'Tracking', icon: 'link' },
  { label: 'Funnel', icon: 'trendUp' },
  { label: 'Pages', icon: 'layers' },
  { label: 'Favorites', icon: 'star' },
  { label: 'Live', icon: 'globe' },
  { label: 'Team', icon: 'users' },
  { label: 'Settings', icon: 'settings' },
]

// Every built screen, by its More-sheet label — 15 of the 16 items. Only
// Audiences is absent: saved audiences aren't a thing the backend has (no
// table, no endpoint), so it falls through to the toast below.
const ROUTES: Record<string, string> = {
  Live: '/screens/live',
  Learnings: '/screens/learnings',
  Analytics: '/screens/analytics',
  Funnel: '/screens/funnel',
  Heatmaps: '/screens/heatmaps',
  Tracking: '/screens/tracking',
  Products: '/screens/products',
  Pages: '/screens/pages',
  Events: '/screens/events',
  Replays: '/screens/replays',
  Favorites: '/screens/favorites',
  Flows: '/screens/flows',
  Nudges: '/screens/nudges',
  Team: '/screens/team',
  Settings: '/screens/settings',
}

export function MoreSheet() {
  const show = useToast((s) => s.show)
  const close = useSheets((s) => s.close)

  const tap = (label: string) => {
    close()
    const route = ROUTES[label]
    if (route) {
      router.push(route)
      return
    }
    show('Saved audiences live on the desktop panel.')
  }

  return (
    <View>
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 19, color: colors.ink, marginBottom: 4 }}>Everything else</Text>
      <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, lineHeight: 17, marginBottom: 14 }}>
        All 16 sidebar pages, adapted for one thumb. Only the heatmap overlay, flow canvas and variant editor stay on desktop.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {ITEMS.map((item) => (
          <Pressable
            key={item.label}
            onPress={() => tap(item.label)}
            style={{ width: '47.5%', flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 13 }}
          >
            <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={item.icon} size={17} color={colors.accent} />
            </View>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.ink }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
