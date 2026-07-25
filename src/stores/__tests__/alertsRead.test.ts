import { useAlertsRead } from '../alertsRead'

beforeEach(() => {
  useAlertsRead.setState({ readIds: [] })
})

test('markAllRead unions ids without duplicating', () => {
  useAlertsRead.getState().markAllRead(['a', 'b'])
  expect(useAlertsRead.getState().readIds.sort()).toEqual(['a', 'b'])

  useAlertsRead.getState().markAllRead(['b', 'c'])
  expect(useAlertsRead.getState().readIds.sort()).toEqual(['a', 'b', 'c'])
})

test('starts empty', () => {
  expect(useAlertsRead.getState().readIds).toEqual([])
})
