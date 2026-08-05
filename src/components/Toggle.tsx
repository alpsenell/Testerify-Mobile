import { Pressable, View } from 'react-native'
import { colors } from '../theme'

// Port of the design's switch (docs/design/Testerify-Mobile.dc.html ~797-799):
// 52×32 track, 26px knob, 3px inset. Wrapped in a 44px-tall pressable so the
// touch target clears the minimum even though the switch itself is shorter.
export function Toggle({ value, onValueChange, disabled = false, accessibilityLabel }: {
  value: boolean
  onValueChange: (next: boolean) => void
  disabled?: boolean
  accessibilityLabel: string
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={{ minHeight: 44, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
    >
      <View style={{ width: 52, height: 32, borderRadius: 999, backgroundColor: value ? colors.pos : colors.handle, justifyContent: 'center' }}>
        <View style={{
          position: 'absolute', top: 3, left: value ? 23 : 3,
          width: 26, height: 26, borderRadius: 13, backgroundColor: colors.white,
          shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
        }} />
      </View>
    </Pressable>
  )
}
