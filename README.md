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

Coverage: API client (Bearer injection, 401 → refresh → retry, refresh-failure logout), formatters, alert-derivation logic, the persisted favorites/alerts-read stores, and every derivation module behind a Phase 2 screen (learnings, analytics, funnel, heatmap, tracking, products, pages, events, plan gating). Component/screen tests cover every screen and sheet in the app: loading/error/empty/data states, filters and search, the ship confirm flow against a mocked API, co-pilot sheet states, inline learning-note editing, plan-gated vs ordinary failures, the offline banner, the Phase-3 permission matrix (what an admin, a manager and a member each see), optimistic pause/resume with rollback, and every destructive confirm asserted through a mocked `Alert.alert`.

## Manual regression (run on device)

Automated tests don't touch a real device, a real network toggle, or the real backend end-to-end. Before calling a build done — and after any change to auth, navigation, a sheet, or a screen's data source — run this checklist by hand against the test store, on both an iOS simulator/device and an Android emulator/device. Steps 1–10 are the core loop; steps 11–25 are the secondary screens and share the preamble in front of step 11.

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
8. **More sheet** — all 16 entries, no exceptions
   - Open via the tab bar "More" button.
   - **15 navigate** to a real screen: Live, Learnings, Analytics, Funnel, Heatmaps, Tracking, Products, Pages, Events, Replays, Favorites, Flows, Nudges, Team, Settings (steps 11–25 below).
   - **1 toasts**: Audiences → "Saved audiences live on the desktop panel." Saved audiences have no backing entity in the panel, so there is nothing to show; no crash, no navigation to nowhere.
9. **Session persistence**
   - Kill the app fully (swipe away / force-stop) and relaunch → should land signed-in on Home without hitting the login screen again (session restores from `expo-secure-store`).
10. **Offline handling**
    - Enable airplane mode mid-session → the offline banner appears at the top, below the status bar/notch, without clipping into it.
    - Previously-loaded screens still show their last-fetched (cached) data rather than going blank.
    - Try pull-to-refresh or a mutation (e.g. ship) while offline → fails gracefully with a toast/retry affordance, no crash.
    - Disable airplane mode → banner disappears, next refresh succeeds.
### Steps 11–25: secondary screens

All fifteen are reached from the More sheet only, so **back always returns to Home**, not to the tab you came from. Check these on every one of them before the per-screen rows:

- Loading shows skeletons (not a blank screen), a failed load shows the retry card and **Retry actually recovers**, and a genuinely empty window shows its own message rather than zeros.
- Pull-to-refresh works and doesn't flash the empty/error state.
- Screens with a window use a **fixed last 7 days, UTC, today inclusive** (Funnel, Tracking, Products, Pages) — cross-check against the same window on desktop, not against "last 7 days" in your local timezone.
- **Live is the only polling screen** (15s); everything else refreshes on focus/pull only.
- **Plan-gated features must show an upgrade note, never a retry loop** — Pages' AI insight (Growth+) and Replays (Scale). Verify on a store whose plan excludes them; on an entitled store, verify the real content renders instead.
- **Steps 22–25 write to the backend.** Every destructive action confirms first, and cancelling must change nothing. Reversible toggles (flow and nudge pause/resume) move instantly and roll back on failure; everything else waits for the server before the UI moves. Run these against the test store only.
- **Roles change what renders.** Team and Settings hide controls the signed-in role can't use, so check them with both an admin and a non-admin account.

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

14. **Funnel screen**
    - Open via More sheet → "Funnel" → back returns to Home. Window is a fixed last-7-days (UTC, today inclusive) — cross-check the step visitor counts and percentages against the desktop panel's Funnel page for the same window.
    - Steps your pixel doesn't track render as "—" with the endpoint's hint, never as 0.
    - The "Biggest drop" tile names the same step that shows the largest −% in the list.

15. **Heatmaps screen**
    - Open via More sheet → "Heatmaps" → back returns to Home. Page ranking, device split, click share and frustration chips should match the desktop panel's Heatmaps list. The click overlay itself is desktop-only by design — there is no overlay here.
    - The "N pages hidden for having fewer than M clicks" footnote only appears when the endpoint reports hidden pages.

