import { Pressable, Text, View } from 'react-native'
import { Icon, IconName } from '../Icon'
import { colors, fonts } from '../../theme'
import { useToast } from '../../stores/toast'

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

export function MoreSheet() {
  const show = useToast((s) => s.show)

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
            onPress={() => show(`${item.label} is coming to mobile — it lives on the desktop panel for now.`)}
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
