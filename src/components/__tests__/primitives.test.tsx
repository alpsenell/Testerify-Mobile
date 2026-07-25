import { render, screen, fireEvent } from '@testing-library/react-native'
import { Animated, Text, processColor } from 'react-native'
import { Icon, IconName } from '../Icon'
import { StatusPill } from '../StatusPill'
import { RetryCard } from '../RetryCard'
import { EmptyState } from '../EmptyState'
import { Skeleton } from '../Skeleton'
import { Card } from '../Card'
import { colors, radius } from '../../theme'

const types = (n: any, acc: Record<string, number> = {}) => {
  if (!n || typeof n !== 'object') return acc
  if (n.type) acc[n.type] = (acc[n.type] || 0) + 1
  ;(n.children || []).forEach((c: any) => types(c, acc))
  return acc
}
const drawn = (t: Record<string, number>) =>
  (t.RNSVGPath || 0) + (t.RNSVGCircle || 0) + (t.RNSVGRect || 0)

const NAMES: IconName[] = ['home','beaker','bars','star','sparkle','arrowUp','arrowLeft','trendUp',
  'users','target','dollar','bolt','check','plus','play','pause','flag','clock',
  'chevron','layers','x','warning','search','mail','send','trash']

// StatusPill and basic component tests
test('StatusPill renders its label', async () => {
  const { getByText } = await render(<StatusPill label="Running" tone="pos" pulse />)
  expect(getByText('Running')).toBeTruthy()
})

test('RetryCard fires onRetry', async () => {
  const onRetry = jest.fn()
  await render(<RetryCard onRetry={onRetry} />)
  fireEvent.press(screen.getByText('Retry'))
  expect(onRetry).toHaveBeenCalledTimes(1)
})

test('EmptyState renders message', async () => {
  const { getByText } = await render(<EmptyState message="No tests match." />)
  expect(getByText('No tests match.')).toBeTruthy()
})

// Icon tests
test.each(NAMES)('Icon "%s" renders at least one drawn element', async (name) => {
  const r = await render(<Icon name={name} />)
  expect(drawn(types(r.toJSON()))).toBeGreaterThan(0)
})

test('Icon clock draws a circle and a path', async () => {
  const r = await render(<Icon name="clock" />)
  expect(types(r.toJSON())).toMatchObject({ RNSVGCircle: 1, RNSVGPath: 1 })
})

test('Icon mail draws a rect and a path', async () => {
  const r = await render(<Icon name="mail" />)
  expect(types(r.toJSON())).toMatchObject({ RNSVGRect: 1, RNSVGPath: 1 })
})

test('Icon target is circles-only (empty path string must stay falsy)', async () => {
  const t = types((await render(<Icon name="target" />)).toJSON())
  expect(t.RNSVGCircle).toBe(3)
  expect(t.RNSVGPath).toBeUndefined()
})

// StatusPill extended tests
test('StatusPill with pulse renders the animated dot', async () => {
  const r = await render(<StatusPill label="Running" tone="pos" pulse />)
  expect(types(r.toJSON()).View).toBe(2)
})

test('StatusPill without pulse renders no dot', async () => {
  const r = await render(<StatusPill label="Running" tone="pos" />)
  expect(types(r.toJSON()).View).toBe(1)
})

test('StatusPill tone selects the matching foreground colour', async () => {
  await render(<StatusPill label="Warn" tone="warn" />)
  expect(screen.getByText('Warn').props.style.color).toBe(colors.warn)
})

// Skeleton tests
test('Skeleton stops its animation loop on unmount', async () => {
  const stop = jest.fn()
  const spy = jest.spyOn(Animated, 'loop')
    .mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() } as any)
  const r = await render(<Skeleton height={20} />)
  await r.unmount()
  expect(stop).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

// Card tests
const flat = (s: any) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean))

test('Card renders its children', async () => {
  await render(<Card><Text>inside</Text></Card>)
  expect(screen.getByText('inside')).toBeTruthy()
})

