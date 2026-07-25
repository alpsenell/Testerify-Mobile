import { useSheets } from '../sheets'
import { useToast } from '../toast'

jest.useFakeTimers()

test('sheet transitions', () => {
  const s = useSheets.getState()
  s.openMore()
  expect(useSheets.getState().sheet).toEqual({ kind: 'more' })
  useSheets.getState().openShip('c1')
  expect(useSheets.getState().sheet).toEqual({ kind: 'ship', campaignId: 'c1' })
  useSheets.getState().close()
  expect(useSheets.getState().sheet).toBeNull()
})

test('toast auto-hides after 4200ms', () => {
  useToast.getState().show('Shipped!')
  expect(useToast.getState().message).toBe('Shipped!')
  jest.advanceTimersByTime(4300)
  expect(useToast.getState().message).toBeNull()
})