16. **Tracking screen**
    - Open via More sheet → "Tracking" → back returns to Home. Last-7-days UTM window; cross-check tagged visits, unique visitors, top source and the breakdown against the desktop panel's Tracking page.
    - Source / Medium / Campaign toggle refetches and swaps the rows; the tiles stay on the window totals.
    - The summary line only claims what the endpoint reports — with no previous period it drops the trend clause instead of showing a change.

17. **Products screen**
    - Open via More sheet → "Products" → back returns to Home. Last-7-days window; cross-check views, add rate, units and revenue against the desktop panel's Products page.
    - Search matches product title and handle; no match → "No products match."
    - **"High traffic · low conversion" is derived on-device, not a backend flag** — it marks products with at-or-above-average views that convert below the store's own rate. Sanity-check a flagged product against its numbers; nothing is flagged when the store has no measurable conversion rate.
    - A window spanning several currencies drops the currency symbol and says "mixed currencies" rather than picking one.

18. **Pages screen (Shopper behavior)**
    - Open via More sheet → "Pages" → back returns to Home. Last-7-days window; cross-check views, visitors and the by-page-type rows against the desktop panel's behavior page. "Avg time on page" is a views-weighted average across page types — the endpoint reports no site-wide average — so expect it to sit between the per-type figures.
    - Tap a page-type row → the Top pages table refetches scoped to that type and a "<type> · Clear" affordance appears; tapping the row again (or Clear) restores the unscoped table. Tiles stay on the whole window by design.
    - **AI behavior insight:** starts idle. Tap Analyze → it waits as long as the server needs (no client timeout) → summary plus severity-dotted items. On a Free/Growth-gated store it must show the upgrade note, **not** a retry card; any other failure shows Retry and retrying must work.

19. **Events screen**
    - Open via More sheet → "Events" → back returns to Home. Rows list every custom event with its fire count, visitors, reach and last-fired time — cross-check against the desktop panel's Events page.
    - Tap a row → chevron rotates, breakdown expands (overview grid, per-campaign and site-wide bars, recent samples with device/country/campaign chips and the raw payload). Tap again to collapse. An event with no campaign or sample data says so rather than rendering empty bars.
    - Search matches the event name; no match → "No events match."

20. **Replays screen**
    - Open via More sheet → "Replays" → back returns to Home. KPI tiles (sessions, interactions, average length) and recent sessions with entry path, device/pages/events meta, trigger chip, duration and age — cross-check against the desktop panel's Replays page.
    - All / Rage / Dead clicks refetches through the endpoint's own trigger filter.
    - **There is no mobile player by design** — the play button toasts "Replays play on the desktop panel."
    - On a Free/Growth store (replay is Scale-tier) the screen must show the upgrade note, **not** a retry card.

21. **Favorites screen (on-device only)**
    - Open a test detail → tap the header star → it fills. Open More sheet → "Favorites" → the test appears as a rich card (status pill, name, target, sparkline, conv. rate / uplift / confidence). Tap the card → opens that test. Unpin from the detail header → it leaves Favorites.
    - Open the co-pilot → generate ideas → tap the "+" beside an idea's Build draft button → toast confirms and the button flips to its saved state. The idea appears under Favorites → "Saved AI ideas"; Build there creates a draft (check the Tests tab, Draft filter) and Remove deletes it.
    - **Pins and saved ideas are stored on the device (AsyncStorage), not on the server** — they survive an app restart but do not appear in the desktop panel or on another device. Kill and relaunch the app to confirm both persist.
    - A pinned test that no longer exists on the backend silently drops out of the list.

22. **Flows screen (test store only)**
    - Open via More sheet → "Flows" → back returns to Home. Cards show name, status, step count and the linked test — cross-check against the desktop panel's Flows page. There is deliberately **no "New" button**: building a flow is the desktop canvas.
    - **Pause an active flow** → the pill flips to Paused instantly (optimistic). Confirm on desktop that the flow really stopped. Resume and re-check.
    - **Pause while offline** (airplane mode) → the pill flips, then rolls back to Active with an error toast. This is the rollback path; verify it doesn't leave a lying pill.
    - **Delete a flow** → native confirm first; cancelling must not delete. Confirming removes the row and it stays gone after pull-to-refresh.

23. **Nudges screen (test store only)**
    - Open via More sheet → "Nudges" → back returns to Home. Only nudges appear — an A/B test must not show up here. Cross-check each card's visitors, conversion rate, uplift-vs-holdout and confidence against the same campaign on desktop (the holdout is the campaign's control variant).
    - **Pause a running nudge** → pill flips instantly; confirm on the storefront that the widget stops appearing. Resume and re-check.
    - Pause while offline → pill rolls back with an error toast.
    - Draft or concluded nudges show no pause/resume control at all.

