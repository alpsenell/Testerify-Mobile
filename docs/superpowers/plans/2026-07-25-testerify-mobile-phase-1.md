# Testerify Mobile — Phase 0 + Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working Expo (React Native + TypeScript) app implementing the Testerify Mobile design's core loop — login, Home, Tests, Test detail, Ship/Rollback, Alerts, Co-pilot — against the live backend at `https://panel.testerify.com`.

**Architecture:** Expo Router app with a custom 4-tab bar + raised center co-pilot FAB; bottom sheets (More / Co-pilot / Ship) hosted globally; TanStack Query for server state; Zustand + expo-secure-store for session; Bearer-token auth with one refresh-and-retry; `react-native-svg` ports of the design's charts.

**Tech Stack:** Expo SDK (latest stable), TypeScript (strict), Expo Router, @tanstack/react-query v5, zustand v5, @gorhom/bottom-sheet v5, react-native-svg, expo-secure-store, @expo-google-fonts/instrument-sans + ibm-plex-mono, jest-expo + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-07-25-testerify-mobile-design.md`. Phases 2–3 (16 secondary screens) get their own plans after this one ships.

## Global Constraints

- **Repo:** all work in `/Users/alpsenel/Desktop/personal-projects/Testerify-Mobile` **except Task 1**, which edits `/Users/alpsenel/Desktop/personal-projects/Testerify` (the backend).
- **API base URL:** `process.env.EXPO_PUBLIC_API_URL ?? 'https://panel.testerify.com'`. Never hardcode elsewhere.
- **Test store only:** every dev-time login uses the dedicated **test company/store account** (ask Alp for credentials at first run). Never exercise ship/rollback against a real store.
- **Design tokens verbatim** (Task 3): paper `#f4f1ea`, card `#fcfbf7`, border `#e7e0d3`, hairline `#efe9de`, ink `#211e1a`, secondary `#5d564b`, muted `#968d7e`, faint `#b3aa99`, track `#ece6da`, accent `#5b54e0`, pos `#2f8f5b`, neg `#c2553c`, warn `#b9842a`. Fonts: Instrument Sans + IBM Plex Mono.
- **Backend response contracts** (verified against source, cited per task): do not invent fields. `sigStatus`/`significance.status` values are `'winning' | 'losing' | 'inconclusive' | 'not_enough_data'`. Campaign `status` values: `'draft' | 'running' | 'paused' | 'rollout' | 'completed'`.
- **No new dependencies** beyond the ones installed in Task 2.
- **TypeScript strict**; no `any` except at the API-response boundary where a field is intentionally untyped (`unknown`).
- Commit after every task (message given per task).

---

### Task 1: Backend — token-in-body support for mobile clients

The panel uses httpOnly cookies. Mobile needs the JWTs in JSON. This change is opt-in and backward compatible: the panel's requests don't change behavior.

**Files:**
- Modify: `/Users/alpsenel/Desktop/personal-projects/Testerify/api/auth/login.js`
- Modify: `/Users/alpsenel/Desktop/personal-projects/Testerify/api/auth/refresh.js`

**Interfaces (produced, used by Task 5):**
- `POST /api/auth/login` `{ email, password, includeTokens: true }` → adds `tokens: { accessToken, refreshToken }` to the existing `{ user, company, stores }` response.
- `POST /api/auth/refresh` `{ refreshToken }` (body fallback when no cookie) → adds `tokens: { accessToken, refreshToken }` to the `{ message }` response when the token came from the body.

- [ ] **Step 1: Extend login.js**

In `api/auth/login.js`, change the body destructure (currently `const { email, password } = await parseBody(req)`):

```js
const { email, password, includeTokens } = await parseBody(req)
```

and extend the final `res.status(200).json({ ... })` (after `stores`):

```js
      stores,
      // Mobile clients can't read httpOnly cookies — they opt in to receiving
      // the same JWTs in the body and send them back as Authorization: Bearer.
      ...(includeTokens === true ? { tokens: { accessToken, refreshToken } } : {}),
```

- [ ] **Step 2: Extend refresh.js**

In `api/auth/refresh.js`, import `parseBody` (add to the existing middleware import):

```js
import { setCorsHeaders, parseBody } from '../_lib/middleware.js'
```

Replace the token read (currently `const token = cookies.testerify_refresh` + null check):

```js
    const cookies = parseCookies(req)
    let token = cookies.testerify_refresh
    // Mobile clients have no cookie jar — they send the refresh token in the
    // body and get the rotated pair back in the body.
    let tokenFromBody = false
    if (!token) {
      const body = await parseBody(req).catch(() => ({}))
      if (typeof body.refreshToken === 'string' && body.refreshToken) {
        token = body.refreshToken
        tokenFromBody = true
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'No refresh token' })
    }
```

And the final response (currently `return res.status(200).json({ message: 'Token refreshed' })`):

```js
    return res.status(200).json({
      message: 'Token refreshed',
      ...(tokenFromBody
        ? { tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken } }
        : {}),
    })
```

- [ ] **Step 3: Run the backend's test suite**

