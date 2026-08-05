import { inWindow, presetLabel, RANGE_PRESETS, windowSentence } from '../range'

test('presets mirror the web RangePicker', () => {
  expect(RANGE_PRESETS).toEqual([1, 7, 30, 90])
})

test('presetLabel names today and day counts', () => {
  expect(presetLabel(1)).toBe('Today')
  expect(presetLabel(7)).toBe('7d')
  expect(presetLabel(90)).toBe('90d')
})

test('windowSentence reads as a subtitle fragment', () => {
  expect(windowSentence(1)).toBe('Today')
  expect(windowSentence(30)).toBe('Last 30 days')
})

test('inWindow reads mid-sentence', () => {
  expect(inWindow(1)).toBe('today')
  expect(inWindow(7)).toBe('in the last 7 days')
})