test('Card applies base surface styling', async () => {
  const r = await render(<Card><Text>x</Text></Card>)
  expect(flat((r.toJSON() as any).props.style)).toMatchObject({
    backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.card,
  })
})

test('Card style prop overrides the base', async () => {
  const r = await render(<Card style={{ padding: 99, backgroundColor: 'red' }}><Text>x</Text></Card>)
  const s = flat((r.toJSON() as any).props.style)
  expect(s.padding).toBe(99)
  expect(s.backgroundColor).toBe('red')
})

// StatusPill pulse cleanup test
test('StatusPill stops its pulse loop on unmount', async () => {
  const stop = jest.fn()
  const spy = jest.spyOn(Animated, 'loop')
    .mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() } as any)
  const r = await render(<StatusPill label="Running" tone="pos" pulse />)
  await r.unmount()
  expect(stop).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

// Icon fill tests
const svgFill = (c: string) => ({ type: 0, payload: processColor(c) })
const nodes = (n: any, t: string, acc: any[] = []): any[] => {
  if (!n || typeof n !== 'object') return acc
  if (n.type === t) acc.push(n)
  ;(n.children || []).forEach((c: any) => nodes(c, t, acc))
  return acc
}
const pathFill = (tree: any) => nodes(tree, 'RNSVGPath')[0].props.fill

test('Icon path is unfilled by default', async () => {
  expect(pathFill((await render(<Icon name="star" />)).toJSON())).toBeNull()
})

test('Icon filled=true fills the path with the colour', async () => {
  const r = await render(<Icon name="star" filled color="#ff0000" />)
  expect(pathFill(r.toJSON())).toEqual(svgFill('#ff0000'))
})

test('Icon "play" is always filled even without the filled prop', async () => {
  const r = await render(<Icon name="play" color="#123456" />)
  expect(pathFill(r.toJSON())).toEqual(svgFill('#123456'))
})

// StatusPill tone tests
import { PillTone } from '../StatusPill'

const TONE_CASES: [PillTone, string, string][] = [
  ['pos', colors.pos, colors.posSoft],
  ['accent', colors.accent, colors.accentSoft],
  ['warn', colors.warn, colors.warnSoft],
  ['neutral', colors.secondary, colors.track],
]

test.each(TONE_CASES)('StatusPill tone "%s" maps fg and bg', async (tone, fg, bg) => {
  const r = await render(<StatusPill label="L" tone={tone} />)
  expect(screen.getByText('L').props.style.color).toBe(fg)
  expect(nodes(r.toJSON(), 'View')[0].props.style.backgroundColor).toBe(bg)
})

test('StatusPill does not start a loop when pulse is false', async () => {
  const spy = jest.spyOn(Animated, 'loop')
  await render(<StatusPill label="L" tone="pos" />)
  expect(spy).not.toHaveBeenCalled()
  spy.mockRestore()
})

// RetryCard message tests
test('RetryCard shows its default message', async () => {
  await render(<RetryCard onRetry={jest.fn()} />)
  expect(screen.getByText("Couldn't load. Check your connection.")).toBeTruthy()
})

test('RetryCard shows a custom message', async () => {
  await render(<RetryCard message="Offline." onRetry={jest.fn()} />)
  expect(screen.getByText('Offline.')).toBeTruthy()
})