Run (in the Testerify repo): `npm test`
Expected: PASS (no existing test covers these handlers; this catches accidental syntax/import breakage — the repo's tests import broadly).

- [ ] **Step 4: Commit (Testerify repo) and deploy**

```bash
cd /Users/alpsenel/Desktop/personal-projects/Testerify
git add api/auth/login.js api/auth/refresh.js
git commit -m "feat(auth): opt-in token-in-body for mobile clients (login includeTokens, refresh body fallback)"
```

Deploy through the repo's normal flow (git push → Vercel). **Ask Alp to deploy / confirm deployment** — do not run `vercel --prod` yourself.

- [ ] **Step 5: Verify against production with the test account**

```bash
# Expect: true
curl -s -X POST https://panel.testerify.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<TEST_EMAIL>","password":"<TEST_PASSWORD>","includeTokens":true}' | jq 'has("tokens")'

# Capture and exercise the pair. Expect: user object, then true.
LOGIN=$(curl -s -X POST https://panel.testerify.com/api/auth/login -H 'Content-Type: application/json' -d '{"email":"<TEST_EMAIL>","password":"<TEST_PASSWORD>","includeTokens":true}')
ACCESS=$(echo "$LOGIN" | jq -r .tokens.accessToken)
REFRESH=$(echo "$LOGIN" | jq -r .tokens.refreshToken)
curl -s https://panel.testerify.com/api/auth/me -H "Authorization: Bearer $ACCESS" | jq .user
curl -s -X POST https://panel.testerify.com/api/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$REFRESH\"}" | jq '.tokens != null'
```

---

### Task 2: Scaffold the Expo app + test harness

**Files:**
- Create: entire Expo project at repo root (template), `app/`, `package.json`, `tsconfig.json`, `.env.example`
- Create: `src/__tests__/smoke.test.tsx`

**Interfaces (produced):** a running Expo Router app with all Phase-1 dependencies installed and `npm test` green.

- [ ] **Step 1: Scaffold**

`create-expo-app` won't scaffold into a non-empty dir (we have `docs/` + `.git`), so scaffold to a temp dir and move up:

```bash
cd /Users/alpsenel/Desktop/personal-projects/Testerify-Mobile
npx create-expo-app@latest app-tmp --template default --no-install
rsync -a app-tmp/ ./ && rm -rf app-tmp
npm install
npm run reset-project   # template script: moves the example to app-example/, leaves a blank app/
rm -rf app-example
```

- [ ] **Step 2: Install dependencies**

```bash
npx expo install expo-secure-store expo-font react-native-svg react-native-reanimated react-native-gesture-handler @react-native-community/netinfo
npx expo install @expo-google-fonts/instrument-sans @expo-google-fonts/ibm-plex-mono
npm install @tanstack/react-query zustand @gorhom/bottom-sheet
npm install -D jest jest-expo @testing-library/react-native @types/jest
```

If the build later errors on Reanimated's Babel plugin (older SDKs only), create `babel.config.js` with preset `babel-preset-expo` and plugin `react-native-reanimated/plugin` (must be last).

- [ ] **Step 3: Configure Jest**

Add to `package.json`:

```json
"scripts": { "test": "jest" },
"jest": {
  "preset": "jest-expo",
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|@gorhom/.*|zustand|@tanstack/.*))"
  ]
}
```

- [ ] **Step 4: Env example + smoke test**

`.env.example`:
```
# Copy to .env — Expo inlines EXPO_PUBLIC_* at build time
EXPO_PUBLIC_API_URL=https://panel.testerify.com
```

`src/__tests__/smoke.test.tsx`:
```tsx
import { render } from '@testing-library/react-native'
import { Text } from 'react-native'

test('harness renders', () => {
  const { getByText } = render(<Text>ok</Text>)
  expect(getByText('ok')).toBeTruthy()
})
```

- [ ] **Step 5: Verify and commit**

Run: `npm test` → PASS. Run: `npx tsc --noEmit` → clean. Run `npx expo start` once and open on simulator/device — blank router screen renders.

```bash
git add -A && git commit -m "chore: scaffold Expo app with router, query, sheets, svg, jest harness"
```

---

### Task 3: Theme, fonts, icons, core primitives

**Files:**
- Create: `src/theme/index.ts`, `src/components/Icon.tsx`, `src/components/Card.tsx`, `src/components/StatusPill.tsx`, `src/components/Skeleton.tsx`, `src/components/RetryCard.tsx`, `src/components/EmptyState.tsx`
- Modify: `app/_layout.tsx` (font loading)
- Test: `src/components/__tests__/primitives.test.tsx`

**Interfaces (produced):**
- `colors`, `fonts`, `radius`, `type` from `src/theme`
- `<Icon name size color strokeWidth?>` — name is a typed union of the design's stroke icons
- `<Card style?>{children}</Card>`, `<StatusPill label tone pulse?>` (`tone: 'pos'|'neutral'|'accent'|'warn'`), `<Skeleton height width? radius?>`, `<RetryCard message onRetry>`, `<EmptyState message>`

- [ ] **Step 1: Theme tokens**

`src/theme/index.ts`. Soft tints are precomputed sRGB equivalents of the design's `color-mix()` values (RN has no color-mix):

```ts
export const colors = {
  paper: '#f4f1ea', card: '#fcfbf7', border: '#e7e0d3', hairline: '#efe9de',
  ink: '#211e1a', secondary: '#5d564b', muted: '#968d7e', faint: '#b3aa99',
  track: '#ece6da',
  accent: '#5b54e0', accentSoft: '#eae9f4', accentBorder: '#c5bed6',
  pos: '#2f8f5b', posSoft: '#e1ede3', posBorder: '#b7cbb4',
  neg: '#c2553c', warn: '#b9842a', warnSoft: '#f2e9d8',
}

export const fonts = {
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansSemi: 'InstrumentSans_600SemiBold',
  sansBold: 'InstrumentSans_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemi: 'IBMPlexMono_600SemiBold',
}

export const radius = { chip: 11, control: 13, card: 15, cardLg: 16, hero: 18, sheet: 24 }

import { TextStyle } from 'react-native'
export const type: Record<string, TextStyle> = {
  kicker: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted },
  h1: { fontFamily: fonts.sans, fontSize: 26, color: colors.ink },
  h2: { fontFamily: fonts.sans, fontSize: 22, color: colors.ink },
  title: { fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink },
  body: { fontFamily: fonts.sans, fontSize: 13, color: colors.secondary, lineHeight: 19 },
  small: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  monoSmall: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  monoStat: { fontFamily: fonts.monoSemi, fontSize: 16, color: colors.ink },
}
```

- [ ] **Step 2: Load fonts in the root layout**

`app/_layout.tsx` (extended again in Tasks 6/9 — keep this shape):

```tsx
import { useFonts, InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans'
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono'
import { Stack } from 'expo-router'

export default function RootLayout() {
  const [loaded] = useFonts({
    InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold,
    IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold,
  })
  if (!loaded) return null
  return <Stack screenOptions={{ headerShown: false }} />
}
```

- [ ] **Step 3: Icon set**

`src/components/Icon.tsx` — the design's stroke-path table rendered via react-native-svg. Copy the `P` path strings **exactly** from the design file (`Testerify Mobile.dc.html` lines 1232–1268; a local extract lives in the session scratchpad, but the canonical source is the design project):

```tsx
import Svg, { Path, Circle, Rect } from 'react-native-svg'

const P: Record<string, string> = {
  home: 'M4 11.5 12 4l8 7.5 M6 10v9.5h12V10 M10 19.5V14h4v5.5',
  beaker: 'M9 3h6 M10 3v6L5.5 17a2.2 2.2 0 0 0 2 3.2h9a2.2 2.2 0 0 0 2-3.2L14 9V3 M7.5 14h9',
  bars: 'M5 20V10 M12 20V4 M19 20v-7',
  star: 'M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z',
  sparkle: 'M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  arrowUp: 'M12 19V5 M6 11l6-6 6 6',
  arrowLeft: 'M19 12H5 M11 6l-6 6 6 6',
  trendUp: 'M4 16l5-5 3 3 7-7 M16 7h4v4',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19 M19.5 19v-1.4a3.5 3.5 0 0 0-2.6-3.4M15.5 5.2a3.2 3.2 0 0 1 0 5.6',
  target: '', // circles-only icon — see special-case render below
  dollar: 'M12 3v18 M16 7.5C16 5.6 14.2 4.5 12 4.5S8 5.6 8 7.5 9.8 10 12 10.5s4 1.2 4 3.2-1.8 3-4 3-4-1.1-4-3',
  bolt: 'M13 3 5 13h6l-1 8 8-10h-6z',
  check: 'M5 12.5l4.5 4.5L19 7',
  plus: 'M12 5v14M5 12h14',
  play: 'M7 5.5v13l11-6.5z',
  pause: 'M9 5v14M15 5v14',
  flag: 'M6 21V4 M6 5h11l-2 3.5L17 12H6',
  clock: 'M12 8v4.5l3 1.8', // + circle r8 special-case
  chevron: 'M9 6l6 6-6 6',
  layers: 'M12 4l8 4-8 4-8-4z M4 12l8 4 8-4',
  x: 'M6 6l12 12M18 6 6 18',
  warning: 'M10.3 4.3 2.6 17.7A2 2 0 0 0 4.3 20.7h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z M12 9.5v4',
  search: 'M20 20l-3.5-3.5', // + circle cx11 cy11 r6 special-case
  mail: 'M3.5 7l8.5 6 8.5-6', // + rect special-case
  send: 'M21 3 10 14 M21 3l-7 18-3-8-8-3z',
  trash: 'M5 7h14 M9 7V5h6v2 M7 7l1 12.5h8L17 7',
}

export type IconName = keyof typeof P

export function Icon({ name, size = 16, color = '#211e1a', strokeWidth = 1.6, filled = false }: {
  name: IconName; size?: number; color?: string; strokeWidth?: number; filled?: boolean
}) {
  const common = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'target' && (<>
        <Circle cx={12} cy={12} r={8} {...common} /><Circle cx={12} cy={12} r={4} {...common} /><Circle cx={12} cy={12} r={0.6} fill={color} />
      </>)}
      {name === 'clock' && <Circle cx={12} cy={12} r={8} {...common} />}
      {name === 'search' && <Circle cx={11} cy={11} r={6} {...common} />}
      {name === 'warning' && <Circle cx={12} cy={16.8} r={0.7} fill={color} />}
      {name === 'mail' && <Rect x={3} y={6} width={18} height={12} rx={2} {...common} />}
      {P[name] ? <Path d={P[name]} {...common} fill={filled || name === 'play' ? color : 'none'} /> : null}
    </Svg>
  )
}
```

- [ ] **Step 4: Primitives**

`src/components/Card.tsx`:
```tsx
import { View, ViewStyle, StyleProp } from 'react-native'
import { colors, radius } from '../theme'

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: radius.card, padding: 14,
      shadowColor: '#282214', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    }, style]}>{children}</View>
  )
}
```

`src/components/StatusPill.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { Animated, Text, View } from 'react-native'
import { colors, fonts } from '../theme'

const TONES = {
  pos: { fg: colors.pos, bg: colors.posSoft },
  accent: { fg: colors.accent, bg: colors.accentSoft },
  warn: { fg: colors.warn, bg: colors.warnSoft },
  neutral: { fg: colors.secondary, bg: colors.track },
} as const
export type PillTone = keyof typeof TONES

export function StatusPill({ label, tone, pulse = false }: { label: string; tone: PillTone; pulse?: boolean }) {
  const { fg, bg } = TONES[tone]
  const opacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (!pulse) return
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.35, duration: 1100, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 1100, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [pulse, opacity])
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      {pulse && <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg, opacity }} />}
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11.5, color: fg }}>{label}</Text>
    </View>
  )
}
```

`src/components/Skeleton.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { Animated, DimensionValue } from 'react-native'
import { colors } from '../theme'

export function Skeleton({ height, width = '100%' as DimensionValue, borderRadius = 15 }: {
  height: number; width?: DimensionValue; borderRadius?: number
}) {
  const opacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [opacity])
  return <Animated.View style={{ height, width, borderRadius, backgroundColor: colors.track, opacity }} />
}
```

`src/components/RetryCard.tsx`:
```tsx
import { Pressable, Text, View } from 'react-native'
import { Card } from './Card'
import { colors, fonts, type } from '../theme'

export function RetryCard({ message = "Couldn't load. Check your connection.", onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
      <Text style={type.body}>{message}</Text>
      <Pressable onPress={onRetry} style={{ backgroundColor: colors.accent, borderRadius: 11, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: '#fff' }}>Retry</Text>
      </Pressable>
    </Card>
  )
}
```

`src/components/EmptyState.tsx`:
```tsx
import { Text, View } from 'react-native'
import { colors, type } from '../theme'

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={{ padding: 36, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 15 }}>
      <Text style={[type.body, { textAlign: 'center' }]}>{message}</Text>
    </View>
  )
}
```

- [ ] **Step 5: Test, verify, commit**

`src/components/__tests__/primitives.test.tsx`:
```tsx
import { render } from '@testing-library/react-native'
import { StatusPill } from '../StatusPill'
import { RetryCard } from '../RetryCard'
import { EmptyState } from '../EmptyState'

test('StatusPill renders its label', () => {
  const { getByText } = render(<StatusPill label="Running" tone="pos" pulse />)
  expect(getByText('Running')).toBeTruthy()
})

test('RetryCard fires onRetry', () => {
  const onRetry = jest.fn()
  const { getByText } = render(<RetryCard onRetry={onRetry} />)
  getByText('Retry').props.onPress?.() // Pressable text — fireEvent also fine
})

test('EmptyState renders message', () => {
  const { getByText } = render(<EmptyState message="No tests match." />)
  expect(getByText('No tests match.')).toBeTruthy()
})
```

Run: `npm test` → PASS. `npx tsc --noEmit` → clean.

```bash
git add -A && git commit -m "feat: theme tokens, fonts, icon set, core primitives"
```

---

### Task 4: Formatters (TDD)

**Files:**
- Create: `src/utils/format.ts`
- Test: `src/utils/__tests__/format.test.ts`

**Interfaces (produced):**
- `compact(n: number): string` — `48234 → '48.2k'`, `920 → '920'`, `1240000 → '1.2m'`
- `pct(n: number, digits?: number): string` — `14.234 → '14.2%'`
- `signedPct(n: number, digits?: number): string` — `14.2 → '+14.2%'`, `-1.4 → '−1.4%'` (U+2212 minus, as in the design)
- `money(n: number, code?: string | null): string` — `41235 → '$41.2k'` (USD default symbol; unknown code → `'41.2k USD'` style)
- `relTime(iso: string, now?: Date): string` — `'2 hours ago' | 'Yesterday' | 'Jul 21'`
- `daysBetween(aIso: string, b?: Date): number`

- [ ] **Step 1: Write the failing tests**

`src/utils/__tests__/format.test.ts`:
```ts
import { compact, pct, signedPct, money, relTime, daysBetween } from '../format'

const NOW = new Date('2026-07-25T12:00:00Z')

test('compact', () => {
  expect(compact(920)).toBe('920')
  expect(compact(48234)).toBe('48.2k')
  expect(compact(6100)).toBe('6.1k')
  expect(compact(1240000)).toBe('1.2m')
  expect(compact(0)).toBe('0')
})

test('pct / signedPct', () => {
  expect(pct(14.234)).toBe('14.2%')
  expect(pct(97, 0)).toBe('97%')
  expect(signedPct(14.2)).toBe('+14.2%')
  expect(signedPct(-1.4)).toBe('−1.4%')
})

test('money', () => {
  expect(money(41235, 'USD')).toBe('$41.2k')
  expect(money(52, 'USD')).toBe('$52')
  expect(money(41235, null)).toBe('41.2k')
  expect(money(9800, 'SEK')).toBe('9.8k SEK')
})

test('relTime', () => {
  expect(relTime('2026-07-25T10:00:00Z', NOW)).toBe('2 hours ago')
  expect(relTime('2026-07-25T11:59:40Z', NOW)).toBe('just now')
  expect(relTime('2026-07-25T11:42:00Z', NOW)).toBe('18 mins ago')
  expect(relTime('2026-07-24T09:00:00Z', NOW)).toBe('Yesterday')
  expect(relTime('2026-07-21T09:00:00Z', NOW)).toBe('Jul 21')
})

test('daysBetween', () => {
  expect(daysBetween('2026-07-16T00:00:00Z', NOW)).toBe(9)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/utils/__tests__/format.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

`src/utils/format.ts`:
```ts
const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }

export function compact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return trim1(n / 1_000_000) + 'm'
  if (abs >= 1_000) return trim1(n / 1_000) + 'k'
  return String(Math.round(n))
}
const trim1 = (x: number) => {
  const s = (Math.round(x * 10) / 10).toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

export function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits).replace(/\.0+$/, digits > 0 ? '.0' : '')}%`.replace(/\.0%$/, digits === 0 ? '%' : '.0%')
}
// Simpler + matches tests exactly:
// pct(14.234) -> '14.2%', pct(97, 0) -> '97%'
export function signedPct(n: number, digits = 1): string {
  const body = pct(Math.abs(n), digits)
  return n < 0 ? `−${body}` : `+${body}`
}

export function money(n: number, code?: string | null): string {
  const num = compact(n)
  if (!code) return num
  const sym = SYMBOL[code]
  return sym ? `${sym}${num}` : `${num} ${code}`
}

export function relTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (isSameDay(d, now)) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (isSameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
const isSameDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10)

export function daysBetween(aIso: string, b: Date = new Date()): number {
  return Math.max(0, Math.round((b.getTime() - new Date(aIso).getTime()) / 86_400_000))
}
```

