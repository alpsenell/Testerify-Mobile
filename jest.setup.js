// react-native-reanimated 4's native worklets runtime (react-native-worklets)
// isn't available under Jest and throws on import. Modules that pull reanimated
// in transitively (e.g. @gorhom/bottom-sheet, used by Task 9's SheetHost) crash
// as a result. Both packages ship an official JS-only mock for exactly this
// situation. Worklets must be mocked first: reanimated's own official mock
// (react-native-reanimated/mock) still imports its real ./index chain, which
// in turn imports react-native-worklets, so worklets needs to already resolve
// to its mock by the time that happens.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'))
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))

// @react-native-community/netinfo's real addEventListener touches native
// connectivity APIs that don't exist under Jest (used by Task 16's
// OfflineBanner, mounted in the root layout). The package ships an official
// JS-only jest mock for exactly this — a jest.fn() addEventListener that
// returns an unsubscribe jest.fn() without firing, so components that don't
// care about connectivity (e.g. the root layout test) render unaffected,
// while OfflineBanner's own test drives it via NetInfo.addEventListener.mock.calls.
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock'))

// react-native-safe-area-context's real native module isn't available under
// Jest. OfflineBanner (mounted in the root layout) reads useSafeAreaInsets()
// for its top padding, so it needs insets even outside of a SafeAreaProvider
// (expo-router supplies the real provider only at runtime). The package
// ships an official jest mock for exactly this — it falls back to a
// zeroed-out Metrics object when no provider is present. The mock file only
// has a default export (no named exports), so it must be unwrapped with
// `.default` — the repo's transformIgnorePatterns allowlist inadvertently
// transforms this file too (its "react-native" alternative matches as a
// substring prefix of "react-native-safe-area-context"), which is what
// surfaces the plain CJS `{ default: {...} }` shape here instead of the
// production build's proper named exports.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default)

// @react-native-async-storage/async-storage's real native module isn't
// available under Jest (used by Task 3's persisted zustand stores —
// src/stores/favorites.ts and src/stores/alertsRead.ts, via
// zustand/middleware's persist + createJSONStorage). The package ships an
// official jest mock for exactly this — an in-memory key/value store backed
// by jest.fn()s, so persistence round-trips (setItem/getItem) work the same
// way under Jest as they do on-device, without touching real native storage.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'))
