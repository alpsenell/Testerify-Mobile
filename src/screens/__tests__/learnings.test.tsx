import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { LearningsScreen } from '../Learnings'
import * as campaignsApi from '../../api/campaigns'
import type { CampaignListItem } from '../../api/campaigns'
import { useToast } from '../../stores/toast'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/campaigns')

const base: CampaignListItem = {
  id: 'x', name: '', kind: 'ab', status: 'completed', targetUrl: null, goals: null,
  rollout: null, learningNote: null,
  startsAt: '2026-06-24T00:00:00Z', endsAt: null, createdAt: '2026-06-20T00:00:00Z', updatedAt: '2026-07-08T00:00:00Z',
  variants: 2, visitors: 0, conversions: 0, revenue: 0, conversionRate: 0, started: '2026-06-24T00:00:00Z',
  control: null, challenger: null, uplift: 0, confidence: 0, pValue: 1, sigStatus: 'inconclusive',
  forecast: null, trend: [],
}

const shipped: CampaignListItem = {
  ...base, id: 'c1', name: 'Single-column checkout form', status: 'rollout',
  targetUrl: '/checkout', visitors: 21400, uplift: 11.5, confidence: 99, sigStatus: 'winning',
  rollout: { winnerVariantId: 'v2', promotedAt: '2026-07-08T00:00:00Z', uplift: 11.5, confidence: 99 },
  learningNote: 'Every field removed from the payment step paid for itself.',
}

const noWinner: CampaignListItem = {
  ...base, id: 'c2', name: 'Hero image: lifestyle vs product-only',
  visitors: 14900, endsAt: '2026-06-30T00:00:00Z', startsAt: '2026-06-10T00:00:00Z',
}

// The real toast store's auto-hide schedules a 4.2s setTimeout that outlives
// the test and keeps the Jest worker alive; fake timers aren't an option here
// (they stall the query promises RNTL's waitFor is waiting on), so the error
// test swaps in a spy for `show` and restores the real one afterwards.
const realShow = useToast.getState().show

const running: CampaignListItem = { ...base, id: 'c3', name: 'Sticky add-to-cart bar', status: 'running' }

let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  ;(campaignsApi.fetchCampaigns as jest.Mock).mockResolvedValue([shipped, noWinner, running])
  ;(campaignsApi.updateLearningNote as jest.Mock).mockResolvedValue({ campaign: {} })
  useToast.setState({ message: null })
})

afterEach(async () => {
  // react-query batches its observer notifications behind a setTimeout(0). A
  // query or mutation that settles at the very end of a test would otherwise
  // fire that batch after teardown — outside act(), which both warns and
  // leaves a timer holding the Jest worker open. Drain it inside act() first.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  useToast.setState({ show: realShow })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
})

const renderScreen = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><LearningsScreen /></QueryClientProvider>)
}

test('lists concluded tests only, with outcome, meta and note', async () => {
  const { getByText, getAllByText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('Single-column checkout form')).toBeTruthy())

  expect(getByText('Won +11.5% · 99% conf.')).toBeTruthy()
  expect(getByText('Hero image: lifestyle vs product-only')).toBeTruthy()
  // 'No winner' appears twice — as the filter chip and as this test's outcome pill.
  expect(getAllByText('No winner').length).toBe(2)

  // Still-running tests belong to the Tests tab, not the archive.
  expect(queryByText('Sticky add-to-cart bar')).toBeNull()

  // Meta grid + note, from real campaign fields.
  expect(getByText('/checkout')).toBeTruthy()
  expect(getByText('21.4k')).toBeTruthy()
  expect(getByText('Jul 8')).toBeTruthy()
  expect(getByText('Every field removed from the payment step paid for itself.')).toBeTruthy()
  expect(getByText('Tap to add what you learned…')).toBeTruthy()
})