Note on `pct`: if the double-replace reads confusingly, simplify to `n.toFixed(digits) + '%'` — the tests define the contract; make them pass with the simplest code.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/utils/__tests__/format.test.ts` → PASS (fix impl, not tests, on mismatch).

- [ ] **Step 5: Commit**

```bash
git add src/utils && git commit -m "feat: number/percent/money/time formatters"
```

---

### Task 5: Token storage + API client with refresh-and-retry (TDD)

**Files:**
- Create: `src/api/config.ts`, `src/api/tokens.ts`, `src/api/client.ts`
- Test: `src/api/__tests__/client.test.ts`

**Interfaces (produced):**
- `API_URL: string`
- `getTokens(): Promise<{ access: string; refresh: string } | null>`, `setTokens(t): Promise<void>`, `clearTokens(): Promise<void>`
- `apiFetch<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T>` — throws `ApiError { status, body }`
- `onSessionExpired(cb: () => void): void`

- [ ] **Step 1: Write the failing tests**

`src/api/__tests__/client.test.ts`:
```ts
import * as SecureStore from 'expo-secure-store'
import { apiFetch, ApiError, onSessionExpired } from '../client'
import { setTokens, clearTokens } from '../tokens'

jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {}
  return {
    getItemAsync: jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
    setItemAsync: jest.fn((k: string, v: string) => { store[k] = v; return Promise.resolve() }),
    deleteItemAsync: jest.fn((k: string) => { delete store[k]; return Promise.resolve() }),
  }
})

const ok = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response)

beforeEach(async () => {
  jest.restoreAllMocks()
  await clearTokens()
})

test('adds Bearer header from stored tokens', async () => {
  await setTokens({ access: 'A1', refresh: 'R1' })
  const spy = jest.spyOn(global, 'fetch').mockImplementation(() => ok({ hello: 1 }))
  await apiFetch('/api/auth/me')
  const [, init] = spy.mock.calls[0]
  expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer A1')
})

test('401 → refresh → retry once with new token', async () => {
  await setTokens({ access: 'stale', refresh: 'R1' })
  const spy = jest.spyOn(global, 'fetch')
    .mockImplementationOnce(() => ok({ error: 'expired' }, 401))
    .mockImplementationOnce(() => ok({ message: 'Token refreshed', tokens: { accessToken: 'A2', refreshToken: 'R2' } }))
    .mockImplementationOnce(() => ok({ campaigns: [] }))
  const result = await apiFetch<{ campaigns: [] }>('/api/campaigns')
  expect(result.campaigns).toEqual([])
  expect(spy.mock.calls[1][0]).toContain('/api/auth/refresh')
  expect((spy.mock.calls[2][1]!.headers as Record<string, string>).Authorization).toBe('Bearer A2')
})

test('refresh failure clears tokens and fires onSessionExpired', async () => {
  await setTokens({ access: 'stale', refresh: 'dead' })
  const expired = jest.fn()
  onSessionExpired(expired)
  jest.spyOn(global, 'fetch')
    .mockImplementationOnce(() => ok({ error: 'expired' }, 401))
    .mockImplementationOnce(() => ok({ error: 'Invalid refresh token' }, 401))
  await expect(apiFetch('/api/campaigns')).rejects.toThrow(ApiError)
  expect(expired).toHaveBeenCalled()
  expect(await (SecureStore.getItemAsync as jest.Mock)('testerify.access')).toBeNull()
})

test('non-401 error throws ApiError with server message', async () => {
  await setTokens({ access: 'A1', refresh: 'R1' })
  jest.spyOn(global, 'fetch').mockImplementation(() => ok({ error: 'Unknown action' }, 400))
  await expect(apiFetch('/api/campaigns/x', { method: 'POST' })).rejects.toMatchObject({ status: 400, message: 'Unknown action' })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/api` → FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/api/config.ts`:
```ts
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://panel.testerify.com'
```

`src/api/tokens.ts`:
```ts
import * as SecureStore from 'expo-secure-store'

const ACCESS = 'testerify.access'
const REFRESH = 'testerify.refresh'

export type TokenPair = { access: string; refresh: string }

export async function getTokens(): Promise<TokenPair | null> {
  const [access, refresh] = await Promise.all([SecureStore.getItemAsync(ACCESS), SecureStore.getItemAsync(REFRESH)])
  return access && refresh ? { access, refresh } : null
}
export async function setTokens(t: TokenPair): Promise<void> {
  await Promise.all([SecureStore.setItemAsync(ACCESS, t.access), SecureStore.setItemAsync(REFRESH, t.refresh)])
}
export async function clearTokens(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH)])
}
```

`src/api/client.ts`:
```ts
import { API_URL } from './config'
import { getTokens, setTokens, clearTokens } from './tokens'

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown) {
    super((body as { error?: string })?.error ?? `Request failed (${status})`)
    this.status = status
    this.body = body
  }
}

let sessionExpiredCb: (() => void) | null = null
export function onSessionExpired(cb: () => void) { sessionExpiredCb = cb }

// Single-flight: concurrent 401s share one refresh (backend rotates with a
// 60s grace window, but one request is still the polite shape).
let refreshing: Promise<boolean> | null = null

async function refreshTokens(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const tokens = await getTokens()
      if (!tokens) return false
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refresh }),
      })
      if (!res.ok) return false
      const body = (await res.json()) as { tokens?: { accessToken: string; refreshToken: string } }
      if (!body.tokens) return false
      await setTokens({ access: body.tokens.accessToken, refresh: body.tokens.refreshToken })
      return true
    })().finally(() => { refreshing = null })
  }
  return refreshing
}

export async function apiFetch<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth = true, headers, ...rest } = init
  const doFetch = async (): Promise<Response> => {
    const tokens = auth ? await getTokens() : null
    return fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(tokens ? { Authorization: `Bearer ${tokens.access}` } : {}),
        ...(headers as Record<string, string>),
      },
    })
  }

  let res = await doFetch()
  if (res.status === 401 && auth) {
    const refreshed = await refreshTokens()
    if (!refreshed) {
      await clearTokens()
      sessionExpiredCb?.()
      throw new ApiError(401, await res.json().catch(() => null))
    }
    res = await doFetch()
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/api` → PASS. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/api && git commit -m "feat: secure token storage and API client with single-flight refresh-retry"
```

---

### Task 6: Auth store, login screen, routing guard

**Files:**
- Create: `src/stores/auth.ts`, `app/login.tsx`
- Modify: `app/_layout.tsx`, create `app/index.tsx`
- Test: `src/stores/__tests__/auth.test.ts`

**Interfaces (produced):**
- `useAuth` (zustand): `{ status: 'restoring' | 'signedOut' | 'signedIn'; user: User | null; company: Company | null; signIn(email, password): Promise<void>; signOut(): Promise<void>; restore(): Promise<void> }`
- `User = { id: string; name: string; email: string; role: string }`
- `Company = { id: string; name: string; slug: string; websiteUrl: string | null }`
- Routes: `/login`, `/` redirects by auth status, `/(tabs)` guarded.

- [ ] **Step 1: Write the failing store test**

`src/stores/__tests__/auth.test.ts` (mock `../../api/client` and `../../api/tokens`):
```ts
import { useAuth } from '../auth'
import * as client from '../../api/client'
import * as tokens from '../../api/tokens'

jest.mock('../../api/client', () => ({ apiFetch: jest.fn(), onSessionExpired: jest.fn() }))
jest.mock('../../api/tokens', () => ({ getTokens: jest.fn(), setTokens: jest.fn(), clearTokens: jest.fn() }))

const apiFetch = client.apiFetch as jest.Mock

beforeEach(() => { jest.clearAllMocks(); useAuth.setState({ status: 'restoring', user: null, company: null }) })

test('signIn stores tokens and user/company', async () => {
  apiFetch.mockResolvedValue({
    user: { id: 'u1', name: 'Test', email: 't@x.com', role: 'admin' },
    company: { id: 'c1', name: 'Test Store', slug: 'test', websiteUrl: null },
    stores: [],
    tokens: { accessToken: 'A', refreshToken: 'R' },
  })
  await useAuth.getState().signIn('t@x.com', 'pw')
  expect(tokens.setTokens).toHaveBeenCalledWith({ access: 'A', refresh: 'R' })
  expect(useAuth.getState().status).toBe('signedIn')
  expect(useAuth.getState().company?.name).toBe('Test Store')
  expect(apiFetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ auth: false }))
})

test('restore with no tokens → signedOut', async () => {
  ;(tokens.getTokens as jest.Mock).mockResolvedValue(null)
  await useAuth.getState().restore()
  expect(useAuth.getState().status).toBe('signedOut')
})

test('restore with tokens loads /api/auth/me', async () => {
  ;(tokens.getTokens as jest.Mock).mockResolvedValue({ access: 'A', refresh: 'R' })
  apiFetch.mockResolvedValue({ user: { id: 'u1', name: 'T', email: 't@x.com', role: 'admin' }, company: { id: 'c1', name: 'S', slug: 's', websiteUrl: null } })
  await useAuth.getState().restore()
  expect(useAuth.getState().status).toBe('signedIn')
})
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/stores` → FAIL.

- [ ] **Step 3: Implement the store**

`src/stores/auth.ts`:
```ts
import { create } from 'zustand'
import { apiFetch, onSessionExpired } from '../api/client'
import { getTokens, setTokens, clearTokens } from '../api/tokens'

export type User = { id: string; name: string; email: string; role: string }
export type Company = { id: string; name: string; slug: string; websiteUrl: string | null }

type LoginResponse = {
  user: User
  company: Company
  stores: unknown[]
  tokens?: { accessToken: string; refreshToken: string }
}

type AuthState = {
  status: 'restoring' | 'signedOut' | 'signedIn'
  user: User | null
  company: Company | null
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  restore(): Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  status: 'restoring',
  user: null,
  company: null,

  async signIn(email, password) {
    const res = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password, includeTokens: true }),
    })
    if (!res.tokens) throw new Error('Backend did not return tokens — is Task 1 deployed?')
    await setTokens({ access: res.tokens.accessToken, refresh: res.tokens.refreshToken })
    set({ status: 'signedIn', user: res.user, company: res.company })
  },

  async signOut() {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    await clearTokens()
    set({ status: 'signedOut', user: null, company: null })
  },

  async restore() {
    const tokens = await getTokens()
    if (!tokens) return set({ status: 'signedOut' })
    try {
      const me = await apiFetch<{ user: User; company: Company }>('/api/auth/me')
      set({ status: 'signedIn', user: me.user, company: me.company })
    } catch {
      await clearTokens()
      set({ status: 'signedOut', user: null, company: null })
    }
  },
}))

onSessionExpired(() => {
  useAuth.setState({ status: 'signedOut', user: null, company: null })
})
```

- [ ] **Step 4: Run to verify pass** — `npx jest src/stores` → PASS.

- [ ] **Step 5: Login screen + routing**

`app/index.tsx`:
```tsx
import { Redirect } from 'expo-router'
import { useAuth } from '../src/stores/auth'

export default function Index() {
  const status = useAuth((s) => s.status)
  if (status === 'restoring') return null
  return <Redirect href={status === 'signedIn' ? '/(tabs)' : '/login'} />
}
```

`app/_layout.tsx` — add QueryClientProvider + restore-on-mount + gesture root (sheet host arrives in Task 9):
```tsx
import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Stack } from 'expo-router'
import { useAuth } from '../src/stores/auth'
// …font imports from Task 3 stay…

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

