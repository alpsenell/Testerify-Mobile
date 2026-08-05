import { act, cleanup, render, waitFor, userEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { NudgeCreateScreen } from '../NudgeCreate'
import * as nudgesApi from '../../api/nudges'
import * as campaignsApi from '../../api/campaigns'
import { ApiError } from '../../api/client'
import { useToast } from '../../stores/toast'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/nudges')
jest.mock('../../api/campaigns')

const CATALOG: nudgesApi.NudgeCatalog = {
  defaultHoldout: 20,
  nudges: [
    {
      id: 'nudge-shipping-bar', name: 'Free-shipping bar', impact: 'high', targeting: { mode: 'all' },
      description: 'A progress bar that nudges carts over the free-shipping threshold.',
      params: [
        { key: 'threshold', label: 'Threshold', default: 50, type: 'number', min: 1, max: 10000 },
        { key: 'barColor', label: 'Bar color', default: '#111827', type: 'color' },
        { key: 'belowText', label: 'Message', default: 'Spend {remaining} more' },
      ],
    },
    {
      id: 'nudge-countdown', name: 'Countdown timer', impact: 'medium', targeting: { mode: 'pages', pages: ['cart'] },
      description: 'A gentle deadline on the cart page.',
      params: [{ key: 'minutes', label: 'Minutes', default: 15, type: 'number', min: 5, max: 120 }],
    },
  ],
}

const CREATED = {
  campaign: { id: 'c9', name: 'Free-shipping bar', status: 'draft', kind: 'nudge' },
  variation: {}, holdout: 20, nudge: { id: 'nudge-shipping-bar', name: 'Free-shipping bar' },
}

const realShow = useToast.getState().show
let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  jest.clearAllMocks()
  ;(nudgesApi.fetchNudgeCatalog as jest.Mock).mockResolvedValue(CATALOG)
  ;(nudgesApi.createNudge as jest.Mock).mockResolvedValue(CREATED)
  ;(campaignsApi.setCampaignStatus as jest.Mock).mockResolvedValue({ campaign: {} })
})

afterEach(async () => {
  // See learnings.test.tsx — drain react-query's notification batch in act().
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  useToast.setState({ message: null, show: realShow })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
})

const renderScreen = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><NudgeCreateScreen /></QueryClientProvider>)
}

test('the catalog lists every widget; picking one opens its config prefilled', async () => {
  const s = await renderScreen()
  const user = userEvent.setup()
  await waitFor(() => expect(s.getByText('Free-shipping bar')).toBeTruthy())

  expect(s.getByText('Countdown timer')).toBeTruthy()
  expect(s.getByText('high impact')).toBeTruthy()
  expect(s.getByText('A progress bar that nudges carts over the free-shipping threshold.')).toBeTruthy()

  await user.press(s.getByText('Free-shipping bar'))
  expect(s.getByLabelText('Nudge name').props.value).toBe('Free-shipping bar')
  expect(s.getByLabelText('Threshold').props.value).toBe('50')
  expect(s.getByLabelText('Bar color').props.value).toBe('#111827')
  expect(s.getByText('20% holdout')).toBeTruthy()
})

test('creating sends the typed params and the stepped holdout', async () => {
  const s = await renderScreen()
  const user = userEvent.setup()
  await waitFor(() => expect(s.getByText('Free-shipping bar')).toBeTruthy())

  await user.press(s.getByText('Free-shipping bar'))
  await user.paste(s.getByLabelText('Threshold'), '75')
  await user.press(s.getByLabelText('Decrease holdout'))
  await user.press(s.getByLabelText('Decrease holdout'))
  await user.press(s.getByLabelText('Decrease holdout')) // clamps at 10
  await user.press(s.getByText('Create draft'))

  await waitFor(() => expect(nudgesApi.createNudge).toHaveBeenCalledWith({
    nudgeId: 'nudge-shipping-bar',
    name: 'Free-shipping bar',
    holdout: 10,
    params: { threshold: 75, barColor: '#111827', belowText: 'Spend {remaining} more' },
  }))
  await waitFor(() => expect(s.getByText('Draft created')).toBeTruthy())
})

test('launching the fresh draft hits the status endpoint and navigates', async () => {
  const s = await renderScreen()
  const user = userEvent.setup()
  await waitFor(() => expect(s.getByText('Free-shipping bar')).toBeTruthy())

  await user.press(s.getByText('Free-shipping bar'))
  await user.press(s.getByText('Create draft'))
  await waitFor(() => expect(s.getByText('Draft created')).toBeTruthy())

  await user.press(s.getByText('Launch now'))
  await waitFor(() => expect(campaignsApi.setCampaignStatus).toHaveBeenCalledWith('c9', 'running'))
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/test/c9'))
})

test('a 402 on launch shows the plan gate and keeps the draft reachable', async () => {
  ;(campaignsApi.setCampaignStatus as jest.Mock).mockRejectedValue(
    new ApiError(402, { error: 'The Free plan runs 1 test at a time. Upgrade to run more tests in parallel.', code: 'PLAN_LIMIT_REACHED' }))

  const s = await renderScreen()
  const user = userEvent.setup()
  await waitFor(() => expect(s.getByText('Free-shipping bar')).toBeTruthy())

  await user.press(s.getByText('Free-shipping bar'))
  await user.press(s.getByText('Create draft'))
  await waitFor(() => expect(s.getByText('Draft created')).toBeTruthy())

  await user.press(s.getByText('Launch now'))
  await waitFor(() => expect(s.getByText(/Free plan runs 1 test at a time/)).toBeTruthy())
  expect(router.push).not.toHaveBeenCalled()

  await user.press(s.getByText('View draft'))
  expect(router.push).toHaveBeenCalledWith('/test/c9')
})
