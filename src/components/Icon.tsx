import Svg, { Path, Circle, Rect } from 'react-native-svg'

const P = {
  home: 'M4 11.5 12 4l8 7.5 M6 10v9.5h12V10 M10 19.5V14h4v5.5',
  beaker: 'M9 3h6 M10 3v6L5.5 17a2.2 2.2 0 0 0 2 3.2h9a2.2 2.2 0 0 0 2-3.2L14 9V3 M7.5 14h9',
  bars: 'M5 20V10 M12 20V4 M19 20v-7',
  star: 'M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z',
  sparkle: 'M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  arrowUp: 'M12 19V5 M6 11l6-6 6 6',
  arrowLeft: 'M19 12H5 M11 6l-6 6 6 6',
  trendUp: 'M4 16l5-5 3 3 7-7 M16 7h4v4',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19 M19.5 19v-1.4a3.5 3.5 0 0 0-2.6-3.4M15.5 5.2a3.2 3.2 0 0 1 0 5.6',
  target: '', // circles-only icon — see special-case render below
  dollar: 'M12 3v18 M16 7.5C16 5.6 14.2 4.5 12 4.5S8 5.6 8 7.5 9.8 10 12 10.5s4 1.2 4 3.2-1.8 3-4 3-4-1.1-4-3',
  bolt: 'M13 3 5 13h6l-1 8 8-10h-6z',
  check: 'M5 12.5l4.5 4.5L19 7',
  plus: 'M12 5v14M5 12h14',
  play: 'M7 5.5v13l11-6.5z',
  pause: 'M9 5v14M15 5v14',
  flag: 'M6 21V4 M6 5h11l-2 3.5L17 12H6',
  clock: 'M12 8v4.5l3 1.8', // + circle r8 special-case
  chevron: 'M9 6l6 6-6 6',
  layers: 'M12 4l8 4-8 4-8-4z M4 12l8 4 8-4',
  x: 'M6 6l12 12M18 6 6 18',
  warning: 'M10.3 4.3 2.6 17.7A2 2 0 0 0 4.3 20.7h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z M12 9.5v4',
  search: 'M20 20l-3.5-3.5', // + circle cx11 cy11 r6 special-case
  mail: 'M3.5 7l8.5 6 8.5-6', // + rect special-case
  send: 'M21 3 10 14 M21 3l-7 18-3-8-8-3z',
  trash: 'M5 7h14 M9 7V5h6v2 M7 7l1 12.5h8L17 7',
}

export type IconName = keyof typeof P

export function Icon({ name, size = 16, color = '#211e1a', strokeWidth = 1.6, filled = false }: {
  name: IconName; size?: number; color?: string; strokeWidth?: number; filled?: boolean
}) {
  const common = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'target' && (<>
        <Circle cx={12} cy={12} r={8} {...common} /><Circle cx={12} cy={12} r={4} {...common} /><Circle cx={12} cy={12} r={0.6} fill={color} />
      </>)}
      {name === 'clock' && <Circle cx={12} cy={12} r={8} {...common} />}
      {name === 'search' && <Circle cx={11} cy={11} r={6} {...common} />}
      {name === 'warning' && <Circle cx={12} cy={16.8} r={0.7} fill={color} />}
      {name === 'mail' && <Rect x={3} y={6} width={18} height={12} rx={2} {...common} />}
      {P[name] ? <Path d={P[name]} {...common} fill={filled || name === 'play' ? color : 'none'} /> : null}
    </Svg>
  )
}
