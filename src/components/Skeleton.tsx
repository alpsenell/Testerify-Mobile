import { useEffect, useRef } from 'react'
import { Animated, DimensionValue } from 'react-native'
import { colors } from '../theme'

export function Skeleton({ height, width = '100%' as DimensionValue, borderRadius = 15 }: {
  height: number; width?: DimensionValue; borderRadius?: number
}) {
  const opacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [opacity])
  return <Animated.View style={{ height, width, borderRadius, backgroundColor: colors.track, opacity }} />
}
