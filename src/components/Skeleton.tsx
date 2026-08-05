import { useEffect, useRef, useState } from 'react'
import { Animated, DimensionValue, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../theme'
import { isTestEnv } from '../utils/env'

// Loading placeholder with a shimmer sweep — a soft highlight band that
// glides across the block. Reads unmistakably as "fetching" where the old
// opacity pulse could pass for static chrome.
export function Skeleton({ height, width = '100%' as DimensionValue, borderRadius = 15 }: {
  height: number; width?: DimensionValue; borderRadius?: number
}) {
  const sweep = useRef(new Animated.Value(0)).current
  const [measuredWidth, setMeasuredWidth] = useState(0)

  useEffect(() => {
    // Animated.loop schedules a real timer that Jest's fake/real environment
    // never settles on its own (there's no "loop complete" event), so every
    // suite that mounts a Skeleton leaks a timer and the Jest worker has to be
    // force-killed on exit. The shimmer is purely cosmetic, so skip starting
    // it under test — RN component tests don't assert on animation frames.
    if (isTestEnv() || measuredWidth === 0) return
    sweep.setValue(0)
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1100, useNativeDriver: true }),
        // Brief hold at the end so back-to-back sweeps don't strobe.
        Animated.delay(350),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [sweep, measuredWidth])

  const bandWidth = Math.max(64, measuredWidth * 0.45)
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-bandWidth, measuredWidth + bandWidth],
  })

  return (
    <View
      testID="skeleton"
      onLayout={(e) => setMeasuredWidth(e.nativeEvent.layout.width)}
      style={{ height, width, borderRadius, backgroundColor: colors.track, overflow: 'hidden' }}
    >
      {measuredWidth > 0 ? (
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: bandWidth, transform: [{ translateX }] }}>
          <LinearGradient
            colors={['rgba(252,251,247,0)', 'rgba(252,251,247,0.65)', 'rgba(252,251,247,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}
    </View>
  )
}