export default function RootLayout() {
  const [loaded] = useFonts({ /* Task 3 font map */ })
  const restore = useAuth((s) => s.restore)
  useEffect(() => { restore() }, [restore])
  if (!loaded) return null
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
```

`app/login.tsx`:
```tsx
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../src/stores/auth'
import { colors, fonts, type } from '../src/theme'

const inputStyle = {
  height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
  backgroundColor: colors.card, color: colors.ink, fontFamily: fonts.sans, fontSize: 14, paddingHorizontal: 13,
} as const

export default function Login() {
  const signIn = useAuth((s) => s.signIn)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true); setError(null)
    try {
      await signIn(email.trim(), password)
      router.replace('/(tabs)')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.paper, justifyContent: 'center', padding: 24 }}>
      <View style={{ gap: 14 }}>
        <Text style={type.kicker}>Testerify · Mobile</Text>
        <Text style={type.h1}>Sign in</Text>
        <TextInput style={inputStyle} placeholder="you@store.com" placeholderTextColor={colors.muted}
          autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} testID="email" />
        <TextInput style={inputStyle} placeholder="Password" placeholderTextColor={colors.muted}
          secureTextEntry value={password} onChangeText={setPassword} testID="password" />
        {error && <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.neg }}>{error}</Text>}
        <Pressable onPress={submit} disabled={busy || !email || !password}
          style={{ backgroundColor: colors.accent, opacity: busy || !email || !password ? 0.6 : 1, borderRadius: 13, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: '#fff' }}>{busy ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}
```

- [ ] **Step 6: Verify on device and commit**

`npx tsc --noEmit` clean; `npm test` green. On the simulator: app opens → login → sign in with the **test account** → lands on the (still empty) tabs route. Wrong password shows the server's error text.

```bash
git add -A && git commit -m "feat: auth store, login screen, auth-based routing"
```

---

### Task 7: API modules + test-model helpers (TDD helpers)

**Files:**
- Create: `src/api/campaigns.ts`, `src/api/dashboard.ts`, `src/api/ai.ts`, `src/utils/testModel.ts`
- Test: `src/utils/__tests__/testModel.test.ts`

**Interfaces (produced — response fields verified against backend source `api/campaigns/index.js`, `api/campaigns/[id].js`, `api/stats/dashboard.js`, `api/ai/suggestions.js`, `api/_lib/storeScan.js`, `api/ai/generate-test/index.js`):**

```ts
// campaigns.ts
export type CampaignStatus = 'draft' | 'running' | 'paused' | 'rollout' | 'completed'
export type SigStatus = 'winning' | 'losing' | 'inconclusive' | 'not_enough_data'
export type VariantSummary = { id: string; name: string; visitors: number; conversions: number; impressions: number; revenue: number; rate: number }
export type RolloutRecord = { winnerVariantId: string; promotedAt: string; decision?: string; confidence?: number; uplift?: number } | null
export type CampaignListItem = {
  id: string; name: string; kind: 'ab' | 'nudge' | 'offer' | 'personalization'
  status: CampaignStatus; targetUrl: string | null; goals: unknown
  rollout: RolloutRecord; learningNote: string | null
  startsAt: string | null; endsAt: string | null; createdAt: string; updatedAt: string
  variants: number; visitors: number; conversions: number; revenue: number; conversionRate: number
  started: string
  control: VariantSummary | null; challenger: VariantSummary | null
  uplift: number; confidence: number; pValue: number; sigStatus: SigStatus
  forecast: { state: 'no_traffic' | 'forecast' | 'unreliable' | 'ready'; days?: number } | null
  trend: number[]
}
export type CampaignVariant = { id: string; name: string; isControl: boolean; stats: { visitors: number; conversions: number; impressions: number; revenue: number } }
export type Significance = { controlRate: number; variantRate: number; uplift: number; confidence: number; pValue: number; status: SigStatus }
export type CampaignDetail = CampaignListItem & {  // list fields that overlap keep their meaning
  variants: CampaignVariant[] & unknown  // NOTE: detail `variants` is the array (list uses a count) — model as: 
}
// Use a separate type instead of extending (the `variants` collision is real):
export type CampaignDetailData = {
  id: string; name: string; status: CampaignStatus; kind: string
  targetUrl: string | null; startsAt: string | null; endsAt: string | null; createdAt: string
  rollout: RolloutRecord; learningNote: string | null
  variants: CampaignVariant[]
  stats: { visitors: number; conversions: number; impressions: number; revenue: number }
  forecast: unknown
  timeline: { labels: string[]; byVariant: Record<string, number[]> }
  revenueCurrency: { code: string | null; mixed: boolean }
  impact: unknown
  controlId: string | null; challengerId: string | null
  significance: Significance | null
}

export const fetchCampaigns = () => apiFetch<{ campaigns: CampaignListItem[] }>('/api/campaigns').then(r => r.campaigns)
export const fetchCampaign = (id: string) => apiFetch<{ campaign: CampaignDetailData }>(`/api/campaigns/${id}`).then(r => r.campaign)
export const promoteCampaign = (id: string, variantId: string) =>
  apiFetch<{ campaign: unknown; rollout: unknown }>(`/api/campaigns/${id}`, { method: 'POST', body: JSON.stringify({ action: 'promote', variantId }) })
export const rollbackCampaign = (id: string) =>
  apiFetch<{ campaign: unknown }>(`/api/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'running' }) })

// dashboard.ts
export type DashboardStats = {
  currency: { code: string | null; mixed: boolean }
  stats: { visitors: number; activeCampaigns: number; avgConversionRate: number; conversions: number; revenue: number }
  visitorTraffic: { date: string; visitors: number }[]
  campaignPerformance: { x: string; y: number }[]
}
export const fetchDashboard = () => apiFetch<DashboardStats>('/api/stats/dashboard')

// ai.ts
export type AiIdea = {
  title: string; hypothesis: string; element: string | null; change: string | null
  evidence: string | null; page: string | null; path: string | null; metric: string | null
  impact: 'high' | 'medium' | 'low'; difficulty: 'easy' | 'medium' | 'hard'
}
export type SavedSuggestions = { ideas: AiIdea[]; source: 'you' | 'company' | null; goal: string | null; generatedAt: string | null }
export const fetchSuggestions = () => apiFetch<SavedSuggestions>('/api/ai/suggestions')
export const generateSuggestions = (goal: string) =>
  apiFetch<{ ideas: AiIdea[] }>('/api/ai/suggestions', { method: 'POST', body: JSON.stringify({ goal }) })
export const generateTestDraft = (input: { name: string; goal: string; path?: string | null }) =>
  apiFetch<{ campaign: { id: string }; hypothesis: string | null }>('/api/ai/generate-test', {
    method: 'POST',
    body: JSON.stringify({ name: input.name, goal: input.goal, ...(input.path ? { path: input.path } : {}) }),
  })
```

```ts
// testModel.ts
export function confColor(confidence: number): string          // >=95 pos, >=70 warn, else muted
export function statusLabel(status: CampaignStatus): string    // Running / Draft / Paused / Rolled out / Completed
export function statusTone(status: CampaignStatus): PillTone   // running→pos, rollout→accent, else neutral
export function statusPulse(status: CampaignStatus): boolean   // running only
export function shipReady(c: CampaignListItem): boolean        // running && winning && confidence>=95 && uplift>0
export function verdictFor(c: CampaignListItem): { label: string; tone: PillTone }
  // shipReady→'Ship it' pos · rollout→'Shipped' accent · draft→'Draft' neutral · else 'Collecting' neutral
export function rollbackUntil(promotedAtIso: string): Date     // promotedAt + 30 days
```

- [ ] **Step 1: Write failing tests for testModel**

`src/utils/__tests__/testModel.test.ts`:
```ts
import { confColor, shipReady, verdictFor, statusLabel, rollbackUntil } from '../testModel'
import { colors } from '../../theme'
import type { CampaignListItem } from '../../api/campaigns'

const base = {
  id: 't1', name: 'X', kind: 'ab', status: 'running', targetUrl: null, goals: null,
  rollout: null, learningNote: null, startsAt: null, endsAt: null,
  createdAt: '2026-07-16T00:00:00Z', updatedAt: '2026-07-25T00:00:00Z', started: '2026-07-16T00:00:00Z',
  variants: 2, visitors: 12500, conversions: 576, revenue: 24800, conversionRate: 4.6,
  control: null, challenger: null, uplift: 14.2, confidence: 97, pValue: 0.03,
  sigStatus: 'winning', forecast: null, trend: [],
} as CampaignListItem

test('confColor thresholds', () => {
  expect(confColor(97)).toBe(colors.pos)
  expect(confColor(84)).toBe(colors.warn)
  expect(confColor(38)).toBe(colors.muted)
})

test('shipReady requires running + winning + >=95 + positive uplift', () => {
  expect(shipReady(base)).toBe(true)
  expect(shipReady({ ...base, confidence: 84 })).toBe(false)
  expect(shipReady({ ...base, sigStatus: 'inconclusive' })).toBe(false)
  expect(shipReady({ ...base, status: 'rollout' })).toBe(false)
  expect(shipReady({ ...base, uplift: -2 })).toBe(false)
})

test('verdictFor', () => {
  expect(verdictFor(base).label).toBe('Ship it')
  expect(verdictFor({ ...base, confidence: 71 }).label).toBe('Collecting')
  expect(verdictFor({ ...base, status: 'rollout' }).label).toBe('Shipped')
  expect(verdictFor({ ...base, status: 'draft' }).label).toBe('Draft')
})

test('statusLabel + rollbackUntil', () => {
  expect(statusLabel('rollout')).toBe('Rolled out')
  expect(rollbackUntil('2026-07-25T10:00:00Z').toISOString().slice(0, 10)).toBe('2026-08-24')
})
```

- [ ] **Step 2: Run to verify failure** — `npx jest testModel` → FAIL.

- [ ] **Step 3: Implement all four modules** with the exact interfaces above (the API modules are declarative — no tests beyond type-checking; `testModel.ts`:)

```ts
import { colors } from '../theme'
import type { PillTone } from '../components/StatusPill'
import type { CampaignListItem, CampaignStatus } from '../api/campaigns'

export const confColor = (confidence: number) =>
  confidence >= 95 ? colors.pos : confidence >= 70 ? colors.warn : colors.muted

export const statusLabel = (s: CampaignStatus) =>
  ({ draft: 'Draft', running: 'Running', paused: 'Paused', rollout: 'Rolled out', completed: 'Completed' })[s]

export const statusTone = (s: CampaignStatus): PillTone =>
  s === 'running' ? 'pos' : s === 'rollout' ? 'accent' : 'neutral'

export const statusPulse = (s: CampaignStatus) => s === 'running'

export const shipReady = (c: CampaignListItem) =>
  c.status === 'running' && c.sigStatus === 'winning' && c.confidence >= 95 && c.uplift > 0

export function verdictFor(c: CampaignListItem): { label: string; tone: PillTone } {
  if (c.status === 'rollout') return { label: 'Shipped', tone: 'accent' }
  if (c.status === 'draft') return { label: 'Draft', tone: 'neutral' }
  if (shipReady(c)) return { label: 'Ship it', tone: 'pos' }
  return { label: 'Collecting', tone: 'neutral' }
}

export const rollbackUntil = (promotedAtIso: string) =>
  new Date(new Date(promotedAtIso).getTime() + 30 * 86_400_000)
```

- [ ] **Step 4: Run to verify pass** — `npx jest testModel` → PASS; `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/api src/utils && git commit -m "feat: typed API modules (campaigns/dashboard/ai) and test-model helpers"
```

---

### Task 8: Charts — smoothPath, Sparkline, DetailChart (TDD path)

**Files:**
- Create: `src/components/charts/path.ts`, `src/components/charts/Sparkline.tsx`, `src/components/charts/DetailChart.tsx`
- Test: `src/components/charts/__tests__/path.test.ts`

**Interfaces (produced):**
- `smoothPath(pts: { x: number; y: number }[]): string` — Catmull-Rom-style cubic path (direct port of the design prototype)
- `<Sparkline data={number[]} color width height />` — smoothed line + soft gradient fill
- `<DetailChart labels={string[]} seriesA={number[]} seriesB={number[]} />` — the test-detail daily conversion chart: dashed muted control line, solid accent challenger line with gradient fill + end dot, 5 gridlines with y labels, x labels every 2nd point

- [ ] **Step 1: Failing test**

`src/components/charts/__tests__/path.test.ts`:
```ts
import { smoothPath } from '../path'

test('empty and single point → empty path', () => {
  expect(smoothPath([])).toBe('')
  expect(smoothPath([{ x: 0, y: 0 }])).toBe('')
})

test('two points produce M + C segments', () => {
  const d = smoothPath([{ x: 0, y: 10 }, { x: 100, y: 20 }])
  expect(d.startsWith('M 0 10')).toBe(true)
  expect(d).toContain(' C ')
})

test('n points produce n-1 curve segments', () => {
  const d = smoothPath([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 3, y: 1 }])
  expect(d.split(' C ').length - 1).toBe(3)
})
```

- [ ] **Step 2: Run to verify failure** — `npx jest charts` → FAIL.

- [ ] **Step 3: Implement** (port from the design file's `smoothPath`, verbatim logic):

```ts
export function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`
  }
  return d
}
```

- [ ] **Step 4: Run to verify pass**, then build the two components (ports of the design's `spark()` and `detailChart()` — swap `React.createElement('svg'…)` for react-native-svg `<Svg>/<Path>/<Line>/<SvgText>/<Defs>/<LinearGradient>/<Stop>/<Circle>`; keep the geometry: DetailChart `W=306 H=176 pad={l:26,r:6,t:12,b:24}`, y-domain from data min/max padded 10%, 5 gridlines dashed `2 5`, fonts `IBM Plex Mono` size 9 `#968d7e`; Sparkline `viewBox 0 0 w h`, `preserveAspectRatio="none"`, fill gradient stops 0.2→0 opacity).

