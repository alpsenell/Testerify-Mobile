import { render, screen, fireEvent } from '@testing-library/react-native'
import { router } from 'expo-router'
import { MoreSheet } from '../MoreSheet'
import { useSheets } from '../../../stores/sheets'
import { useToast } from '../../../stores/toast'

// Toast's auto-hide schedules a real setTimeout; use fake timers so it
// doesn't leak a pending timer past the end of the test run.
jest.useFakeTimers()

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

// 'Live' is excluded here — it now navigates to a real screen instead of
// showing the generic "coming to mobile" toast; covered separately below.
const LABELS = [
  'Learnings', 'Nudges', 'Flows', 'Audiences', 'Analytics', 'Products',
  'Events', 'Heatmaps', 'Replays', 'Tracking', 'Funnel', 'Pages',
  'Favorites', 'Team', 'Settings',
]

beforeEach(() => {
  useSheets.setState({ sheet: { kind: 'more' } })
  useToast.setState({ message: null })
})

test('tapping an item closes the sheet and shows its toast', async () => {
  await render(<MoreSheet />)
  fireEvent.press(screen.getByText('Learnings'))
  expect(useSheets.getState().sheet).toBeNull()
  expect(useToast.getState().message).toBe(
    'Learnings is coming to mobile — it lives on the desktop panel for now.'
  )
})

test.each(LABELS)('tapping "%s" closes the sheet and shows its own toast', async (label) => {
  await render(<MoreSheet />)
  fireEvent.press(screen.getAllByText(label)[0])
  expect(useSheets.getState().sheet).toBeNull()
  expect(useToast.getState().message).toBe(
    `${label} is coming to mobile — it lives on the desktop panel for now.`
  )
})

test('tapping "Live" closes the sheet and navigates to the Live screen instead of showing a toast', async () => {
  await render(<MoreSheet />)
  fireEvent.press(screen.getAllByText('Live')[0])
  expect(useSheets.getState().sheet).toBeNull()
  expect(router.push).toHaveBeenCalledWith('/screens/live')
  expect(useToast.getState().message).toBeNull()
})