// Animation start tests
test('Skeleton starts its shimmer loop on mount', async () => {
  const start = jest.fn()
  const spy = jest.spyOn(Animated, 'loop')
    .mockReturnValue({ start, stop: jest.fn(), reset: jest.fn() } as any)
  await render(<Skeleton height={20} />)
  expect(start).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

test('StatusPill starts its pulse loop when pulse is true', async () => {
  const start = jest.fn()
  const spy = jest.spyOn(Animated, 'loop')
    .mockReturnValue({ start, stop: jest.fn(), reset: jest.fn() } as any)
  await render(<StatusPill label="Running" tone="pos" pulse />)
  expect(start).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

// Skeleton size tests
test('Skeleton applies its size defaults', async () => {
  const r = await render(<Skeleton height={20} />)
  expect(flat((r.toJSON() as any).props.style)).toMatchObject({
    height: 20, width: '100%', borderRadius: 15, backgroundColor: colors.track,
  })
})

test('Skeleton honours explicit width and borderRadius', async () => {
  const r = await render(<Skeleton height={8} width={40} borderRadius={4} />)
  expect(flat((r.toJSON() as any).props.style)).toMatchObject({
    height: 8, width: 40, borderRadius: 4,
  })
})

// Icon special case and prop tests
const svgColor = (c: string) => ({ type: 0, payload: processColor(c) })

test('Icon search draws the lens circle and the handle path', async () => {
  const r = await render(<Icon name="search" />)
  expect(types(r.toJSON())).toMatchObject({ RNSVGCircle: 1, RNSVGPath: 1 })
})

test('Icon warning draws the exclamation dot and the triangle path', async () => {
  const r = await render(<Icon name="warning" />)
  expect(types(r.toJSON())).toMatchObject({ RNSVGCircle: 1, RNSVGPath: 1 })
})

test('Icon size drives the rendered svg width and height', async () => {
  const r = await render(<Icon name="home" size={40} />)
  expect((r.toJSON() as any).props).toMatchObject({ width: 40, height: 40 })
})

test('Icon size defaults to 16', async () => {
  const r = await render(<Icon name="home" />)
  expect((r.toJSON() as any).props).toMatchObject({ width: 16, height: 16 })
})

test('Icon strokeWidth reaches the drawn path', async () => {
  const r = await render(<Icon name="home" strokeWidth={3} />)
  expect(nodes(r.toJSON(), 'RNSVGPath')[0].props.strokeWidth).toBe(3)
})

test('Icon color drives the stroke of an unfilled icon', async () => {
  const r = await render(<Icon name="home" color="#ff0000" />)
  expect(nodes(r.toJSON(), 'RNSVGPath')[0].props.stroke).toEqual(svgColor('#ff0000'))
})

// Animated value wiring tests
afterEach(() => { jest.restoreAllMocks() })

test('Skeleton binds its animated value to the rendered opacity', async () => {
  const timing = jest.spyOn(Animated, 'timing')
  const r = await render(<Skeleton height={20} />)
  const value = timing.mock.calls[0][0] as Animated.Value
  value.setValue(0.42)
  await r.rerender(<Skeleton height={20} />)
  expect(flat((r.toJSON() as any).props.style).opacity).toBe(0.42)
})

test('StatusPill binds its animated value to the pulse dot opacity', async () => {
  const timing = jest.spyOn(Animated, 'timing')
  const r = await render(<StatusPill label="Running" tone="pos" pulse />)
  const value = timing.mock.calls[0][0] as Animated.Value
  value.setValue(0.42)
  await r.rerender(<StatusPill label="Running" tone="pos" pulse />)
  expect(flat(nodes(r.toJSON(), 'View')[1].props.style).opacity).toBe(0.42)
})

test('Icon scales its 24x24 artwork into the requested size', async () => {
  const r = await render(<Icon name="home" size={40} />)
  expect((r.toJSON() as any).props).toMatchObject({
    width: 40, height: 40, minX: 0, minY: 0, vbWidth: 24, vbHeight: 24,
  })
})

test('Icon target centre dot is filled so the bullseye is visible', async () => {
  const r = await render(<Icon name="target" color="#ff0000" />)
  const circles = nodes(r.toJSON(), 'RNSVGCircle')
  expect(circles).toHaveLength(3)
  expect(circles[0].props.fill).toBeNull()
  expect(circles[1].props.fill).toBeNull()
  expect(circles[2].props.fill).toEqual(svgFill('#ff0000'))
})

test('Icon warning exclamation dot is filled so it is visible', async () => {
  const r = await render(<Icon name="warning" color="#ff0000" />)
  const circles = nodes(r.toJSON(), 'RNSVGCircle')
  expect(circles).toHaveLength(1)
  expect(circles[0].props.fill).toEqual(svgFill('#ff0000'))
})
