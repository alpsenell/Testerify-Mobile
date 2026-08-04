import { clickShare, deviceSplit, frustration, totalClicks } from '../heatmap'
import type { HeatmapPage } from '../heatmap'

const page = (over: Partial<HeatmapPage> = {}): HeatmapPage => ({
  path: '/', total: 100, rage: 0, dead: 0,
  byDevice: { desktop: 60, mobile: 40, tablet: 0, unknown: 0 },
  ...over,
})

test('device split names the two biggest shares, skipping empty devices', () => {
  expect(deviceSplit(page())).toBe('60% desktop · 40% mobile')
  expect(deviceSplit(page({ byDevice: { desktop: 10, mobile: 70, tablet: 20, unknown: 0 } })))
    .toBe('70% mobile · 20% tablet')
})

test('device split says so when the endpoint reports no device breakdown', () => {
  expect(deviceSplit(page({ byDevice: { desktop: 0, mobile: 0, tablet: 0, unknown: 0 } }))).toBe('no device data')
})

test('frustration chip only appears when there is a signal', () => {
  expect(frustration(page())).toBeNull()
  expect(frustration(page({ rage: 12 }))).toBe('12 rage')
  expect(frustration(page({ dead: 3 }))).toBe('3 dead')
  expect(frustration(page({ rage: 12, dead: 3 }))).toBe('12 rage · 3 dead')
})

test('totals and share', () => {
  const pages = [page({ total: 300 }), page({ total: 100 })]
  expect(totalClicks(pages)).toBe(400)
  expect(clickShare(pages[0], 400)).toBe(75)
  expect(clickShare(pages[0], 0)).toBe(0)
})
