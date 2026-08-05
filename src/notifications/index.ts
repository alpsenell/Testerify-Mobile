// Push registration (Expo push → POST /api/devices).
//
// Deliberately dormant-by-default. Everything here is wrapped so that a
// failure is a silent `false`, never a thrown error or a visible warning:
//
//   • iOS on a free Apple account has no push entitlement, so
//     getExpoPushTokenAsync() throws. That is the EXPECTED path today (see the
//     project's iOS free-signing note) — the app must behave exactly as it did
//     before push existed.
//   • Without an EAS project id (extra.eas.projectId in app.json) Expo cannot
//     mint a token at all. Not registered yet → no-op with one console.warn.
//   • Simulators/emulators have no push token (Device.isDevice guard).
//
// Android remote push additionally needs a dev build (`npx expo run:android`)
// plus FCM credentials on the Expo project — it does NOT work in Expo Go.
//
// API names verified against https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
// (SDK 57: the handler returns shouldShowBanner/shouldShowList — shouldShowAlert
// is the deprecated pre-SDK-53 name).
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { apiFetch } from '../api/client'

// The Expo push token this install last registered, so sign-out can DELETE the
// exact row it created. Module-level (not persisted): after a cold start the
// app re-registers on the first Alerts visit, which refills it. Worst case a
// sign-out can't unregister — the server-side upsert rebinds the token to the
// next tenant that signs in, and Expo's DeviceNotRegistered pruning removes it
// once the app is uninstalled, so a stale row never leaks alerts.
let registeredToken: string | null = null

// Single-flight: the Alerts screen fires registration on every visit.
let inFlight: Promise<boolean> | null = null

export function registeredPushToken(): string | null {
  return registeredToken
}

// Foreground presentation. Without this a notification that arrives while the
// app is open is delivered silently to the listener and never shown.
export function configureNotificationHandler(): void {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    })
  } catch {
    // No native module (Expo Go web / jest) — nothing to configure.
  }
}

// extra.eas.projectId is what getExpoPushTokenAsync needs to address this app
// on Expo's push service. It lands in app.json when the project is registered
// with EAS (`eas init`); until then there is nothing to register.
function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  const fromExtra = extra?.eas?.projectId
  const fromEas = (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
  return fromExtra || fromEas || null
}

/**
 * Ask for notification permission (if we may), mint an Expo push token, and
 * register it with the backend against the signed-in user + company.
 *
 * Returns true only when the token actually reached /api/devices. Never
 * throws — call it fire-and-forget.
 */
export function registerForPush(): Promise<boolean> {
  if (!inFlight) {
    inFlight = doRegister().finally(() => { inFlight = null })
  }
  return inFlight
}

async function doRegister(): Promise<boolean> {
  try {
    // Simulators and emulators can't hold a push token.
    if (!Device.isDevice) return false

    const id = projectId()
    if (!id) {
      console.warn('[push] no EAS projectId in app.json (extra.eas.projectId) — skipping registration')
      return false
    }

    const existing = await Notifications.getPermissionsAsync()
    let status = existing.status
    // Only prompt when the OS will actually show a prompt: re-asking after a
    // hard denial is a silent no-op on iOS and pure noise on Android.
    if (status !== 'granted' && existing.canAskAgain !== false) {
      status = (await Notifications.requestPermissionsAsync()).status
    }
    if (status !== 'granted') return false

    // Android needs a channel before anything can be shown heads-up.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Test alerts',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }

    // THE iOS free-signing throw happens here. Caught below → false.
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id })
    if (!token) return false

    // Upsert: the server rebinds this token to whoever is signed in now, so a
    // re-login or store switch moves the device to the active tenant.
    await apiFetch('/api/devices', {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS }),
    })
    registeredToken = token
    return true
  } catch {
    // Expected on iOS without a paid Apple account, in Expo Go on Android, and
    // whenever /api/devices isn't deployed yet. Push stays dormant; nothing
    // else in the app is affected.
    return false
  }
}

/**
 * Forget this device server-side (sign-out). Must run BEFORE the auth store
 * clears its tokens — apiFetch needs the Bearer token to authenticate the
 * DELETE. Never throws; returns whether the server acknowledged.
 */
export async function unregisterPush(): Promise<boolean> {
  const token = registeredToken
  registeredToken = null
  if (!token) return false
  try {
    await apiFetch('/api/devices', { method: 'DELETE', body: JSON.stringify({ token }) })
    return true
  } catch {
    // A dead row is harmless: the next sign-in rebinds the token, and Expo's
    // DeviceNotRegistered pruning cleans up uninstalled apps.
    return false
  }
}
