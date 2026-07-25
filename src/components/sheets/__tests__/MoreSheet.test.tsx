import { render, screen, fireEvent } from '@testing-library/react-native'
import { MoreSheet } from '../MoreSheet'
import { useSheets } from '../../../stores/sheets'
import { useToast } from '../../../stores/toast'

// Toast's auto-hide schedules a real setTimeout; use fake timers so it
// doesn't leak a pending timer past the end of the test run.
jest.useFakeTimers()

const LABELS = [
  'Learnings', 'Nudges', 'Flows', 'Audiences', 'Analytics', 'Products',
  'Events', 'Heatmaps', 'Replays', 'Tracking', 'Funnel', 'Pages',
  'Favorites', 'Live', 'Team', 'Settings',
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
