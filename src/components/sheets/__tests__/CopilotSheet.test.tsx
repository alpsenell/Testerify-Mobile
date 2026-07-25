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

beforeEach(() => {
  useSheets.setState({ sheet: { kind: 'copilot' } })
  useToast.setState({ message: null })
  ;(ai.fetchSuggestions as jest.Mock).mockResolvedValue(SAVED)
  ;(ai.generateSuggestions as jest.Mock).mockResolvedValue({ ideas: [IDEA] })
  ;(ai.generateTestDraft as jest.Mock).mockResolvedValue({ campaign: { id: 'c1' }, hypothesis: null })
})

const renderSheet = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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
