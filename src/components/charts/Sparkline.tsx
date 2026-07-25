import { useId } from 'react'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import { smoothPath } from './path'

// Port of the design prototype's spark() — smoothed line + soft gradient fill.
export function Sparkline({ data, color, width, height }: {
  data: number[]; color: string; width: number; height: number
}) {
  const rawId = useId()
  const gradId = `msp-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`

  if (data.length < 2) {
    return <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" />
  }

  const max = Math.max(...data)
  const min = Math.min(...data)
  const rng = max - min || 1
  const line = smoothPath(data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - 4 - ((v - min) / rng) * (height - 8),
  })))

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={`${line} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${gradId})`} />
      <Path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}
