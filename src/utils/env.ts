// Jest sets NODE_ENV=test automatically. Factored out (rather than inlined
// at each call site) so components that gate behavior on it — e.g.
// Skeleton/StatusPill skipping their Animated.loop start to avoid leaking a
// real timer under Jest — can be exercised in tests via jest.spyOn without
// touching the global process.env.NODE_ENV, which React Native's own
// Animated internals also read (to bypass a "no attached native view" check
// that only makes sense outside a real device/simulator).
export function isTestEnv(): boolean {
  return process.env.NODE_ENV === 'test'
}
