import { render, screen, fireEvent } from '@testing-library/react-native'
import { router } from 'expo-router'
import { MoreSheet } from '../MoreSheet'
import { useSheets } from '../../../stores/sheets'
import { useToast } from '../../../stores/toast'

// Toast's auto-hide schedules a real setTimeout; use fake timers so it
// doesn't leak a pending timer past the end of the test run.
jest.useFakeTimers()

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

// Audiences is the only More item that still toasts — it has no backing
// entity in the panel (see the Phase 3 spec). All 15 others navigate, and
// every route is asserted below.
const LABELS = ['Audiences']

// Built screens, by label and route.
const ROUTED: [string, string][] = [
  ['Live', '/screens/live'],
  ['Learnings', '/screens/learnings'],
  ['Analytics', '/screens/analytics'],
  ['Funnel', '/screens/funnel'],
  ['Heatmaps', '/screens/heatmaps'],
  ['Tracking', '/screens/tracking'],
  ['Products', '/screens/products'],
  ['Pages', '/screens/pages'],
  ['Events', '/screens/events'],
  ['Replays', '/screens/replays'],
  ['Favorites', '/screens/favorites'],
  ['Flows', '/screens/flows'],
  ['Nudges', '/screens/nudges'],
  ['Team', '/screens/team'],
  ['Settings', '/screens/settings'],
]

beforeEach(() => {
  useSheets.setState({ sheet: { kind: 'more' } })
  useToast.setState({ message: null })
})

test.each(LABELS)('tapping "%s" closes the sheet and shows its own toast', async (label) => {
  await render(<MoreSheet />)
  fireEvent.press(screen.getAllByText(label)[0])
  expect(useSheets.getState().sheet).toBeNull()
  expect(useToast.getState().message).toBe(
    'Saved audiences live on the desktop panel.'
  )
})

test.each(ROUTED)('tapping "%s" closes the sheet and navigates to %s instead of showing a toast', async (label, route) => {
  await render(<MoreSheet />)
  fireEvent.press(screen.getAllByText(label)[0])
  expect(useSheets.getState().sheet).toBeNull()
  expect(router.push).toHaveBeenCalledWith(route)
  expect(useToast.getState().message).toBeNull()
})
