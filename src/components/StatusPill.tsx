import { useEffect, useRef } from 'react'
import { Animated, Text, View } from 'react-native'
import { colors, fonts } from '../theme'

const TONES = {
  pos: { fg: colors.pos, bg: colors.posSoft },
  accent: { fg: colors.accent, bg: colors.accentSoft },
  warn: { fg: colors.warn, bg: colors.warnSoft },
  neutral: { fg: colors.secondary, bg: colors.track },
} as const
export type PillTone = keyof typeof TONES

export function StatusPill({ label, tone, pulse = false }: { label: string; tone: PillTone; pulse?: boolean }) {
  const { fg, bg } = TONES[tone]
  const opacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (!pulse) return
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.35, duration: 1100, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 1100, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [pulse, opacity])
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      {pulse && <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg, opacity }} />}
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11.5, color: fg }}>{label}</Text>
    </View>
  )
}
