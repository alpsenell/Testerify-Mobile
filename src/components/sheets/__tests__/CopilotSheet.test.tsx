import { render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CopilotSheet } from '../CopilotSheet'
import { useSheets } from '../../../stores/sheets'
import { useToast } from '../../../stores/toast'
import * as ai from '../../../api/ai'
import type { AiIdea, SavedSuggestions } from '../../../api/ai'
import { draftRequestFor } from '../../../utils/copilot'

jest.mock('../../../api/ai')

const IDEA: AiIdea = {
  title: 'Sticky add-to-cart bar',
  hypothesis: 'A sticky bar keeps the CTA visible on long PDPs.',
  element: null, change: null, evidence: null,
  page: 'product', path: '/products/[handle]', metric: 'add_to_cart',
  impact: 'high', difficulty: 'easy',
}

const SAVED: SavedSuggestions = { ideas: [IDEA], source: 'company', goal: null, generatedAt: '2026-07-20T00:00:00Z' }

// Each test's QueryClient is tracked here so it can be torn down afterward —
// see the afterEach below.
let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  // Clear call history between tests — the mocks below are re-armed every
  // time, but jest.mock()'s auto-mocks don't reset .mock.calls on their own,
  // and the double-submit regression test asserts an exact call count.
  jest.clearAllMocks()
  useSheets.setState({ sheet: { kind: 'copilot' } })
  useToast.setState({ message: null })
  ;(ai.fetchSuggestions as jest.Mock).mockResolvedValue(SAVED)
  ;(ai.generateSuggestions as jest.Mock).mockResolvedValue({ ideas: [IDEA] })
  ;(ai.generateTestDraft as jest.Mock).mockResolvedValue({ campaign: { id: 'c1' }, hypothesis: null })
})

// react-query schedules a 5-minute gcTime setTimeout (never .unref()'d) the
// moment a query's last observer unmounts — which RNTL's own afterEach does
// for every test here. Left unhandled, each of this file's QueryClients
// leaves that real timer running, and the Jest worker never exits naturally
// (the "worker process has failed to exit gracefully" warning). clear()
// removes every query from the cache, cancelling its gcTime timer
// immediately (QueryCache.remove() calls query.destroy(), which does this).
// It does NOT touch the app's real gcTime default — only disposes of this
// test's client once the test is done with it.
//
// Mutations (the "build" mutation below) need a second, separate fix:
// MutationCache's own remove()/clear() do NOT call mutation.destroy() (an
// asymmetry with QueryCache — arguably a react-query gap), so a settled
// mutation's own gcTimeout survives qc.clear() untouched. mutations.gcTime: 0
// in defaultOptions sidesteps that entirely by not scheduling one in the
// first place. See ship.test.tsx for the same pattern.
afterEach(() => {
  currentQueryClient?.clear()
  currentQueryClient = undefined
})

const renderSheet = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { gcTime: 0 } } })
  currentQueryClient = qc
  return await render(<QueryClientProvider client={qc}><CopilotSheet /></QueryClientProvider>)
}

test('renders saved ideas from mocked fetchSuggestions', async () => {
  const { getByText } = await renderSheet()

  await waitFor(() => expect(getByText('Sticky add-to-cart bar')).toBeTruthy())
  expect(getByText('Suggested for your store')).toBeTruthy()
  expect(getByText('A sticky bar keeps the CTA visible on long PDPs.')).toBeTruthy()
  expect(getByText('Product · Add to cart')).toBeTruthy()
})

test('pressing a goal chip calls generateSuggestions with the chip text', async () => {
  const { getByText } = await renderSheet()

  await waitFor(() => expect(getByText('Sticky add-to-cart bar')).toBeTruthy())
  fireEvent.press(getByText('Reduce mobile checkout drop-off'))

  await waitFor(() => expect(ai.generateSuggestions).toHaveBeenCalledWith('Reduce mobile checkout drop-off'))
  await waitFor(() => expect(getByText('Generated ideas')).toBeTruthy())
})

test('"Build draft" calls generateTestDraft with draftRequestFor(idea) and on success closes + toasts', async () => {
  const { getByText } = await renderSheet()

  await waitFor(() => expect(getByText('Sticky add-to-cart bar')).toBeTruthy())
  fireEvent.press(getByText('Build draft'))

  await waitFor(() => expect(ai.generateTestDraft).toHaveBeenCalledWith(draftRequestFor(IDEA)))
  await waitFor(() => expect(useSheets.getState().sheet).toBeNull())
  expect(useToast.getState().message).toBe(
    'Draft created — find it under Tests. Edit variants on the desktop panel.'
  )
})

test('failed "Build draft" toasts the error and keeps the sheet open', async () => {
  ;(ai.generateTestDraft as jest.Mock).mockRejectedValue(new Error('Could not build the draft — try again.'))
  const { getByText } = await renderSheet()

  await waitFor(() => expect(getByText('Sticky add-to-cart bar')).toBeTruthy())
  fireEvent.press(getByText('Build draft'))

  await waitFor(() => expect(useToast.getState().message).toBe('Could not build the draft — try again.'))
  expect(useSheets.getState().sheet).toEqual({ kind: 'copilot' })
})

test('a failed generate shows the server message inline and keeps the previous ideas visible', async () => {
  ;(ai.generateSuggestions as jest.Mock).mockRejectedValue(new Error('AI suggestions are not configured for this store yet.'))
  const { getByText } = await renderSheet()

  await waitFor(() => expect(getByText('Sticky add-to-cart bar')).toBeTruthy())
  fireEvent.press(getByText('Raise average order value'))

  await waitFor(() => expect(getByText('AI suggestions are not configured for this store yet.')).toBeTruthy())
  // Error is shown inline in the sheet, not as a toast, and the sheet stays open.
  expect(useToast.getState().message).toBeNull()
  expect(useSheets.getState().sheet).toEqual({ kind: 'copilot' })
  // Previously-fetched saved ideas remain visible underneath the inline error.
  expect(getByText('Sticky add-to-cart bar')).toBeTruthy()
})

test('pressing Build on a second idea while the first build is pending does not fire a second request', async () => {
  const IDEA_B: AiIdea = {
    ...IDEA,
    title: 'Exit-intent discount modal',
    hypothesis: 'A modal recovers visitors who are about to abandon checkout.',
    page: 'checkout', metric: null,
  }
  ;(ai.fetchSuggestions as jest.Mock).mockResolvedValue({ ...SAVED, ideas: [IDEA, IDEA_B] })

  let resolveBuild!: (value: { campaign: { id: string }; hypothesis: string | null }) => void
  ;(ai.generateTestDraft as jest.Mock).mockImplementation(
    () => new Promise((resolve) => { resolveBuild = resolve })
  )

  const { getByText, getAllByText } = await renderSheet()

  await waitFor(() => expect(getByText(IDEA.title)).toBeTruthy())
  await waitFor(() => expect(getByText(IDEA_B.title)).toBeTruthy())

  // Build on idea A (first card).
  await fireEvent.press(getAllByText('Build draft')[0])
  await waitFor(() => expect(getByText('Building…')).toBeTruthy())

  // Idea B's button still reads "Build draft" but must now be disabled —
  // pressing it must not fire a second, concurrent generateTestDraft call.
  await fireEvent.press(getAllByText('Build draft')[0])

  expect(ai.generateTestDraft).toHaveBeenCalledTimes(1)
  expect(ai.generateTestDraft).toHaveBeenCalledWith(draftRequestFor(IDEA))

  resolveBuild({ campaign: { id: 'c1' }, hypothesis: null })
})
