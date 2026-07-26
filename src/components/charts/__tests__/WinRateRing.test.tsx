import { render } from '@testing-library/react-native'
import { processColor } from 'react-native'
import { WinRateRing } from '../WinRateRing'
import { colors } from '../../../theme'

const nodes = (n: any, t: string, acc: any[] = []): any[] => {
  if (!n || typeof n !== 'object') return acc
  if (n.type === t) acc.push(n)
  ;(n.children || []).forEach((c: any) => nodes(c, t, acc))
  return acc
}

// react-native-svg's <Text>/<TSpan> render as RNSVGText/RNSVGTSpan host
// components, which @testing-library/react-native's getByText does not
// recognise (it only looks for 'Text'/'RCTText' — see
// node_modules/@testing-library/react-native/dist/helpers/host-component-names.js).
// So text content is asserted via the RNSVGTSpan's `content` prop instead,
// the same way primitives.test.tsx reads processed color/fill props directly
// off the RNSVG* host props rather than through RNTL's Text-only matchers.
const tspanContents = (tree: any) => nodes(tree, 'RNSVGTSpan').map((n) => n.props.content)
const svgColor = (c: string) => ({ type: 0, payload: processColor(c) })

test('renders the value as centred text with a % suffix', async () => {
  const r = await render(<WinRateRing value={64} />)
  expect(tspanContents(r.toJSON())).toContain('64%')
})

test('renders the WIN RATE mono label', async () => {
  const r = await render(<WinRateRing value={64} />)
  expect(tspanContents(r.toJSON())).toContain('WIN RATE')
})

test('draws a track circle and a progress circle', async () => {
  const r = await render(<WinRateRing value={50} />)
  const circles = nodes(r.toJSON(), 'RNSVGCircle')
  expect(circles).toHaveLength(2)
})

test('defaults to size 118 and colors.accent for the progress stroke', async () => {
  const r = await render(<WinRateRing value={50} />)
  const svg = r.toJSON() as any
  expect(svg.props).toMatchObject({ width: 118, height: 118 })
  const circles = nodes(r.toJSON(), 'RNSVGCircle')
  expect(circles[0].props.stroke).toEqual(svgColor(colors.border))
  expect(circles[1].props.stroke).toEqual(svgColor(colors.accent))
})

test('honours explicit size and color props, keeping stroke width fixed at 11', async () => {
  const r = await render(<WinRateRing value={50} size={60} color="#ff0000" />)
  const svg = r.toJSON() as any
  expect(svg.props).toMatchObject({ width: 60, height: 60 })
  const circles = nodes(r.toJSON(), 'RNSVGCircle')
  const expectedRadius = (60 - 11) / 2
  expect(circles[0].props).toMatchObject({ cx: 30, cy: 30, r: expectedRadius, strokeWidth: 11 })
  expect(circles[1].props.stroke).toEqual(svgColor('#ff0000'))
})

test('progress circle uses a rounded cap and a dash offset driven by value', async () => {
  const r = await render(<WinRateRing value={25} size={118} />)
  const circles = nodes(r.toJSON(), 'RNSVGCircle')
  const progress = circles[1]
  // react-native-svg's native prop processing maps the strokeLinecap enum
  // to a number ('round' === 1); this is the same processed-prop pattern
  // primitives.test.tsx uses for fill colors via processColor.
  expect(progress.props.strokeLinecap).toBe(1)
  const size = 118, sw = 11
  const radius = (size - sw) / 2
  const circumference = 2 * Math.PI * radius
  const dasharray = (progress.props.strokeDasharray as string[]).map(Number)
  expect(dasharray[0]).toBeCloseTo(circumference)
  expect(progress.props.strokeDashoffset).toBeCloseTo(circumference * (1 - 25 / 100))
})

test('rotates the progress circle -90deg around the ring centre (matrix has zero diagonal, unit off-diagonal)', async () => {
  const r = await render(<WinRateRing value={50} size={100} />)
  const circles = nodes(r.toJSON(), 'RNSVGCircle')
  const matrix = circles[1].props.matrix as number[]
  expect(matrix).toBeDefined()
  const [a, b, c, d] = matrix
  expect(a).toBeCloseTo(0)
  expect(b).toBeCloseTo(-1)
  expect(c).toBeCloseTo(1)
  expect(d).toBeCloseTo(0)
})
