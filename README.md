# Testerify Mobile

Testerify Mobile is the phone companion to the [Testerify](https://panel.testerify.com) A/B-testing / CRO panel for Shopify storefronts. It covers the part of the panel "you can't do at your desk": watching running tests, getting alerted, asking the AI co-pilot for a new test idea, and shipping a winner. Heavy authoring (heatmap overlay, flow canvas, variant editor) stays on desktop.

Built with Expo (React Native + TypeScript, strict), Expo Router, TanStack Query, Zustand, and `@gorhom/bottom-sheet`.

Full product/architecture spec: [`docs/superpowers/specs/2026-07-25-testerify-mobile-design.md`](docs/superpowers/specs/2026-07-25-testerify-mobile-design.md). Phase 0+1 implementation plan (this build): [`docs/superpowers/plans/2026-07-25-testerify-mobile-phase-1.md`](docs/superpowers/plans/2026-07-25-testerify-mobile-phase-1.md).

## Prerequisites

- Node.js LTS and npm.
- [Expo Go](https://expo.dev/go) on a physical device, or an iOS Simulator / Android emulator, to run the app.
- A running, **deployed** copy of the [Testerify backend](https://panel.testerify.com) — see **Backend dependency** below. Without it, login will not work.
- Credentials for the dedicated **test company/store account** (ask the backend owner — never your own real store; see **Test store only**).

## Backend dependency (must be deployed first)

This app authenticates with `POST /api/auth/login` / `POST /api/auth/refresh` and expects the JWT pair back in the JSON body (`tokens: { accessToken, refreshToken }`), not just as httpOnly cookies. That's an **opt-in, backward-compatible addition** to the Testerify panel backend (`login.js` sends `tokens` when the request includes `includeTokens: true`; `refresh.js` accepts a `refreshToken` in the body and returns a rotated pair the same way when it does).

- The panel repo lives at `/Users/alpsenel/Desktop/personal-projects/Testerify`, deployed at `https://panel.testerify.com`.
- If that commit isn't deployed, sign-in fails with `Backend did not return tokens — is Task 1 deployed?` (see `src/stores/auth.ts`) — that message is the tell.
- Confirm it's live before debugging anything else in this app:

  ```bash
  curl -s -X POST https://panel.testerify.com/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"<TEST_EMAIL>","password":"<TEST_PASSWORD>","includeTokens":true}' | jq 'has("tokens")'
  # expect: true
  ```

## Setup

```bash
cp .env.example .env
npm install
npx expo start
```

`.env` holds `EXPO_PUBLIC_API_URL` (Expo inlines `EXPO_PUBLIC_*` vars at build time). It defaults to `https://panel.testerify.com` in code (`src/api/config.ts`) if unset, so `.env` is only required when pointing at something else (e.g. a local/staging backend):

```
EXPO_PUBLIC_API_URL=https://panel.testerify.com
```

From the Expo CLI output, open the app in a development build, an Android emulator, an iOS Simulator, or Expo Go.

Platform-specific dev shortcuts (from `package.json`):

```bash
npm run android   # expo start --android
npm run ios        # expo start --ios
npm run web         # expo start --web
```

## Test store only

**Never sign in to this app with a real store's credentials, and never exercise the ship/rollback flow against a real store.** Development and all manual testing use a dedicated **test company/store account** — ask whoever owns the backend for its credentials. Shipping/rolling back a variant is a real, non-optimistic mutation against the panel backend; there's no demo-data mode.

## Testing

```bash
npm test    # jest (jest-expo preset + @testing-library/react-native)
npm run lint # expo lint
```

Coverage: API client (Bearer injection, 401 → refresh → retry, refresh-failure logout), formatters, alert-derivation logic, and component/screen tests for every Phase 1 screen and sheet (loading/error/empty/data states, filters, ship confirm flow against a mocked API, co-pilot sheet states, the offline banner).

## Manual regression (run on device)

Automated tests don't touch a real device, a real network toggle, or the real backend end-to-end. Before calling a Phase 1 build (or any change to auth, navigation, or a sheet) done, run this checklist by hand against the test store, on both an iOS simulator/device and an Android emulator/device.

**Setup:** test-store credentials, airplane mode toggle available, app freshly installed (or storage cleared) for the "relaunch restores session" step.

1. **Login**
   - Wrong password → inline error shown, stays on login, no crash.
   - Correct test-store credentials → lands on Home.
2. **Home**
   - Date/store header, 4 stat tiles, Running now list. Cross-check the numbers against the desktop panel for the same test-store account — they should match.
   - Pull-to-refresh → refresh indicator shows, data reloads without a flash of the empty/error state.
   - Co-pilot hero card and (if present) the ready-to-ship / shipped-today callout render correctly.
3. **Tests tab**
   - Filter chips (All / Running / Draft / Shipped) each show the right subset; switching filters doesn't lose scroll position unexpectedly.
   - Each card's confidence bar and stat line look correct for a running test you can cross-check on desktop.
4. **Test detail**
   - Open from both Home and Tests — back returns to the tab you came from (not always Home).
   - Verdict card, variant A/B cards, significance panel are present and correct.
   - Daily chart: tap/expand to its detailed state and back; check it doesn't clip or overflow on a smaller device.
5. **Ship flow (test store only)**
   - From a ship-ready test: floating ship bar → confirm sheet → confirm → toast → screen flips to shipped state. Confirm the sheet actually waits for the server response before flipping (not optimistic).
   - **Rollback** the just-shipped test → confirm the pixel/panel shows the test running again and the mobile UI reflects it (dashboard numbers included — this is a known invalidation edge case, verify it doesn't show stale "shipped" data).
6. **Alerts**
   - Badge count on the tab matches the number of unread alert rows.
   - Mark-all-read clears the badge and the unread styling; re-open the tab and confirm it stays cleared (in-memory only — this resets on app restart by design, see spec deviations).
7. **Co-pilot**
   - Open via the raised center FAB. Pick a goal chip, generate ideas.
   - Build draft on a generated idea → toast confirms, and the new draft appears under the Tests tab (Draft filter).
8. **More sheet**
   - Open via the tab bar "More" button. Tap a few of the 13 still-unbuilt secondary-screen entries → each shows its "coming to mobile" toast rather than crashing or navigating nowhere.
   - Tap "Live" → navigates to the real Live screen (see step 11) instead of a toast.
   - Tap "Learnings" → navigates to the real Learnings screen (see step 12) instead of a toast.
   - Tap "Analytics" → navigates to the real Analytics screen (see step 13) instead of a toast.
9. **Session persistence**
   - Kill the app fully (swipe away / force-stop) and relaunch → should land signed-in on Home without hitting the login screen again (session restores from `expo-secure-store`).
10. **Offline handling**
    - Enable airplane mode mid-session → the offline banner appears at the top, below the status bar/notch, without clipping into it.
    - Previously-loaded screens still show their last-fetched (cached) data rather than going blank.
    - Try pull-to-refresh or a mutation (e.g. ship) while offline → fails gracefully with a toast/retry affordance, no crash.
    - Disable airplane mode → banner disappears, next refresh succeeds.
11. **Live screen**
    - Open via More sheet → "Live" → back button returns to Home (not the tab you came from — Live is only reachable from the More sheet).
    - On-site-now count and the by-location rows match the desktop panel's Live page for the same test-store account. Note: the design's "63 in a test · 41 on a product page" split and per-visitor session rows are intentionally not rendered — no backend field backs either (see spec deviations); the location aggregate stands in for both.
    - Leave the screen open ~15–20s → the count/location rows refresh in place (polls every 15s) without a visible flash of loading/empty state.
    - Pull-to-refresh works independently of the poll.
12. **Learnings screen**
    - Open via More sheet → "Learnings" → back returns to Home.
    - Only concluded tests appear (shipped or completed) — nothing still running or in draft. Cross-check the list and each card's outcome badge, meta grid (runs on / visitors tested / started / concluded) and note against the desktop panel's Learnings page for the same test-store account.
    - Filter chips (All / Won / No winner) and the search field (matches name *and* note) narrow the list; searching for nonsense shows "No learnings match."
    - **Note editing (test store only):** tap a note → inline editor opens → edit → Save. The row shows the saved text after the server responds; reopen the screen (or pull-to-refresh) and confirm it persisted. Cancel discards. Save while offline → error toast, editor stays open with your text intact.

13. **Analytics screen**
    - Open via More sheet → "Analytics" → back returns to Home.
    - Every figure is derived from the campaigns list, so cross-check against the desktop panel: tests run (excludes drafts), winners shipped + win rate, average winning uplift, and revenue measured on shipped winners. Note the revenue tile is *revenue on winning tests*, not incremental lift — the list endpoint reports no incremental figure.
    - Win-rate ring matches the "% win rate" tile; its legend counts add up to tests run.
    - Uplift leaderboard: bars scale to the largest absolute uplift, losses render in red with a "−" sign.
    - Testing velocity: 8 week columns, oldest left, labelled by UTC week start; totals match the tests you started in those weeks.

Log anything off-script (visual glitch, crash, wrong number) against the screen/step above rather than as a vague "something looked wrong."

## Android notes

Phase 1 was built and unit-tested on this machine without an Android emulator; the pass below is a **static code audit**, not an on-device run — treat the checklist above as the real Android gate.

What was checked (`grep`-verified across `src/`):
- **Sheet corners** (`src/components/SheetHost.tsx`): `16` on Android vs `24` (`radius.sheet`) on iOS — already `Platform.OS`-branched.
- **Tab bar bottom padding** (`src/components/TabBar.tsx`): `30` on iOS (clears the home indicator) vs `14` on Android — already branched, no fix needed.
- **Shadow/elevation pairs**: every view using `shadowColor`/`shadowOpacity`/`shadowOffset` (`Card.tsx`, `ToastHost.tsx`, the FAB in `TabBar.tsx`) also sets a matching `elevation`, so Android gets a visible shadow instead of a flat edge. No missing pairs found.
- **FAB ring color** (`TabBar.tsx`): the co-pilot FAB's `borderColor` is `colors.paper`, matching the screen background on both platforms.
- **`Platform.OS`/`Platform.select` inventory**: `login.tsx` (keyboard-avoiding behavior), `TestDetail.tsx` (floating ship/rollback bar bottom padding), `SheetHost.tsx`, `TabBar.tsx` — all already platform-scoped, nothing found using an iOS-only value unconditionally where Android needed a different one.

Nothing was changed as a result of this audit — every Android note from the design was already correctly handled by earlier tasks. What genuinely needs a real device (can't be verified by reading code): actual shadow/elevation appearance, bottom-sheet keyboard behavior over `TextInput` (co-pilot prompt), gesture-nav vs 3-button nav bar clearance, and the offline banner's status-bar clearance on real notch/punch-hole hardware — all covered by the manual regression checklist above.

## Roadmap

This build covers the Phase 0 (foundation) + Phase 1 (core loop) scope from the spec: auth, Home, Tests, Test detail, ship/rollback, Alerts, Co-pilot, and the More sheet shell.

- **Phase 2** (read-mostly screens — Live, Analytics, Funnel, Learnings, Favorites, Tracking, Products, Pages, Events, Heatmaps, Replays) and **Phase 3** (management screens — Flows, Nudges, Audiences, Team, Settings) are intentionally deferred; see [`docs/superpowers/specs/2026-07-25-testerify-mobile-design.md`](docs/superpowers/specs/2026-07-25-testerify-mobile-design.md) (sections "Phase 2" / "Phase 3") for scope and endpoint mapping. Each phase gets its own implementation plan before work starts — the Phase 0+1 plan this build followed is [`docs/superpowers/plans/2026-07-25-testerify-mobile-phase-1.md`](docs/superpowers/plans/2026-07-25-testerify-mobile-phase-1.md).
