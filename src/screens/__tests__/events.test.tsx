import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { EventsScreen } from '../Events'
import * as stats from '../../api/stats'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }))
jest.mock('../../api/stats')

const NOW = '2026-07-25T12:00:00Z'

const EVENTS: stats.CustomEventsResponse = {
  totalVisitors: 1600,
  events: [
    {
      name: 'size_guide_open', total: 480, visitors: 320,
      lastFired: NOW, firstFired: '2026-07-01T10:00:00Z', campaignCount: 1,
      campaigns: [{
        campaignId: 'c1', name: 'PDP: sticky add-to-cart', count: 300, visitors: 210, lastFired: NOW,
        variants: [{ variantId: 'v1', name: 'A', isControl: true, count: 140, visitors: 100 }],
      }],
      siteWide: { count: 180, visitors: 110, lastFired: NOW },
      devices: [{ device: 'mobile', count: 300 }],
      countries: [{ country: 'US', count: 400 }],
      samples: [{ metadata: { size: 'M' }, createdAt: NOW, campaignId: 'c1', device: 'mobile', country: 'US' }],
    },
    {
      name: 'newsletter_signup', total: 90, visitors: 88,
      lastFired: NOW, firstFired: null, campaignCount: 0,
      campaigns: [], siteWide: null, devices: [], countries: [], samples: [],
    },
  ],
}

let currentQueryClient: QueryClient | undefined

beforeEach(() => {
  ;(stats.fetchCustomEvents as jest.Mock).mockResolvedValue(EVENTS)
})

afterEach(async () => {
  // See learnings.test.tsx — drain react-query's notification batch in act().
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  cleanup()
  currentQueryClient?.clear()
  currentQueryClient = undefined
})

const renderScreen = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  currentQueryClient = qc
  return render(<QueryClientProvider client={qc}><EventsScreen /></QueryClientProvider>)
}

test('lists events with totals, reach and the site-wide chip', async () => {
  const { getByText, getAllByText } = await renderScreen()
  await waitFor(() => expect(getByText('size_guide_open')).toBeTruthy())

  expect(getByText('480')).toBeTruthy()
  expect(getByText(/320 visitors · 20% of visitors/)).toBeTruthy()
  expect(getByText('newsletter_signup')).toBeTruthy()
  // Only the first event has a site-wide bucket.
  expect(getAllByText('site-wide').length).toBe(1)
})

test('rows stay collapsed until tapped, then show the breakdown', async () => {
  const { getByText, getAllByText, getByLabelText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('size_guide_open')).toBeTruthy())
  expect(queryByText('Where it fired')).toBeNull()

  fireEvent.press(getByLabelText('size_guide_open details'))
  await waitFor(() => expect(getByText('Where it fired')).toBeTruthy())

  expect(getByText('Total fires')).toBeTruthy()
  // Once as the bucket label, once as the sample's campaign chip.
  expect(getAllByText('PDP: sticky add-to-cart').length).toBe(2)
  expect(getByText('Site-wide (outside tests)')).toBeTruthy()
  expect(getByText('300 · 210 visitors')).toBeTruthy()

  fireEvent.press(getByLabelText('size_guide_open details'))
  await waitFor(() => expect(queryByText('Where it fired')).toBeNull())
})

test('recent samples carry their chips and payload', async () => {
  const { getByText, getByLabelText } = await renderScreen()
  await waitFor(() => expect(getByText('size_guide_open')).toBeTruthy())

  fireEvent.press(getByLabelText('size_guide_open details'))
  await waitFor(() => expect(getByText('size=M')).toBeTruthy())
  expect(getByText('mobile')).toBeTruthy()
  expect(getByText('US')).toBeTruthy()
})

test('an event with no breakdown says so instead of rendering empty bars', async () => {
  const { getByText, getByLabelText } = await renderScreen()
  await waitFor(() => expect(getByText('newsletter_signup')).toBeTruthy())

  fireEvent.press(getByLabelText('newsletter_signup details'))
  await waitFor(() => expect(getByText('No breakdown reported.')).toBeTruthy())
  expect(getByText('No recent samples.')).toBeTruthy()
})

test('search narrows the list and reports no match', async () => {
  const { getByText, getByLabelText, queryByText } = await renderScreen()
  await waitFor(() => expect(getByText('size_guide_open')).toBeTruthy())

  fireEvent.changeText(getByLabelText('Search events'), 'newsletter')
  await waitFor(() => expect(queryByText('size_guide_open')).toBeNull())

  fireEvent.changeText(getByLabelText('Search events'), 'zzz')
  await waitFor(() => expect(getByText('No events match.')).toBeTruthy())
})

test('shows an empty state when the store has sent no custom events', async () => {
  ;(stats.fetchCustomEvents as jest.Mock).mockResolvedValue({ events: [], totalVisitors: 0 })
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText('No custom events received yet.')).toBeTruthy())
})

test('back returns to Home and errors render a retry card', async () => {
  ;(stats.fetchCustomEvents as jest.Mock).mockRejectedValueOnce(new Error('network down'))
  const { getByText } = await renderScreen()
  await waitFor(() => expect(getByText("Couldn't load. Check your connection.")).toBeTruthy())

  fireEvent.press(getByText('Retry'))
  await waitFor(() => expect(getByText('size_guide_open')).toBeTruthy())

  fireEvent.press(getByText('Home'))
  expect(router.back).toHaveBeenCalled()
})
