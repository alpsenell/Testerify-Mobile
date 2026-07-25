import { Fragment, useId } from 'react'
import Svg, { Path, Line, Text as SvgText, Defs, LinearGradient, Stop, Circle } from 'react-native-svg'
import { colors, fonts } from '../../theme'
import { smoothPath } from './path'

const W = 306
const PAD = { l: 26, r: 6, t: 12, b: 24 }

// Port of the design prototype's detailChart() — dashed muted control line,
// solid accent challenger line with gradient fill + end dot, 5 gridlines with
// y labels, x labels every 2nd point. Deviation from the prototype: the
// y-domain is derived from the data (min/max padded 10%) instead of the
// prototype's hardcoded 3.4–5.4.
export function DetailChart({ labels, seriesA, seriesB, height = 176 }: {
  labels: string[]; seriesA: number[]; seriesB: number[]; height?: number
}) {
  const rawId = useId()
  const gradId = `mb-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`

  const n = Math.min(seriesA.length, seriesB.length)
  if (n < 2 || labels.length < 2) return null

  const H = height
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b

  const allValues = seriesA.slice(0, n).concat(seriesB.slice(0, n))
  const dataMin = Math.min(...allValues)
  const dataMax = Math.max(...allValues)
  const range = dataMax - dataMin
  const padAmt = range > 0 ? range * 0.1 : 1
  const lo = dataMin - padAmt
  const hi = dataMax + padAmt

  const xAt = (i: number) => PAD.l + (i / (n - 1)) * iw
  const yAt = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih

  const grid = []
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) / 4) * i
    const y = yAt(v)
    grid.push(
      <Fragment key={`g${i}`}>
        <Line x1={PAD.l} x2={PAD.l + iw} y1={y} y2={y} stroke={colors.border} strokeDasharray={i === 0 ? '0' : '2 5'} />
        <SvgText x={PAD.l - 6} y={y + 3.5} textAnchor="end" fontSize={9} fill={colors.muted} fontFamily={fonts.mono}>
          {v.toFixed(1)}
        </SvgText>
      </Fragment>
    )
  }

  const xl = labels.slice(0, n).map((label, i) =>
    i % 2 === 0 ? (
      <SvgText key={`x${i}`} x={xAt(i)} y={H - 6} textAnchor="middle" fontSize={9} fill={colors.muted} fontFamily={fonts.mono}>
        {label}
      </SvgText>
    ) : null
  )

  const pathOf = (s: number[]) => smoothPath(s.slice(0, n).map((v, i) => ({ x: xAt(i), y: yAt(v) })))
  const bLine = pathOf(seriesB)

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {grid}
      {xl}
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={`${bLine} L ${xAt(n - 1)} ${PAD.t + ih} L ${xAt(0)} ${PAD.t + ih} Z`} fill={`url(#${gradId})`} />
      <Path d={pathOf(seriesA)} fill="none" stroke={colors.muted} strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" />
      <Path d={bLine} fill="none" stroke={colors.accent} strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx={xAt(n - 1)} cy={yAt(seriesB[n - 1])} r={4} fill={colors.accent} stroke={colors.card} strokeWidth={2} />
    </Svg>
  )
}
