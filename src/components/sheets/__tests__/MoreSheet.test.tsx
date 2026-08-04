import { render, screen, fireEvent } from '@testing-library/react-native'
import { router } from 'expo-router'
import { MoreSheet } from '../MoreSheet'
import { useSheets } from '../../../stores/sheets'
import { useToast } from '../../../stores/toast'

// Toast's auto-hide schedules a real setTimeout; use fake timers so it
// doesn't leak a pending timer past the end of the test run.
jest.useFakeTimers()

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

// Labels that still toast. Built Phase-2 screens ('Live', 'Learnings') are
// excluded — they navigate to a real screen instead of showing the generic
// "coming to mobile" toast; each is covered by its own case below.
const LABELS = [
  'Nudges', 'Flows', 'Audiences', 'Products',
  'Events', 'Replays', 'Tracking', 'Pages',
  'Favorites', 'Team', 'Settings',
]

// Built screens, by label and route.
const ROUTED: [string, string][] = [
  ['Live', '/screens/live'],
  ['Learnings', '/screens/learnings'],
  ['Analytics', '/screens/analytics'],
  ['Funnel', '/screens/funnel'],
  ['Heatmaps', '/screens/heatmaps'],
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
    `${label} is coming to mobile — it lives on the desktop panel for now.`
  )
})

test.each(ROUTED)('tapping "%s" closes the sheet and navigates to %s instead of showing a toast', async (label, route) => {
  await render(<MoreSheet />)
  fireEvent.press(screen.getAllByText(label)[0])
  expect(useSheets.getState().sheet).toBeNull()
  expect(router.push).toHaveBeenCalledWith(route)
  expect(useToast.getState().message).toBeNull()
})
