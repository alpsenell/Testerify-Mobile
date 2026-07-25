import { smoothPath } from '../path'

test('empty and single point → empty path', () => {
  expect(smoothPath([])).toBe('')
  expect(smoothPath([{ x: 0, y: 0 }])).toBe('')
})

test('two points produce M + C segments', () => {
  const d = smoothPath([{ x: 0, y: 10 }, { x: 100, y: 20 }])
  expect(d.startsWith('M 0 10')).toBe(true)
  expect(d).toContain(' C ')
})

test('n points produce n-1 curve segments', () => {
  const d = smoothPath([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 3, y: 1 }])
  expect(d.split(' C ').length - 1).toBe(3)
})
