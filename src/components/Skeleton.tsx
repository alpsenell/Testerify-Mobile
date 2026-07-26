import { useEffect, useRef } from 'react'
import { Animated, DimensionValue } from 'react-native'
import { colors } from '../theme'
import { isTestEnv } from '../utils/env'

export function Skeleton({ height, width = '100%' as DimensionValue, borderRadius = 15 }: {
  height: number; width?: DimensionValue; borderRadius?: number
}) {
  const opacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    // Animated.loop schedules a real timer that Jest's fake/real environment
    // never settles on its own (there's no "loop complete" event), so every
    // suite that mounts a Skeleton leaks a timer and the Jest worker has to be
    // force-killed on exit. The pulse is purely cosmetic, so skip starting it
    // under test — RN component tests don't assert on animation frames.
    if (isTestEnv()) return
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [opacity])
  return <Animated.View style={{ height, width, borderRadius, backgroundColor: colors.track, opacity }} />
}
