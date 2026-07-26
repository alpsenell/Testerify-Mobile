import { Pressable, Text, View } from 'react-native'
import { colors, fonts } from '../theme'

export type SegmentOption = { key: string; label: string }

// Port of the design's dimension toggle (docs/design/Testerify-Mobile.dc.html
// lines 590-594) — 2px-padded track (colors.track bg + colors.border border,
// radius 8), segments min-height 38 / radius 6, active segment gets a
// colors.card background + subtle shadow + colors.ink text, inactive
// segments stay transparent with colors.muted text.
export function SegmentedControl({ options, active, onPick }: {
  options: SegmentOption[]; active: string; onPick: (key: string) => void
}) {
  return (
    <View style={{
      flexDirection: 'row', gap: 2, padding: 2,
      backgroundColor: colors.track, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    }}>
      {options.map((o) => {
        const isActive = o.key === active
        return (
          <Pressable key={o.key} onPress={() => onPick(o.key)} style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            minHeight: 38, borderRadius: 6, paddingHorizontal: 12,
            backgroundColor: isActive ? colors.card : 'transparent',
            shadowColor: '#282214',
            shadowOpacity: isActive ? 0.08 : 0,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            elevation: isActive ? 1 : 0,
          }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: isActive ? colors.ink : colors.muted }}>
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
