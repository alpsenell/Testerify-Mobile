import { act, cleanup, render, waitFor, userEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { CreateTestScreen } from '../CreateTest'
import * as createApi from '../../api/createCampaign'
import * as audiencesApi from '../../api/audiences'
import * as queueApi from '../../api/queue'
import { ApiError } from '../../api/client'

let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}))
jest.mock('../../api/createCampaign')
jest.mock('../../api/audiences')
jest.mock('../../api/queue')

const CREATED = { id: 'c1', name: 'Sticky CTA', status: 'draft', kind: 'ab' }

let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
  ;(createApi.createCampaign as jest.Mock).mockResolvedValue(CREATED)
  ;(createApi.patchCampaign as jest.Mock).mockResolvedValue({ campaign: {} })
  ;(audiencesApi.fetchAudiences as jest.Mock).mockResolvedValue([])
  ;(queueApi.updateQueueItem as jest.Mock).mockResolvedValue({})
})

afterEach(async () => {
  // See learnings.test.tsx — drain react-query's notification batch in act().
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
})

const renderScreen = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><CreateTestScreen /></QueryClientProvider>)
}

test('a full walk builds the POST body from every step and lands on the new draft', async () => {
  const s = await renderScreen()
  const user = userEvent.setup()

  // Basics
  await user.paste(s.getByLabelText('Test name'), 'Sticky CTA')
  await user.press(s.getByText('Next'))

  // Targeting: one URL
  await user.press(s.getByText('One URL'))
  await user.paste(s.getByLabelText('Target path'), '/sale')
  await user.press(s.getByText('Next'))

  // Goals: keep the preselected order goal, add a click goal but leave the
  // selector empty — it must be skipped, like the server does.
  await user.press(s.getByText('Add goal'))
  await user.press(s.getAllByText('Click')[1])
  await user.press(s.getByText('Next'))

  // Review: plain ab with no redirect — the wizard must warn about identical
  // pages and lead with Save draft.
  expect(s.getByText(/both sides serve identical pages/)).toBeTruthy()
  await user.press(s.getByText('Save draft'))

  await waitFor(() => expect(createApi.createCampaign).toHaveBeenCalledWith({
    name: 'Sticky CTA',
    kind: 'ab',
    targeting: { mode: 'url', path: '/sale' },
    goals: [{ type: 'order' }],
    trafficSplit: 50,
  }))
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/test/c1'))
  expect(createApi.patchCampaign).not.toHaveBeenCalled()
  expect(queueApi.updateQueueItem).not.toHaveBeenCalled()
})

test('a 402 on launch shows the plan-gate note, keeps the draft, and never creates a twin', async () => {
  ;(createApi.patchCampaign as jest.Mock).mockRejectedValue(
    new ApiError(402, { error: 'The Free plan runs 1 test at a time. Upgrade to run more tests in parallel.', code: 'PLAN_LIMIT_REACHED' }))

  const s = await renderScreen()
  const user = userEvent.setup()

  await user.paste(s.getByLabelText('Test name'), 'Sticky CTA')
  await user.press(s.getByText('Next'))
  await user.press(s.getByText('Next'))
  await user.press(s.getByText('Next'))
  await user.press(s.getByText('Launch now'))

  await waitFor(() => expect(s.getByText(/Free plan runs 1 test at a time/)).toBeTruthy())
  expect(s.getByText(/Your draft is saved — launch it after upgrading/)).toBeTruthy()
  expect(router.push).not.toHaveBeenCalled()
  expect(createApi.createCampaign).toHaveBeenCalledTimes(1)

  // Leaving via Save draft reuses the campaign the POST already made.
  await user.press(s.getByText('Save draft'))
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/test/c1'))
  expect(createApi.createCampaign).toHaveBeenCalledTimes(1)
})

test('a queue idea prefills the wizard and is marked drafted after the POST', async () => {
  mockParams = { queueId: 'q1', title: 'Bigger add-to-cart button', page: 'product' }
  const s = await renderScreen()
  const user = userEvent.setup()

  // Name and targeting arrive prefilled from the idea.
  await user.press(s.getByText('Next'))
  expect(s.getByText('Product')).toBeTruthy()
  await user.press(s.getByText('Next'))
  await user.press(s.getByText('Next'))
  await user.press(s.getByText('Save draft'))

  await waitFor(() => expect(createApi.createCampaign).toHaveBeenCalled())
  const body = (createApi.createCampaign as jest.Mock).mock.calls[0][0]
  expect(body.name).toBe('Bigger add-to-cart button')
  expect(body.targeting).toEqual({ mode: 'pages', pages: ['product'] })
  await waitFor(() => expect(queueApi.updateQueueItem).toHaveBeenCalledWith('q1', {
    status: 'drafted', draftedCampaignId: 'c1',
  }))
})

test('personalization hides the split, skips the identical-pages warning, and surfaces the create gate', async () => {
  ;(createApi.createCampaign as jest.Mock).mockRejectedValue(
    new ApiError(402, { error: 'Personalization is part of the Scale plan.', code: 'PLAN_LIMIT_REACHED' }))

  const s = await renderScreen()
  const user = userEvent.setup()

  await user.paste(s.getByLabelText('Test name'), 'VIP experience')
  await user.press(s.getByText('Personalization'))
  await user.press(s.getByText('Next'))
  await user.press(s.getByText('Next'))
  await user.press(s.getByText('Next'))

  expect(s.getByText(/permanent 10% holdout/)).toBeTruthy()
  expect(s.queryByText(/Control 50%/)).toBeNull()
  expect(s.queryByText(/both sides serve identical pages/)).toBeNull()

  await user.press(s.getByText('Launch now'))
  await waitFor(() => expect(s.getByText(/Personalization is part of the Scale plan/)).toBeTruthy())
  expect(router.push).not.toHaveBeenCalled()
})

test('picking a saved audience sends its reference in targeting', async () => {
  ;(audiencesApi.fetchAudiences as jest.Mock).mockResolvedValue([
    { id: 'a1', name: 'Mobile newcomers', conditions: { devices: ['mobile'] }, createdAt: '', updatedAt: '' },
  ])
  const s = await renderScreen()
  const user = userEvent.setup()

  await user.paste(s.getByLabelText('Test name'), 'Sticky CTA')
  await user.press(s.getByText('Next'))
  await waitFor(() => expect(s.getByText('Mobile newcomers')).toBeTruthy())
  await user.press(s.getByText('Mobile newcomers'))
  await user.press(s.getByText('Next'))
  await user.press(s.getByText('Next'))
  await user.press(s.getByText('Save draft'))

  await waitFor(() => expect(createApi.createCampaign).toHaveBeenCalled())
  expect((createApi.createCampaign as jest.Mock).mock.calls[0][0].targeting)
    .toEqual({ mode: 'all', audienceId: 'a1' })
})