`DetailChart` renders `seriesA` dashed (`strokeDasharray="4 4"`, `#968d7e`, width 2) and `seriesB` solid (`#5b54e0`, width 2.4, gradient area fill, end dot r=4 with card-colored 2px ring).

- [ ] **Step 5: Verify + commit**

`npx tsc --noEmit` clean; render both once on the simulator behind a temporary route or storybook-style screen if convenient (delete before commit).

```bash
git add src/components/charts && git commit -m "feat: svg chart ports (smoothPath, Sparkline, DetailChart)"
```

---

### Task 9: Tab shell — custom tab bar, FAB, sheet host, More sheet, toast

**Files:**
- Create: `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx` (placeholder), `app/(tabs)/tests.tsx` (placeholder), `app/(tabs)/alerts.tsx` (placeholder)
- Create: `src/stores/sheets.ts`, `src/stores/toast.ts`, `src/components/TabBar.tsx`, `src/components/SheetHost.tsx`, `src/components/sheets/MoreSheet.tsx`, `src/components/ToastHost.tsx`
- Modify: `app/_layout.tsx` (mount `BottomSheetModalProvider`, `SheetHost`, `ToastHost`)
- Test: `src/stores/__tests__/sheets.test.ts`

**Interfaces (produced):**
- `useSheets`: `{ sheet: SheetState; openMore(): void; openCopilot(): void; openShip(campaignId: string): void; close(): void }` where `SheetState = { kind: 'more' } | { kind: 'copilot' } | { kind: 'ship'; campaignId: string } | null`
- `useToast`: `{ message: string | null; show(message: string): void }` (auto-hides after 4200 ms)
- `<TabBar/>` — receives Expo Router Tabs props; Home/Tests left, Alerts/More right, center FAB
- Alerts badge count comes from Task 14's hook; TabBar takes optional `badgeCount?: number` until then (default 0)

- [ ] **Step 1: Failing store tests**

`src/stores/__tests__/sheets.test.ts`:
```ts
import { useSheets } from '../sheets'
import { useToast } from '../toast'

jest.useFakeTimers()

test('sheet transitions', () => {
  const s = useSheets.getState()
  s.openMore()
  expect(useSheets.getState().sheet).toEqual({ kind: 'more' })
  useSheets.getState().openShip('c1')
  expect(useSheets.getState().sheet).toEqual({ kind: 'ship', campaignId: 'c1' })
  useSheets.getState().close()
  expect(useSheets.getState().sheet).toBeNull()
})

test('toast auto-hides after 4200ms', () => {
  useToast.getState().show('Shipped!')
  expect(useToast.getState().message).toBe('Shipped!')
  jest.advanceTimersByTime(4300)
  expect(useToast.getState().message).toBeNull()
})
```

- [ ] **Step 2: Run to verify failure**, then implement the stores:

`src/stores/sheets.ts`:
```ts
import { create } from 'zustand'

export type SheetState = { kind: 'more' } | { kind: 'copilot' } | { kind: 'ship'; campaignId: string } | null

type Sheets = {
  sheet: SheetState
  openMore(): void
  openCopilot(): void
  openShip(campaignId: string): void
  close(): void
}

export const useSheets = create<Sheets>((set) => ({
  sheet: null,
  openMore: () => set({ sheet: { kind: 'more' } }),
  openCopilot: () => set({ sheet: { kind: 'copilot' } }),
  openShip: (campaignId) => set({ sheet: { kind: 'ship', campaignId } }),
  close: () => set({ sheet: null }),
}))
```

`src/stores/toast.ts`:
```ts
import { create } from 'zustand'

type Toast = { message: string | null; show(message: string): void }
let timer: ReturnType<typeof setTimeout> | null = null

export const useToast = create<Toast>((set) => ({
  message: null,
  show(message) {
    if (timer) clearTimeout(timer)
    set({ message })
    timer = setTimeout(() => set({ message: null }), 4200)
  },
}))
```

- [ ] **Step 3: Tab bar + tabs layout**

`src/components/TabBar.tsx` — design: `#fcfbf7`-ish bar, top hairline, 2+2 tabs around a 76px center slot labeled “Co-pilot”, raised 60px indigo FAB at `bottom: 52` with paper ring:

```tsx
import { Pressable, Text, View, Platform } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Icon, IconName } from './Icon'
import { colors, fonts } from '../theme'
import { useSheets } from '../stores/sheets'

const TABS: { route: string; label: string; icon: IconName }[] = [
  { route: 'index', label: 'Home', icon: 'home' },
  { route: 'tests', label: 'Tests', icon: 'beaker' },
  { route: 'alerts', label: 'Alerts', icon: 'bell' },   // 'bell' path: add to Icon P table (design line 1265): 'M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15z M10 18.5a2 2 0 0 0 4 0'
]

export function TabBar({ state, navigation, badgeCount = 0 }: BottomTabBarProps & { badgeCount?: number }) {
  const { openMore, openCopilot } = useSheets()
  const current = state.routes[state.index]?.name

  const tab = (route: string, label: string, icon: IconName, extra?: React.ReactNode) => {
    const active = current === route
    return (
      <Pressable key={route} onPress={() => navigation.navigate(route)}
        style={{ flex: 1, alignItems: 'center', gap: 4, paddingTop: 7, minHeight: 52 }}>
        <View>
          <Icon name={icon} size={23} color={active ? colors.accent : colors.muted} />
          {extra}
        </View>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10.5, color: active ? colors.accent : colors.muted }}>{label}</Text>
      </Pressable>
    )
  }

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#faf8f2', flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 30 : 14 }}>
      {tab('index', 'Home', 'home')}
      {tab('tests', 'Tests', 'beaker')}
      <View style={{ width: 76, alignItems: 'center', paddingTop: 7, minHeight: 52 }}>
        <View style={{ height: 26 }} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10.5, color: colors.muted }}>Co-pilot</Text>
      </View>
      {tab('alerts', 'Alerts', 'bell', badgeCount > 0 ? (
        <View style={{ position: 'absolute', top: -3, right: -7, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: colors.neg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.monoSemi, fontSize: 9.5, color: '#fff' }}>{badgeCount}</Text>
        </View>
      ) : undefined)}
      <Pressable onPress={openMore} style={{ flex: 1, alignItems: 'center', gap: 4, paddingTop: 7, minHeight: 52 }}>
        <Icon name="layers" size={23} color={colors.muted} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10.5, color: colors.muted }}>More</Text>
      </Pressable>
      <Pressable onPress={openCopilot} accessibilityLabel="Ask the co-pilot"
        style={{ position: 'absolute', alignSelf: 'center', left: '50%', marginLeft: -30, bottom: 52, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 6, borderColor: colors.paper, shadowColor: colors.accent, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
        <Icon name="sparkle" size={26} color="#fff" />
      </Pressable>
    </View>
  )
}
```

`app/(tabs)/_layout.tsx`:
```tsx
import { Tabs } from 'expo-router'
import { Redirect } from 'expo-router'
import { TabBar } from '../../src/components/TabBar'
import { useAuth } from '../../src/stores/auth'

export default function TabsLayout() {
  const status = useAuth((s) => s.status)
  if (status === 'signedOut') return <Redirect href="/login" />
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tests" />
      <Tabs.Screen name="alerts" />
    </Tabs>
  )
}
```

Placeholders for the three tab screens: paper-background `View` + screen title in `type.h1` (replaced in Tasks 10/11/14).

- [ ] **Step 4: Sheet host + More sheet + toast host**

`src/components/SheetHost.tsx` — one `BottomSheetModal` driven by `useSheets` (dynamic content sizing via `enableDynamicSizing`; scrim `rgba(33,30,26,0.34)`; sheet background `colors.paper`, top radius `radius.sheet` (Android: 16); grab handle `#d4ccbc`):

```tsx
import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet'
import { useSheets } from '../stores/sheets'
import { colors, radius } from '../theme'
import { MoreSheet } from './sheets/MoreSheet'
// CopilotSheet (Task 15) and ShipSheet (Task 13) are added to CONTENT when built.

export function SheetHost() {
  const sheet = useSheets((s) => s.sheet)
  const close = useSheets((s) => s.close)
  const ref = useRef<BottomSheetModal>(null)

  useEffect(() => {
    if (sheet) ref.current?.present()
    else ref.current?.dismiss()
  }, [sheet])

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      onDismiss={close}
      backdropComponent={(p) => <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.34} />}
      backgroundStyle={{ backgroundColor: colors.paper, borderTopLeftRadius: Platform.OS === 'android' ? 16 : radius.sheet, borderTopRightRadius: Platform.OS === 'android' ? 16 : radius.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#d4ccbc', width: 38 }}
    >
      <BottomSheetView style={{ padding: 16, paddingBottom: 34 }}>
        {sheet?.kind === 'more' && <MoreSheet />}
      </BottomSheetView>
    </BottomSheetModal>
  )
}
```

