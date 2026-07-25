import { act, render, screen } from '@testing-library/react-native'
import NetInfo from '@react-native-community/netinfo'
import { OfflineBanner } from '../OfflineBanner'

// @react-native-community/netinfo is globally replaced by its official jest
// mock (see jest.setup.js) — addEventListener is a jest.fn() that never fires
// on its own, so we grab the registered listener off `.mock.calls` and drive
// it by hand to simulate connectivity changes.
const mockAddEventListener = NetInfo.addEventListener as jest.Mock

type NetState = { isConnected: boolean | null; isInternetReachable: boolean | null }

const emit = async (state: NetState) => {
  const listener = mockAddEventListener.mock.calls.at(-1)?.[0] as (s: NetState) => void
  await act(async () => { listener(state) })
}

beforeEach(() => {
  mockAddEventListener.mockClear()
})

test('renders nothing before any NetInfo event fires', async () => {
  const r = await render(<OfflineBanner />)
  expect(mockAddEventListener).toHaveBeenCalledTimes(1)
  expect(r.toJSON()).toBeNull()
})

test('renders nothing while connected', async () => {
  const r = await render(<OfflineBanner />)
  await emit({ isConnected: true, isInternetReachable: true })
  expect(r.toJSON()).toBeNull()
})

test('shows the offline message once NetInfo reports disconnected', async () => {
  await render(<OfflineBanner />)
  await emit({ isConnected: false, isInternetReachable: false })
  expect(screen.getByText('Offline — showing cached data')).toBeTruthy()
})

test('treats connected-but-unreachable internet as offline', async () => {
  await render(<OfflineBanner />)
  await emit({ isConnected: true, isInternetReachable: false })
  expect(screen.getByText('Offline — showing cached data')).toBeTruthy()
})

test('clears the banner once connectivity is restored', async () => {
  await render(<OfflineBanner />)
  await emit({ isConnected: false, isInternetReachable: false })
  expect(screen.getByText('Offline — showing cached data')).toBeTruthy()
  await emit({ isConnected: true, isInternetReachable: true })
  expect(screen.queryByText('Offline — showing cached data')).toBeNull()
})
