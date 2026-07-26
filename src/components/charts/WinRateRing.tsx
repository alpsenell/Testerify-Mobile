import Svg, { Circle, Text as SvgText } from 'react-native-svg'
import { colors, fonts } from '../../theme'

// Port of the design prototype's ring() (docs/design/Testerify-Mobile.dc.html
// lines 1341-1352) — win-rate ring, same read as Ring.vue on the desktop
// Analytics page. Track circle in colors.border, progress circle in `color`
// (rounded cap, -90deg start so progress begins at 12 o'clock), centred
// value text + a mono 'WIN RATE' label beneath it.
export function WinRateRing({ value, color = colors.accent, size = 118 }: {
  value: number; color?: string; size?: number
}) {
  const sw = 11
  const r = (size - sw) / 2
  const c = 2 * Math.PI * r
  const cx = size / 2
  const cy = size / 2

  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.border} strokeWidth={sw} />
      <Circle
        cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={String(c)}
        strokeDashoffset={c * (1 - value / 100)}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <SvgText x={cx} y={cy + 4} textAnchor="middle" fontSize={30} fill={colors.ink} fontFamily={fonts.sans}>
        {`${value}%`}
      </SvgText>
      <SvgText x={cx} y={cy + 24} textAnchor="middle" fontSize={9} fill={colors.muted} fontFamily={fonts.mono} letterSpacing={1.2}>
        WIN RATE
      </SvgText>
    </Svg>
  )
}
