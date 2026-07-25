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