`src/components/sheets/MoreSheet.tsx` — “Everything else” header + 2-column grid of the 16 items (design order): Learnings `flag`, Nudges `megaphone`, Flows `flow`, Audiences `users`, Analytics `bars`, Products `dollar`, Events `bolt`, Heatmaps `target`, Replays `play`, Tracking `link`, Funnel `trendUp`, Pages `layers`, Favorites `star`, Live `globe`, Team `users`, Settings `settings`. (Add `megaphone`, `flow`, `link`, `globe`, `settings` paths to the Icon table from the design's `P` object, lines 1253–1263.) In Phase 1 every item taps to `useToast.show('<Name> is coming to mobile — it lives on the desktop panel for now.')`. Item: 56px min-height card row, 32px `accentSoft` icon tile, `sansSemi 13.5` label.

`src/components/ToastHost.tsx`:
```tsx
import { Text, View } from 'react-native'
import { useToast } from '../stores/toast'
import { colors, fonts } from '../theme'
import { Icon } from './Icon'

export function ToastHost() {
  const message = useToast((s) => s.message)
  if (!message) return null
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 104, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.ink, borderRadius: 14, padding: 15, shadowColor: colors.ink, shadowOpacity: 0.6, shadowRadius: 17, shadowOffset: { width: 0, height: 14 }, elevation: 10 }}>
      <Icon name="check" size={18} color="#7be3a8" />
      <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13.5, color: colors.paper, lineHeight: 19 }}>{message}</Text>
    </View>
  )
}
```

Mount in `app/_layout.tsx` inside the providers: wrap the `<Stack/>` with `<BottomSheetModalProvider>` and render `<SheetHost />` + `<ToastHost />` after the Stack.

- [ ] **Step 5: Verify + commit**

`npm test` green, `npx tsc --noEmit` clean. On simulator: tab bar renders with FAB; More opens the sheet; every item shows the toast; Alerts tab switches.

```bash
git add -A && git commit -m "feat: tab shell with co-pilot FAB, sheet host, More sheet, toast"
```

---

### Task 10: Home screen

**Files:**
- Modify: `app/(tabs)/index.tsx` (replace placeholder)
- Create: `src/components/StatTile.tsx`, `src/components/TestRow.tsx`
- Test: `src/screens/__tests__/home.test.tsx`

**Interfaces:**
- Consumes: `fetchDashboard`, `fetchCampaigns`, `useAuth` (company name, user name), `useSheets.openCopilot`, `shipReady`, `verdictFor`, formatters, `Card`, `StatusPill`, `Skeleton`, `RetryCard`, `Icon`
- Produces: `<StatTile label value sub subColor? icon onPress?>`, `<TestRow campaign onPress>` (reused by Task 11)

- [ ] **Step 1: Build the screen**

`app/(tabs)/index.tsx` — structure (all values real, from the two queries):

```tsx
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchDashboard } from '../../src/api/dashboard'
import { fetchCampaigns } from '../../src/api/campaigns'
import { useAuth } from '../../src/stores/auth'
import { useSheets } from '../../src/stores/sheets'
import { shipReady, rollbackUntil } from '../../src/utils/testModel'
import { compact, pct, money, signedPct } from '../../src/utils/format'
import { Card } from '../../src/components/Card'
import { StatTile } from '../../src/components/StatTile'
import { TestRow } from '../../src/components/TestRow'
import { Skeleton } from '../../src/components/Skeleton'
import { RetryCard } from '../../src/components/RetryCard'
import { Icon } from '../../src/components/Icon'
import { colors, fonts, type } from '../../src/theme'

export default function Home() {
  const company = useAuth((s) => s.company)
  const user = useAuth((s) => s.user)
  const openCopilot = useSheets((s) => s.openCopilot)
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard })
  const camps = useQuery({ queryKey: ['campaigns'], queryFn: fetchCampaigns })
  const qc = useQueryClient()
  const refreshing = dash.isRefetching || camps.isRefetching

  const running = (camps.data ?? []).filter((c) => c.status === 'running')
  const ready = (camps.data ?? []).find(shipReady)
  const shippedToday = (camps.data ?? []).find(
    (c) => c.status === 'rollout' && c.rollout?.promotedAt &&
      new Date(c.rollout.promotedAt).toDateString() === new Date().toDateString()
  )
  const winners = (camps.data ?? []).filter((c) => c.status === 'rollout' || (c.status === 'completed' && c.rollout)).length

  const dateLine = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const firstName = user?.name?.split(' ')[0] ?? 'there'

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}>

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={type.kicker}>{dateLine}</Text>
          <Text style={[type.h2, { marginTop: 2 }]}>{company?.name ?? '—'}</Text>
        </View>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontFamily: fonts.sans, fontSize: 17 }}>{(user?.name ?? '?')[0]}</Text>
        </View>
      </View>

      {/* Co-pilot hero */}
      <Card style={{ borderRadius: 20, padding: 18, gap: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkle" size={17} color="#fff" />
          </View>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.ink }}>Testerify Co-pilot</Text>
        </View>
        <Text style={{ fontFamily: fonts.sans, fontSize: 27, lineHeight: 30, color: colors.ink }}>
          What should we test next, <Text style={{ fontStyle: 'italic', color: colors.accent }}>{firstName}</Text>?
        </Text>
        <Text style={[type.body, { marginTop: 8 }]}>
          {winners} winning test{winners === 1 ? '' : 's'} shipped so far. Describe a goal and I'll draft the test.
        </Text>
        <Pressable onPress={openCopilot} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 13, marginTop: 15, minHeight: 48 }}>
          <Icon name="sparkle" size={17} color={colors.accent} />
          <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.muted }}>Describe a goal…</Text>
          <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="send" size={16} color="#fff" />
          </View>
        </Pressable>
      </Card>

      {/* Ready-to-ship / shipped-today callout */}
      {ready && (
        <Pressable onPress={() => router.push(`/test/${ready.id}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.posSoft, borderWidth: 1, borderColor: colors.posBorder, borderRadius: 16, padding: 16, minHeight: 48 }}>
          <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="flag" size={20} color={colors.pos} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.title}>1 test is ready to ship</Text>
            <Text style={[type.small, { marginTop: 2, color: colors.secondary }]}>
              {ready.name} · {signedPct(ready.uplift)} · {pct(ready.confidence, 0)} confident
            </Text>
          </View>
          <Icon name="chevron" size={18} color={colors.muted} />
        </Pressable>
      )}
      {!ready && shippedToday && (
        <Pressable onPress={() => router.push(`/test/${shippedToday.id}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: 16, padding: 16 }}>
          <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={18} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.title}>{shippedToday.name} is live for everyone</Text>
            <Text style={[type.small, { marginTop: 2 }]}>
              Shipped today · rollback until {rollbackUntil(shippedToday.rollout!.promotedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <Icon name="chevron" size={18} color={colors.muted} />
        </Pressable>
      )}

      {/* Stat tiles */}
      {dash.isPending ? (
        <View style={{ flexDirection: 'row', gap: 11 }}><Skeleton height={96} /><Skeleton height={96} /></View>
      ) : dash.isError ? (
        <RetryCard onRetry={() => dash.refetch()} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
          <StatTile label="Visitors tested" value={compact(dash.data.stats.visitors)} sub="all time" icon="users" />
          <StatTile label="Active tests" value={String(dash.data.stats.activeCampaigns)} sub={`${running.length} running`} icon="beaker" />
          <StatTile label="Avg. conversion" value={pct(dash.data.stats.avgConversionRate)} sub="tested sessions" icon="target" />
          <StatTile label="Revenue tested" value={money(dash.data.stats.revenue, dash.data.currency.code)} sub={`${winners} winners shipped`} icon="dollar" />
        </View>
      )}

      {/* Running now */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.ink }}>Running now</Text>
        <Pressable onPress={() => router.push('/(tabs)/tests')}><Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.accent }}>All tests</Text></Pressable>
      </View>
      {camps.isPending ? (
        <View style={{ gap: 10 }}><Skeleton height={72} /><Skeleton height={72} /><Skeleton height={72} /></View>
      ) : camps.isError ? (
        <RetryCard onRetry={() => camps.refetch()} />
      ) : running.length === 0 ? (
        <EmptyState message="No tests running. Ask the co-pilot for an idea." />
      ) : (
        <View style={{ gap: 10 }}>
          {running.map((c) => <TestRow key={c.id} campaign={c} onPress={() => router.push(`/test/${c.id}`)} />)}
        </View>
      )}
    </ScrollView>
  )
}
```

Design deviation note (intentional): the design's stat-tile deltas ("+12.4%") have no backend source; the sub-lines above are honest equivalents. Do not fabricate deltas.

`src/components/StatTile.tsx`:
```tsx
import { Text, View } from 'react-native'
import { Icon, IconName } from './Icon'
import { colors, fonts } from '../theme'

export function StatTile({ label, value, sub, subColor = colors.muted, icon }: {
  label: string; value: string; sub: string; subColor?: string; icon: IconName
}) {
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 14, gap: 8, minHeight: 96 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.muted }}>{label}</Text>
        <Icon name={icon} size={15} color={colors.faint} />
      </View>
      <Text style={{ fontFamily: fonts.sans, fontSize: 30, lineHeight: 32, color: colors.ink }}>{value}</Text>
      <Text style={{ fontFamily: fonts.monoSemi, fontSize: 11.5, color: subColor }}>{sub}</Text>
    </View>
  )
}
```

`src/components/TestRow.tsx`:
```tsx
import { Pressable, Text, View } from 'react-native'
import type { CampaignListItem } from '../api/campaigns'
import { verdictFor } from '../utils/testModel'
import { compact, signedPct, daysBetween } from '../utils/format'
import { StatusPill } from './StatusPill'
import { colors, fonts } from '../theme'

export function TestRow({ campaign: c, onPress }: { campaign: CampaignListItem; onPress: () => void }) {
  const verdict = verdictFor(c)
  const rate = c.challenger?.rate ?? c.conversionRate
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 14, minHeight: 72 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.ink, lineHeight: 18 }}>{c.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 }}>
          <StatusPill label={verdict.label} tone={verdict.tone} />
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>
            {compact(c.visitors)} · {daysBetween(c.started)}d
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: fonts.monoSemi, fontSize: 16, color: colors.ink }}>{rate.toFixed(1)}%</Text>
        {c.uplift !== 0 && (
          <Text style={{ fontFamily: fonts.monoSemi, fontSize: 12, color: c.uplift > 0 ? colors.pos : colors.neg }}>
            {signedPct(c.uplift)}
          </Text>
        )}
      </View>
    </Pressable>
  )
}
```

(Import `EmptyState` in the screen. Also add `bell`, `megaphone`, `flow`, `link`, `globe`, `settings` icon paths to `Icon.tsx` if not already done in Task 9.)

- [ ] **Step 2: Screen test**

`src/screens/__tests__/home.test.tsx` — mock the api modules, render inside a `QueryClientProvider`:

```tsx
import { render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Home from '../../../app/(tabs)/index'
import * as dashboard from '../../api/dashboard'
import * as campaigns from '../../api/campaigns'
import { useAuth } from '../../stores/auth'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('../../api/dashboard')
jest.mock('../../api/campaigns')

const CAMPAIGN = {
  id: 't1', name: 'PDP: sticky add-to-cart on mobile', kind: 'ab', status: 'running',
  targetUrl: null, goals: null, rollout: null, learningNote: null, startsAt: null, endsAt: null,
  createdAt: '2026-07-16T00:00:00Z', updatedAt: '2026-07-25T00:00:00Z', started: '2026-07-16T00:00:00Z',
  variants: 2, visitors: 12500, conversions: 576, revenue: 24800, conversionRate: 4.6,
  control: null, challenger: { id: 'v2', name: 'Sticky bar', visitors: 6300, conversions: 309, impressions: 6300, revenue: 13300, rate: 4.9 },
  uplift: 14.2, confidence: 97, pValue: 0.03, sigStatus: 'winning', forecast: null, trend: [],
}

beforeEach(() => {
  useAuth.setState({ status: 'signedIn', user: { id: 'u', name: 'Alp S', email: 'a@b.c', role: 'admin' }, company: { id: 'c', name: 'Alder & Ash', slug: 'aa', websiteUrl: null } })
  ;(dashboard.fetchDashboard as jest.Mock).mockResolvedValue({
    currency: { code: 'USD', mixed: false },
    stats: { visitors: 48234, activeCampaigns: 4, avgConversionRate: 3.8, conversions: 1800, revenue: 41200 },
    visitorTraffic: [], campaignPerformance: [],
  })
  ;(campaigns.fetchCampaigns as jest.Mock).mockResolvedValue([CAMPAIGN])
})

const renderHome = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><Home /></QueryClientProvider>)
}

test('renders store name, stats, ship-ready callout, and running test', async () => {
  const { getByText } = renderHome()
  await waitFor(() => expect(getByText('Alder & Ash')).toBeTruthy())
  expect(getByText('48.2k')).toBeTruthy()
  expect(getByText('1 test is ready to ship')).toBeTruthy()
  expect(getByText('PDP: sticky add-to-cart on mobile')).toBeTruthy()
})

test('shows retry card when campaigns fail', async () => {
  ;(campaigns.fetchCampaigns as jest.Mock).mockRejectedValue(new Error('boom'))
  const { getAllByText } = renderHome()
  await waitFor(() => expect(getAllByText('Retry').length).toBeGreaterThan(0))
})
```

- [ ] **Step 3: Run tests** — `npx jest home` → PASS (adjust impl, not expectations, if a query state was mishandled). `npx tsc --noEmit` clean.

- [ ] **Step 4: Verify on device** — sign in with the test store; Home shows real numbers; pull-to-refresh works; hero button opens the (still content-less until Task 15) co-pilot sheet.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: home screen with dashboard stats, ship-ready callout, running tests"
```

---

### Task 11: Tests screen

**Files:**
- Modify: `app/(tabs)/tests.tsx` (replace placeholder)
- Create: `src/components/FilterChips.tsx`, `src/components/ConfidenceBar.tsx`, `src/components/TestCard.tsx`
- Test: `src/screens/__tests__/tests.test.tsx`

**Interfaces:**
- Consumes: `fetchCampaigns`, `useSheets.openCopilot`, `verdictFor`/`statusLabel`/`statusTone`/`statusPulse`/`confColor`, formatters
- Produces: `<FilterChips options={{key,label,count}[]} active onPick>`, `<ConfidenceBar confidence>` (6px track `colors.track`, fill `confColor(confidence)`, width `confidence%`), `<TestCard campaign onPress>`

- [ ] **Step 1: Build components + screen**

Filters (design): All / Running / Draft / Shipped, with counts. `shipped = status 'rollout' || 'completed'`. Chip: 40px min-height, radius 11, active = `accentSoft` bg + `accent` border/text, inactive = card bg + border + secondary text, mono count at 65% opacity.

`TestCard` (design): column card — name + goal line (`{compact(visitors)} visitors · started {Mon D}`; drafts: `Draft · not launched`), `StatusPill` (`statusLabel`/`statusTone`/`statusPulse`), then a row: `ConfidenceBar` (flex) + mono confidence (`confColor`) + mono rate `{(challenger?.rate ?? conversionRate).toFixed(1)}%`. Drafts render `—` for confidence and rate.

Screen: header row (`Tests` h1 + indigo `+ New` button → `openCopilot()`), horizontal chip scroll, filtered `TestCard` list, pull-to-refresh, Skeleton ×5 / RetryCard / EmptyState (`No tests match this filter.`) states. Tap card → `router.push('/test/[id]')`.

- [ ] **Step 2: Screen test** — same harness as Task 10: mock `fetchCampaigns` with 3 campaigns (running/draft/rollout); assert: all three render under All; after `fireEvent.press(getByText('Running'))` only the running one remains; counts render (`fireEvent` from `@testing-library/react-native`).

- [ ] **Step 3: Run tests + tsc** → PASS/clean.

- [ ] **Step 4: Verify on device** — filters flip instantly (no refetch), New opens co-pilot sheet.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: tests screen with filters and confidence cards"`

---

### Task 12: Test detail screen

**Files:**
- Create: `app/test/[id].tsx`, `src/components/VariantCard.tsx`
- Test: `src/screens/__tests__/detail.test.tsx`

**Interfaces:**
- Consumes: `fetchCampaign(id)`, `CampaignDetailData`, `DetailChart`, `StatusPill`, `Card`, formatters, `daysBetween`, `rollbackUntil`, `useSheets.openShip`
- Produces: route `/test/[id]`; `<VariantCard letter name blurb tag rate barWidth barColor highlight visitors conversions rpv>`; the Ship/Rollback floating bars (mutations wired in Task 13 — this task renders them with `onShip`/`onRollback` props passed from the screen, no-op until Task 13)

- [ ] **Step 1: Build the screen**

Layout (design order): back button (`arrowLeft` + "Tests", 44px target, `router.back()`), `StatusPill`, name (`h1`, 26px), subtitle (`{targetUrl path} · started {Mon D}`), then:

1. **Verdict card** — `accentSoft`-tinted Card (`borderColor: colors.accentBorder`, radius 18):
   - kicker: `rollout` → `SHIPPED · ROLLBACK AVAILABLE`, else `CO-PILOT VERDICT`
   - running + significance.status `winning`: `<challenger name> is winning by <signedPct(significance.uplift)>` + body `“{compact(stats.visitors)} visitors over {daysBetween(createdAt)} days, {pct(confidence,0)} confidence.”`
   - `losing`: “Control is ahead — {challenger name} is down {signedPct(uplift)}.”
   - `inconclusive`/`not_enough_data`: “Too early to call. {compact(stats.visitors)} visitors so far.”
   - `rollout`: `<winner name> is live for 100% of traffic` + “Shipped {Mon D} · rollback until {Mon D}” (from `rollout.promotedAt` + `rollbackUntil`).
2. **Variant cards** — from `campaign.variants`, control first (`isControl`): letter A/B…, name, rate = `stats.impressions > 0 ? conversions/impressions*100 : 0`, bar width = rate / max(rates) * 100, control bar `colors.faint`, others `colors.accent`; winner card gets `accentSoft` bg + accent key tile + tag `WINNER` (running-winning) or `LIVE · 100%` (rollout). Stats row: visitors `compact(stats.visitors)`, conversions `compact`, rev/visitor `money(revenue/max(visitors,1), revenueCurrency.code)`.
3. **Significance panel** — Card: title “Significance”, badge: significance.status `winning` → pos pill `Significant`, else neutral `Collecting`; 3-column grid: Confidence `pct(confidence,0)`, Uplift `signedPct(uplift)`, Days live `daysBetween(createdAt)`; toggle button (`Show daily conversion chart` / `Hide daily chart`, icons `bars`/`x`); expanded → legend (A control muted square, B accent square) + `<DetailChart labels={timeline.labels} seriesA={timeline.byVariant[controlId]} seriesB={timeline.byVariant[challengerId]} />`. Guard: if `controlId`/`challengerId` missing or series empty → `EmptyState message="Not enough daily data yet."`.
4. **Floating bars** (absolute, above the tab-bar area, gradient fade like the design): ship bar when list-level `shipReady` conditions hold (compute from detail: `status==='running' && significance?.status==='winning' && significance.confidence>=95 && significance.uplift>0`): indigo `Ship {challenger name}` button (flag icon) → `useSheets.openShip(id)`. Rollback bar when `status==='rollout'`: “Live for everyone / rollback until {date}” + bordered `Roll back` button → `onRollback` prop (wired Task 13). Add matching bottom padding to the ScrollView content (150) so the last card scrolls clear.

States: `isPending` → skeletons (header + 2 variant cards + panel); `isError` → RetryCard full-screen.

- [ ] **Step 2: Screen test** — mock `fetchCampaign` with a winning running campaign (2 variants, timeline with 3 labels): assert verdict headline contains “is winning by”, both variant names render, chart hidden initially, `fireEvent.press` on the toggle shows the legend text “A control”; a `rollout` fixture renders “Roll back”.

- [ ] **Step 3: Run tests + tsc** → PASS/clean.

- [ ] **Step 4: Device pass** — navigate from Tests; chart expands; back works from both Home and Tests entries.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: test detail with verdict, variants, significance, daily chart"`

---

### Task 13: Ship + rollback flow

**Files:**
- Create: `src/components/sheets/ShipSheet.tsx`
- Modify: `src/components/SheetHost.tsx` (render ShipSheet for `kind:'ship'`), `app/test/[id].tsx` (wire rollback mutation)
- Test: `src/screens/__tests__/ship.test.tsx`

**Interfaces:**
- Consumes: `promoteCampaign(id, variantId)`, `rollbackCampaign(id)`, `fetchCampaign`, `useSheets`, `useToast`
- Produces: the complete ship-a-winner loop.

- [ ] **Step 1: ShipSheet**

Content (design): grab handle (from SheetHost), headline `Ship <em>{challenger.name}</em> to 100% of traffic?` (italic accent name), body copy: “{challenger.name} becomes the only version every visitor sees. The test stops collecting and moves to Learnings — you can roll back for 30 days.”, facts card (3 rows): Winner → challenger name; Measured uplift → `signedPct(significance.uplift)` in pos; Confidence → `pct(confidence,0)`; primary `Ship it` button (check icon, 52px) and bordered `Keep testing` button (48px) → `close()`.

```tsx
// Core logic (queries the campaign it was opened for):
const { campaignId } = sheet   // from useSheets, kind 'ship'
const { data: campaign } = useQuery({ queryKey: ['campaign', campaignId], queryFn: () => fetchCampaign(campaignId) })
const challenger = campaign?.variants.find((v) => v.id === campaign.challengerId) ?? null
const promote = useMutation({
  mutationFn: () => promoteCampaign(campaignId, campaign!.challengerId!),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['campaign', campaignId] })
    qc.invalidateQueries({ queryKey: ['campaigns'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    close()
    toast.show(`${challenger?.name ?? 'The winner'} is live for everyone. Rollback stays available for 30 days.`)
  },
  onError: (e) => toast.show(e instanceof Error ? e.message : 'Could not ship. Try again.'),
})
```

`Ship it` disabled + “Shipping…” while `promote.isPending`. **Not optimistic** — per spec, the sheet waits for the server.

- [ ] **Step 2: Rollback wiring in `app/test/[id].tsx`**

```tsx
const rollback = useMutation({
  mutationFn: () => rollbackCampaign(id),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['campaign', id] })
    qc.invalidateQueries({ queryKey: ['campaigns'] })
    toast.show('Rolled back — the test is collecting again.')
  },
  onError: (e) => toast.show(e instanceof Error ? e.message : 'Could not roll back.'),
})
const confirmRollback = () =>
  Alert.alert('Roll back?', 'Every visitor returns to the A/B split and the test resumes collecting.', [
    { text: 'Keep it live', style: 'cancel' },
    { text: 'Roll back', style: 'destructive', onPress: () => rollback.mutate() },
  ])
```

**Behavior caveat to verify on the test store:** rollback is `PATCH { status: 'running' }` (the backend has no dedicated rollback action; PATCH allows every transition except *into* `rollout` — verified in `api/campaigns/[id].js`). Confirm on the test store that the pixel serves the A/B split again and the panel shows the test as running. If the lingering `rollout` record causes wrong UI anywhere, file a backend follow-up for Phase 2 (e.g. an explicit `action: 'rollback'` that clears it).

- [ ] **Step 3: Test** — render ShipSheet with mocked campaign + `promoteCampaign`; press `Ship it`; assert `promoteCampaign` called with `('t1','v2')`, toast message set, sheet closed. Error path: mock rejection with `new ApiError`-like message, assert toast shows it and sheet stays open.

- [ ] **Step 4: End-to-end on the test store** (the decisive check): pick/create a test-store campaign with a winning challenger → Ship it → toast → detail flips to “live for 100%” + rollback bar → Tests list shows `Shipped` → panel (desktop web) agrees → Roll back → test running again in both app and panel. Record what you observed in the task notes.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: ship-winner sheet and rollback flow"`

---

### Task 14: Alerts — derivation (TDD) + screen + badge

**Files:**
- Create: `src/utils/alerts.ts`, `src/stores/alertsRead.ts`
- Modify: `app/(tabs)/alerts.tsx` (replace placeholder), `app/(tabs)/_layout.tsx` + `src/components/TabBar.tsx` (badge)
- Test: `src/utils/__tests__/alerts.test.ts`

**Interfaces (produced):**
```ts
export type AlertItem = {
  id: string                       // `${kind}:${campaignId}`
  kind: 'ship_ready' | 'shipped' | 'concluded'
  campaignId: string
  title: string
  body: string
  at: string                       // ISO — ship_ready uses campaign.updatedAt, shipped uses rollout.promotedAt, concluded uses endsAt ?? updatedAt
  tone: 'pos' | 'accent' | 'neutral'
}
export type AlertGroup = { label: 'Today' | 'This week' | 'Earlier'; items: AlertItem[] }
export function deriveAlerts(campaigns: CampaignListItem[], now?: Date): AlertGroup[]
```
- `useAlertsRead`: `{ readIds: string[]; markAllRead(ids: string[]): void }` (in-memory for Phase 1 — persistence is a Phase 2 nicety; note this deviation from the design's implied persistence)
- Badge = unread count of Today+This week items, passed from `app/(tabs)/_layout.tsx` (which runs the campaigns query via TanStack — cache-shared with Home/Tests) into `TabBar badgeCount`.

- [ ] **Step 1: Failing derivation tests**

```ts
import { deriveAlerts } from '../alerts'
const NOW = new Date('2026-07-25T12:00:00Z')
// three fixtures: winning-running (updatedAt today), rollout (promotedAt 3 days ago), completed (endsAt 20 days ago)

test('winning running test → ship_ready in Today', () => { /* group 'Today', title contains 'reached', tone 'pos' */ })
test('recent rollout → shipped in This week', () => { /* body contains 'live for everyone' or uplift */ })
test('old concluded test → Earlier, capped at 14 days → excluded', () => { /* 20d-old concluded is NOT present */ })
test('sorted newest-first within groups; empty input → []', () => {})
```

Concrete assertions (write them fully in the test file):
- ship_ready: `title === '<name> reached <pct(confidence,0)> confidence'`, `body === '<challenger.name ?? "The challenger"> is up <signedPct(uplift)>. Review and ship it.'`
- shipped: `title === '<name> shipped to 100%'`, `body === 'Rolled out <relTime(promotedAt, now)> · rollback until <Mon D>'`
- concluded: only when `status === 'completed'` and the anchor date is within 14 days: `title === '<name> concluded'`, `body === 'No winner — the result is archived in Learnings.'` when `!rollout`, else `'Won <signedPct(rollout.uplift ?? 0)> — archived in Learnings.'`
- Groups: Today = same calendar day as `now`; This week = within 7 days; Earlier = within 14; older items dropped. Groups with no items are omitted.

- [ ] **Step 2: Run to verify failure**, **Step 3: implement `deriveAlerts` + `useAlertsRead`** (pure functions; `markAllRead` unions ids), **Step 4: run to verify pass**.

- [ ] **Step 5: Screen + badge**

Screen: header (`Alerts` h1 + `Mark all read` accent text-button → `markAllRead(allIds)`), groups with mono kicker labels, alert rows as design (34px icon tile: `flag`/pos for ship_ready, `check`/accent for shipped, `mail`/neutral for concluded; title, body, mono `relTime(at)`), unread rows tinted `posSoft`/plain per tone, tap → `router.push('/test/[campaignId]')`. Empty: `EmptyState message="Nothing needs you right now."` Layout state: uses the shared `['campaigns']` query — same Skeleton/RetryCard pattern as Home.

Badge: in `app/(tabs)/_layout.tsx`, run the campaigns query, `deriveAlerts`, unread = groups Today+This week minus `readIds`; pass count into `TabBar`.

- [ ] **Step 6: Verify + commit** — `npm test`, `tsc`, device pass (badge shows, mark-all clears).

```bash
git add -A && git commit -m "feat: alerts derived from campaign state, alerts screen, tab badge"
```

---

### Task 15: Co-pilot sheet

**Files:**
- Create: `src/components/sheets/CopilotSheet.tsx`, `src/utils/copilot.ts`
- Modify: `src/components/SheetHost.tsx` (render for `kind:'copilot'`)
- Test: `src/utils/__tests__/copilot.test.ts`

**Interfaces:**
- Consumes: `fetchSuggestions`, `generateSuggestions`, `generateTestDraft`, `AiIdea`, `useToast`, `useSheets.close`
- Produces:
```ts
// copilot.ts
export function ideaTag(idea: AiIdea): string        // page ?? 'Store', Title Case, + metric when present: 'Product · Add to cart'
export function impactColor(impact: AiIdea['impact']): string  // high→pos, medium→warn, low→muted
export function draftRequestFor(idea: AiIdea): { name: string; goal: string; path?: string | null }
  // name: idea.title (≤60 chars — backend clips anyway), goal: idea.hypothesis, path: idea.path
```

- [ ] **Step 1: TDD the helpers** (`copilot.test.ts`: tag for `{page:'product', metric:'add_to_cart'}` → `'Product · Add to cart'`; `{page:null}` → `'Store'`; impact colors; draftRequestFor passes title/hypothesis/path through and omits null path). Run fail → implement → pass.

- [ ] **Step 2: Build the sheet**

States driven by two mutations/queries:
- On open: `useQuery({ queryKey: ['suggestions'], queryFn: fetchSuggestions })` → saved ideas under header `Suggested for your store` (or the design's empty prompt if none).
- Prompt row: TextInput (`Describe a goal — e.g. increase add-to-cart rate`) + indigo send button → `generate.mutate(goal)`; goal chips (horizontal scroll, design copy: `Increase add-to-cart rate`, `Reduce mobile checkout drop-off`, `Raise average order value`, `Improve email signup`) → same mutation with the chip text.
- `generate = useMutation({ mutationFn: generateSuggestions })`: while pending, header status `thinking…` + 3 Skeleton idea cards (this call scans the store + calls the AI — allow ~30-60 s; do not add a client timeout); on success ideas replace the list, header `Generated ideas`; on error show the server message inline in the sheet (`ApiError` message covers the 503 not-configured and 429/rate-limit cases).
- Idea card (design): tag chip (`ideaTag`, accent on accentSoft), `{impact} impact` mono in `impactColor`, semibold title, hypothesis body, buttons: primary `Build draft` (sparkle icon) → `build.mutate(draftRequestFor(idea))`; on success `close()` + `toast.show('Draft created — find it under Tests. Edit variants on the desktop panel.')` + invalidate `['campaigns']`; secondary bordered `+` button is omitted in Phase 1 (favorites are Phase 2 — intentional deviation).

Sheet header: sparkle avatar, `Co-pilot`, mono status (`online` / `thinking…` / `ready`).

- [ ] **Step 3: Tests run + tsc** → PASS/clean.

- [ ] **Step 4: Device pass against the test store** — generate with a chip (real AI round-trip), build a draft, confirm the draft appears in Tests with status Draft and in the desktop panel.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: co-pilot sheet with AI suggestions and draft creation"`

---

### Task 16: Polish — Android pass, offline banner, README, release checklist

**Files:**
- Create: `src/components/OfflineBanner.tsx`, `README.md`
- Modify: `app/_layout.tsx` (mount banner), any Android-specific style fixes found

**Interfaces:** none new beyond `<OfflineBanner/>`.

- [ ] **Step 1: Offline banner**

```tsx
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { colors, fonts } from '../theme'

export function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  useEffect(() => NetInfo.addEventListener((s) => setOffline(!(s.isConnected && s.isInternetReachable !== false))), [])
  if (!offline) return null
  return (
    <View style={{ backgroundColor: colors.warn, paddingVertical: 6, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: '#fff' }}>Offline — showing cached data</Text>
    </View>
  )
}
```

Mount above the Stack in `app/_layout.tsx` (inside a SafeArea-aware wrapper).

- [ ] **Step 2: Android visual pass** (per the design's Android note): run on an Android emulator; verify sheet corners are 16 (already platform-switched in Task 9), elevation shadows look right, tab bar bottom padding fits without an iOS home indicator, FAB ring color matches paper. Fix what's off; keep fixes `Platform.select`-scoped.

- [ ] **Step 3: README**

Cover: what the app is (one paragraph + pointer to the spec), prerequisites, `.env` setup from `.env.example`, `npm install && npx expo start`, test-account note (**never dev against a real store**), `npm test`, the Task 1 backend dependency, and the Phase 2/3 roadmap pointer.

- [ ] **Step 4: Full manual regression (test store)** — checklist:
login (wrong + right password) → Home numbers match panel → pull-to-refresh → Tests filters → detail chart expand → ship flow end-to-end → rollback → alerts + badge + mark-all-read → co-pilot generate + build draft → More sheet toasts → kill app, relaunch (session restores without login) → airplane mode (banner + cached screens + graceful retry).

- [ ] **Step 5: Final commit**

```bash
git add -A && git commit -m "chore: offline banner, android polish, README, phase-1 regression pass"
```

---

## Plan Self-Review (performed at write time)

1. **Spec coverage (Phase 0+1):** foundation (Tasks 2–9), Home (10), Tests (11), detail + chart (12, 8), ship/rollback (13), alerts (14), co-pilot (15), More shell (9), auth + backend addition (1, 5, 6), error handling + env (5, 10–15, 16), testing (throughout), Android adaptation (9, 16). Phase 2/3 screens intentionally deferred to their own plans, per spec phasing.
2. **Placeholders:** none — every step carries code, exact copy, or a concrete checklist; deliberate deviations from the design (stat-tile deltas, alert-read persistence, favorites `+` button) are called out inline as deviations, not TBDs.
3. **Type consistency:** `TokenPair {access, refresh}` (Tasks 5–6); `CampaignListItem`/`CampaignDetailData`/`Significance`/`SigStatus` (Tasks 7, 10–14); `PillTone` from StatusPill (3) used by testModel (7); `SheetState` union (9) consumed in 13/15; `AiIdea` (7) consumed in 15; `badgeCount` prop introduced in 9, wired in 14.
