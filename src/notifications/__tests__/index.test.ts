import { Platform } from 'react-native'

// jest hoists jest.mock() above these consts, but the factories only RUN when
// the module under test is required (inside each test, after resetModules), by
// which time they're initialised. Names must start with "mock" — that's the
// babel-plugin-jest-hoist escape hatch for out-of-scope references.
const mockApiFetch = jest.fn()
jest.mock('../../api/client', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))

const mockDevice = { isDevice: true }
jest.mock('expo-device', () => mockDevice)

const mockConstants: { expoConfig: { extra?: Record<string, unknown> } | null } = {
  expoConfig: { extra: { eas: { projectId: 'proj-1' } } },
}
jest.mock('expo-constants', () => ({ __esModule: true, default: mockConstants }))

const mockNotifications = {
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
}
jest.mock('expo-notifications', () => mockNotifications)

// Module-level state (the cached token, the single-flight promise) has to be
// fresh per test, so the module is re-required rather than imported at the top.
const load = () => {
  jest.resetModules()
  return require('../index') as typeof import('../index')
}

const GRANTED = { status: 'granted', canAskAgain: true }
const UNDETERMINED = { status: 'undetermined', canAskAgain: true }
const DENIED = { status: 'denied', canAskAgain: false }

let warnSpy: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  mockDevice.isDevice = true
  mockConstants.expoConfig = { extra: { eas: { projectId: 'proj-1' } } }
  mockNotifications.getPermissionsAsync.mockResolvedValue(GRANTED)
  mockNotifications.requestPermissionsAsync.mockResolvedValue(GRANTED)
  mockNotifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' })
  mockNotifications.setNotificationChannelAsync.mockResolvedValue(undefined)
  mockApiFetch.mockResolvedValue({ ok: true })
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => { warnSpy.mockRestore() })

// ── registerForPush guards ──────────────────────────────────────────

test('a simulator/emulator never asks for a token', async () => {
  mockDevice.isDevice = false
  const { registerForPush } = load()

  await expect(registerForPush()).resolves.toBe(false)
  expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled()
  expect(mockApiFetch).not.toHaveBeenCalled()
})

test('without an EAS projectId it warns once and no-ops', async () => {
  mockConstants.expoConfig = { extra: {} }
  const { registerForPush } = load()

  await expect(registerForPush()).resolves.toBe(false)
  expect(warnSpy).toHaveBeenCalled()
  expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled()
})

test('a hard denial is not re-prompted and registers nothing', async () => {
  mockNotifications.getPermissionsAsync.mockResolvedValue(DENIED)
  const { registerForPush } = load()

  await expect(registerForPush()).resolves.toBe(false)
  expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled()
  expect(mockApiFetch).not.toHaveBeenCalled()
})

test('an undetermined permission is requested, and a denial stops there', async () => {
  mockNotifications.getPermissionsAsync.mockResolvedValue(UNDETERMINED)
  mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false })
  const { registerForPush } = load()

  await expect(registerForPush()).resolves.toBe(false)
  expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled()
  expect(mockApiFetch).not.toHaveBeenCalled()
})

// ── registerForPush happy path ──────────────────────────────────────

test('posts the minted token to /api/devices', async () => {
  const { registerForPush, registeredPushToken } = load()

  await expect(registerForPush()).resolves.toBe(true)
  expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-1' })
  expect(mockApiFetch).toHaveBeenCalledWith('/api/devices', {
    method: 'POST',
    body: JSON.stringify({ token: 'ExponentPushToken[abc]', platform: Platform.OS }),
  })
  expect(registeredPushToken()).toBe('ExponentPushToken[abc]')
})

test('concurrent calls share one registration', async () => {
  const { registerForPush } = load()

  const [a, b] = await Promise.all([registerForPush(), registerForPush()])
  expect(a).toBe(true)
  expect(b).toBe(true)
  expect(mockApiFetch).toHaveBeenCalledTimes(1)
})

// ── The dormant paths (must never throw) ────────────────────────────

test('a token-mint failure (iOS free signing) is a silent false', async () => {
  mockNotifications.getExpoPushTokenAsync.mockRejectedValue(new Error('no valid aps-environment entitlement'))
  const { registerForPush, registeredPushToken } = load()

  await expect(registerForPush()).resolves.toBe(false)
  expect(mockApiFetch).not.toHaveBeenCalled()
  expect(registeredPushToken()).toBeNull()
})

test('a failing /api/devices (404 before deploy) is a silent false', async () => {
  mockApiFetch.mockRejectedValue(new Error('Request failed (404)'))
  const { registerForPush } = load()

  await expect(registerForPush()).resolves.toBe(false)
})

// ── unregisterPush ──────────────────────────────────────────────────

test('unregister deletes the token this install registered', async () => {
  const mod = load()
  await mod.registerForPush()
  mockApiFetch.mockClear()

  await expect(mod.unregisterPush()).resolves.toBe(true)
  expect(mockApiFetch).toHaveBeenCalledWith('/api/devices', {
    method: 'DELETE',
    body: JSON.stringify({ token: 'ExponentPushToken[abc]' }),
  })
  // The cached token is dropped, so a second sign-out is a no-op.
  expect(mod.registeredPushToken()).toBeNull()
})

test('unregister without a registered token makes no request', async () => {
  const { unregisterPush } = load()

  await expect(unregisterPush()).resolves.toBe(false)
  expect(mockApiFetch).not.toHaveBeenCalled()
})

test('a failing unregister still clears local state and never throws', async () => {
  const mod = load()
  await mod.registerForPush()
  mockApiFetch.mockRejectedValue(new Error('offline'))

  await expect(mod.unregisterPush()).resolves.toBe(false)
  expect(mod.registeredPushToken()).toBeNull()
})

// ── Foreground handler ──────────────────────────────────────────────

test('the foreground handler uses the SDK 57 banner/list shape', async () => {
  const { configureNotificationHandler } = load()
  configureNotificationHandler()

  expect(mockNotifications.setNotificationHandler).toHaveBeenCalled()
  const arg = mockNotifications.setNotificationHandler.mock.calls.at(-1)![0]
  await expect(arg.handleNotification()).resolves.toEqual({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  })
})