test('filter chips narrow to won / no winner, with counts', async () => {
  const { getByText, getAllByText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('Single-column checkout form')).toBeTruthy())

  fireEvent.press(getByText('Won'))
  await waitFor(() => expect(queryByText('Hero image: lifestyle vs product-only')).toBeNull())

  // Two 'No winner' labels exist once the archive holds a no-winner test — the
  // filter chip and that test's outcome pill. The chip is rendered first.
  fireEvent.press(getAllByText('No winner')[0])
  await waitFor(() => expect(queryByText('Single-column checkout form')).toBeNull())
  expect(getByText('Hero image: lifestyle vs product-only')).toBeTruthy()
})

test('search matches name and note, and shows the empty message when nothing matches', async () => {
  const { getByText, getByLabelText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('Single-column checkout form')).toBeTruthy())

  fireEvent.changeText(getByLabelText('Search name or note'), 'payment step')
  await waitFor(() => expect(queryByText('Hero image: lifestyle vs product-only')).toBeNull())

  fireEvent.changeText(getByLabelText('Search name or note'), 'zzz')
  await waitFor(() => expect(getByText('No learnings match.')).toBeTruthy())
})

test('tapping a note opens inline edit and saves through the API', async () => {
  const { getByText, getByLabelText } = await renderScreen()
  await waitFor(() => expect(getByText('Tap to add what you learned…')).toBeTruthy())

  fireEvent.press(getByLabelText('Edit learning note for Hero image: lifestyle vs product-only'))
  await waitFor(() => expect(getByText('Save')).toBeTruthy())
  const input = getByLabelText('Learning note for Hero image: lifestyle vs product-only')
  fireEvent.changeText(input, '  Lifestyle imagery changed nothing on the home hero.  ')
  // Wait for the typed value to commit before pressing Save — under RNTL the
  // press would otherwise run against the pre-edit render.
  await waitFor(() => expect(input.props.value).toBe('  Lifestyle imagery changed nothing on the home hero.  '))
  fireEvent.press(getByText('Save'))

  await waitFor(() => expect(campaignsApi.updateLearningNote).toHaveBeenCalledWith(
    'c2', 'Lifestyle imagery changed nothing on the home hero.',
  ))
  // A successful save closes the editor and invalidates the campaigns query —
  // wait for that refetch to land too, so no request is still in flight when
  // the test ends.
  await waitFor(() => expect(getByText('Tap to add what you learned…')).toBeTruthy())
  await waitFor(() => expect((campaignsApi.fetchCampaigns as jest.Mock).mock.calls.length).toBeGreaterThan(1))
})

test('shows the archive-empty message when nothing has concluded', async () => {
  ;(campaignsApi.fetchCampaigns as jest.Mock).mockResolvedValue([running])
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('No concluded tests yet.')).toBeTruthy())
})

test('back returns to Home and errors render a retry card', async () => {
  ;(campaignsApi.fetchCampaigns as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('Single-column checkout form')).toBeTruthy())

  fireEvent.press(getByText('Home'))
  expect(router.back).toHaveBeenCalled()
})

// Kept last on purpose: a rejected mutation leaves React's act queue in a state
// where later renders in the same file never commit (the same reason
// ship.test.tsx's failed-ship case sits at the bottom of its file). Anything
// added below this test will not mount.
test('a failed note save toasts and keeps the editor open', async () => {
  ;(campaignsApi.updateLearningNote as jest.Mock).mockRejectedValueOnce(new Error('Network request failed'))
  const show = jest.fn()
  useToast.setState({ show })
  const { getByText, getByLabelText } = await renderScreen()
  await waitFor(() => expect(getByText('Tap to add what you learned…')).toBeTruthy())

  fireEvent.press(getByLabelText('Edit learning note for Hero image: lifestyle vs product-only'))
  await waitFor(() => expect(getByText('Save')).toBeTruthy())
  fireEvent.changeText(getByLabelText('Learning note for Hero image: lifestyle vs product-only'), 'nope')
  fireEvent.press(getByText('Save'))

  await waitFor(() => expect(show).toHaveBeenCalledWith('Network request failed'))
  // The editor stays open with the retry affordance, and the button settles
  // back out of its pending state — awaiting that keeps every state update
  // this test triggers inside the test.
  await waitFor(() => expect(getByText('Save')).toBeTruthy())
  expect(getByText('Cancel')).toBeTruthy()
})
