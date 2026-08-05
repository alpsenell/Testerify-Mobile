import { render, screen, fireEvent } from '@testing-library/react-native'
import { router } from 'expo-router'
import { MoreSheet } from '../MoreSheet'
import { useSheets } from '../../../stores/sheets'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

// Every More item routes to a built screen now — Audiences joined the list
// with the creation flows, so the toast fallback is gone.
const ROUTED: [string, string][] = [
  ['Live', '/screens/live'],
  ['Learnings', '/screens/learnings'],
  ['Queue', '/screens/queue'],
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
  ['Audiences', '/screens/audiences'],
  ['Team', '/screens/team'],
  ['Settings', '/screens/settings'],
]

beforeEach(() => {
  useSheets.setState({ sheet: { kind: 'more' } })
})

test.each(ROUTED)('tapping "%s" closes the sheet and navigates to %s', async (label, route) => {
  await render(<MoreSheet />)
  fireEvent.press(screen.getAllByText(label)[0])
  expect(useSheets.getState().sheet).toBeNull()
  expect(router.push).toHaveBeenCalledWith(route)
})
