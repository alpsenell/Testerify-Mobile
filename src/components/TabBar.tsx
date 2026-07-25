import { Pressable, Text, View, Platform } from 'react-native'
import type { BottomTabBarProps } from 'expo-router/tabs'
import { Icon, IconName } from './Icon'
import { colors, fonts } from '../theme'
import { useSheets } from '../stores/sheets'

export function TabBar({ state, navigation, badgeCount = 0 }: BottomTabBarProps & { badgeCount?: number }) {
  const openMore = useSheets((s) => s.openMore)
  const openCopilot = useSheets((s) => s.openCopilot)
  const current = state.routes[state.index]?.name

  const tab = (route: string, label: string, icon: IconName, extra?: React.ReactNode) => {
    const active = current === route
    return (
      <Pressable key={route} onPress={() => navigation.navigate(route)}
        accessibilityRole="tab" accessibilityState={{ selected: active }}
        style={{ flex: 1, alignItems: 'center', gap: 4, paddingTop: 7, minHeight: 52 }}>
        <View>
          <Icon name={icon} size={23} color={active ? colors.accent : colors.muted} />
          {extra}
        </View>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10.5, color: active ? colors.accent : colors.muted }}>{label}</Text>
      </Pressable>
    )
  }

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.tabBar, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 30 : 14 }}>
      {tab('index', 'Home', 'home')}
      {tab('tests', 'Tests', 'beaker')}
      <View style={{ width: 76, alignItems: 'center', paddingTop: 7, minHeight: 52 }}>
        <View style={{ height: 26 }} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10.5, color: colors.muted }}>Co-pilot</Text>
      </View>
      {tab('alerts', 'Alerts', 'bell', badgeCount > 0 ? (
        <View style={{ position: 'absolute', top: -3, right: -7, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: colors.neg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.monoSemi, fontSize: 9.5, color: '#fff' }}>{badgeCount}</Text>
        </View>
      ) : undefined)}
      <Pressable onPress={openMore} accessibilityRole="button" style={{ flex: 1, alignItems: 'center', gap: 4, paddingTop: 7, minHeight: 52 }}>
        <Icon name="layers" size={23} color={colors.muted} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10.5, color: colors.muted }}>More</Text>
      </Pressable>
      <Pressable onPress={openCopilot} accessibilityLabel="Ask the co-pilot"
        style={{ position: 'absolute', alignSelf: 'center', left: '50%', marginLeft: -30, bottom: 52, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 6, borderColor: colors.paper, shadowColor: colors.accent, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
        <Icon name="sparkle" size={26} color="#fff" />
      </Pressable>
    </View>
  )
}
