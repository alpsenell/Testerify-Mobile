import { render } from '@testing-library/react-native'
import { Sparkline } from '../Sparkline'
import { DetailChart } from '../DetailChart'

const nodes = (n: any, t: string, acc: any[] = []): any[] => {
  if (!n || typeof n !== 'object') return acc
  if (n.type === t) acc.push(n)
  ;(n.children || []).forEach((c: any) => nodes(c, t, acc))
  return acc
}

test('Sparkline renders without crashing given valid data', async () => {
  const r = await render(<Sparkline data={[1, 3, 2, 4, 3]} color="#5b54e0" width={80} height={28} />)
  expect(nodes(r.toJSON(), 'RNSVGPath').length).toBeGreaterThan(0)
})

test('Sparkline renders safely with empty/single-point data', async () => {
  const empty = await render(<Sparkline data={[]} color="#5b54e0" width={80} height={28} />)
  expect(nodes(empty.toJSON(), 'RNSVGPath').length).toBe(0)
  const single = await render(<Sparkline data={[3]} color="#5b54e0" width={80} height={28} />)
  expect(nodes(single.toJSON(), 'RNSVGPath').length).toBe(0)
})

test('DetailChart renders without crashing given valid data', async () => {
  const labels = ['Jul 17', 'Jul 18', 'Jul 19', 'Jul 20']
  const seriesA = [3.9, 4.1, 4.0, 4.3]
  const seriesB = [4.0, 4.3, 4.5, 4.6]
  const r = await render(<DetailChart labels={labels} seriesA={seriesA} seriesB={seriesB} />)
  expect(nodes(r.toJSON(), 'RNSVGPath').length).toBeGreaterThan(0)
  expect(nodes(r.toJSON(), 'RNSVGCircle').length).toBe(1)
})

test('DetailChart returns null for empty series', async () => {
  const labels = ['Jul 17', 'Jul 18']
  const r = await render(<DetailChart labels={labels} seriesA={[]} seriesB={[]} />)
  expect(r.toJSON()).toBeNull()
})

test('DetailChart returns null when labels.length < 2', async () => {
  const r = await render(<DetailChart labels={['Jul 17']} seriesA={[1, 2]} seriesB={[1, 2]} />)
  expect(r.toJSON()).toBeNull()
})

test('DetailChart renders finite geometry when all values are equal (zero data range)', async () => {
  const labels = ['Jul 17', 'Jul 18', 'Jul 19']
  const r = await render(<DetailChart labels={labels} seriesA={[4, 4, 4]} seriesB={[4, 4, 4]} />)
  const circle = nodes(r.toJSON(), 'RNSVGCircle')[0]
  expect(Number.isFinite(circle.props.cx)).toBe(true)
  expect(Number.isFinite(circle.props.cy)).toBe(true)
  const path = nodes(r.toJSON(), 'RNSVGPath')[0]
  expect(path.props.d).not.toContain('NaN')
})
