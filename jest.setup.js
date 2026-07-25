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