24. **Team screen (test store only)** — needs **two accounts** to check properly
    - Signed in as an **admin**: invite form, pending invites and members all render. Cross-check the roster and roles against the desktop panel's Team page.
    - Signed in as a **member**: no invite form, no pending-invites section, no remove or role controls anywhere. Signed in as a **manager**: invite form and remove, but no role controls and no Admin option in the role picker.
    - Nobody sees remove/role controls on their **own** row, at any role.
    - **Create an invite** → the link appears once, below the button. Share it (share sheet opens), then confirm the colleague can actually accept it. Navigating away loses the link by design.
    - **New link** on a pending invite → confirm dialog warns the old link stops working; after confirming, verify the *old* link is dead and the new one works.
    - **Revoke** → confirm, then the invite disappears and its link no longer works.
    - **Remove a member / change a role** → confirm first; verify the change on desktop. Do this only with a disposable test-store account.

25. **Settings screen (test store only)**
    - Open via More sheet → "Settings" → back returns to Home. Data-collection state, workspace, plan, your role and email match the desktop panel. There is deliberately **no purchase-tracking card** — no field backs it.
    - **As an admin, pause data collection** → confirm dialog spells out the consequence → the state flips to Paused only after the server answers. Verify on the storefront that new page views stop arriving within a minute, then resume (no confirm on the way back on) and verify collection restarts. Do this on the test store only.
    - As a **member**, the state text renders but there is no switch at all.
    - **Log out** → confirm → lands on the login screen. Relaunching the app must not restore the session (this is the one flow that clears `expo-secure-store`).

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

This build covers every phase of the spec: Phase 0 (foundation) + Phase 1 (core loop) — auth, Home, Tests, Test detail, ship/rollback, Alerts, Co-pilot, the More sheet — **Phase 2**, the eleven read-mostly secondary screens (Live, Learnings, Analytics, Funnel, Heatmaps, Tracking, Products, Pages, Events, Replays, Favorites), and **Phase 3**, the management screens (Flows, Nudges, Team, Settings) with the app's first logout. Phase 2 closed two Phase-1 deviations: alerts-read state and favorites now persist on device (AsyncStorage), and the co-pilot's idea cards have their save affordance.

- **Audiences is the one More-sheet item without a screen.** It isn't deferred work — the panel has no saved-audience entity at all (no table, no endpoint, no page); `audience` is an inline object on a campaign. Building it is a product decision for the desktop panel first — see the [Phase 3 design](docs/superpowers/specs/2026-08-05-testerify-mobile-phase-3-design.md) for the evidence. Each phase got its own implementation plan before work started: [Phase 0+1](docs/superpowers/plans/2026-07-25-testerify-mobile-phase-1.md), [Phase 2](docs/superpowers/plans/2026-07-26-testerify-mobile-phase-2.md), [Phase 3](docs/superpowers/plans/2026-08-05-testerify-mobile-phase-3.md).

### Deviations (deliberate, verify rather than "fix")

Where the design shows a value no endpoint provides, the screen renders a real substitute instead of inventing one:

- **Live** — no "in a test · on a product page" split and no per-visitor session feed (no backend source); the location aggregate stands in.
- **Analytics** — the revenue tile is revenue measured *on* shipped winners, not incremental lift; the list endpoint reports no incremental figure.
- **Products** — "High traffic · low conversion" is derived on device (at-or-above-average views, conversion below the store's own rate), not a backend flag.
- **Pages** — "Avg time on page" is a views-weighted average across page types; the endpoint reports no site-wide average.
- **Replays** — no mobile player; the play button says replays open on the desktop panel.
- **Favorites** — pins and saved ideas are device-local (AsyncStorage); no server-side favorites store exists.
- **Heatmaps** — the click overlay stays on desktop, per the design.
- **Audiences** — cut entirely; no backing entity exists in the panel.
- **Settings** — no purchase-tracking card; nothing in the panel records whether an order has been seen end-to-end.
- **Flows** — no "New" button; building a flow is the desktop canvas.
- **Team** — "Get link" is "New link": invite links are one-time, so producing one again means regenerating, which invalidates the link already sent.
