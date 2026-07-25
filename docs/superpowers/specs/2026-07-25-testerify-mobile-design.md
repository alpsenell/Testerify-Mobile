# Testerify Mobile — Design Spec

**Date:** 2026-07-25
**Status:** Approved (sections A–D approved in brainstorming session)
**Source design:** claude.ai design project `21895d9f-2333-4430-9619-db6bc02e771d`, file `Testerify Mobile.dc.html` (with `ios-frame.jsx`, `support.js`)
**Backend:** existing Testerify panel repo at `/Users/alpsenel/Desktop/personal-projects/Testerify`, deployed at `https://panel.testerify.com`

## 1. What we're building

A phone companion app for Testerify — the A/B-testing / CRO panel for Shopify storefronts. The design's framing: "the part of the panel you can't do at your desk: watching tests and shipping winners." The app covers monitoring, alerting, the AI co-pilot, and the ship-a-winner flow; heavy authoring (heatmap overlay, flow canvas, variant editor) stays on desktop.

### Decisions made during brainstorming

| Question | Decision |
|---|---|
| Data story | Wire to the real backend now (no demo-data build) |
| Backend | Already exists — the Testerify Vercel app (`api/` serverless functions, Neon Postgres, Drizzle) |
| Platforms | iOS + Android from one codebase |
| Scope | Full design (~20 screens), phased delivery |
| Dev environment | Production (`panel.testerify.com`) with a dedicated test company/store account |
| Framework | Expo (React Native + TypeScript) |

## 2. Architecture

- **Framework:** Expo (managed workflow), TypeScript, Expo Router.
- **Navigation:**
  - Custom bottom tab bar matching the design: Home · Tests · [Co-pilot FAB, raised center] · Alerts · More.
  - "More" is a button, not a route — it opens the More bottom sheet listing the 16 secondary screens; those push onto the root stack.
  - Test detail pushes from Home/Tests. Back returns to the originating tab.
  - Sheets: More, Co-pilot, Ship-confirm — `@gorhom/bottom-sheet`. Success toast is a lightweight timed overlay.
- **Theme module** (`src/theme`): tokens lifted verbatim from the design —
  - Colors: paper `#f4f1ea`, card `#fcfbf7`, border `#e7e0d3`, ink `#211e1a`, secondary `#5d564b`, muted `#968d7e`, faint `#b3aa99`, accent `#5b54e0`, positive `#2f8f5b`, negative `#c2553c`, warn `#b9842a`.
  - Type: Instrument Sans (400/500/600/700) + IBM Plex Mono (400/500/600) via `@expo-google-fonts`.
  - Radii 11–20px, card shadow, and the `tf-pulse` / `tf-fade` / `tf-slide` / `tf-sheet` motion patterns (Reanimated).
- **Component library** (`src/components`): Card, StatTile, StatusPill, ConfidenceBar, FilterChips, SegmentedControl, SearchField, Toggle, ListRow, Sheet, Toast, Skeleton, EmptyState, SectionHeader — plus `react-native-svg` ports of the prototype's `detailChart`, `spark` (sparkline), and `ring` (win-rate ring), and the stroke-icon set from the design's `P` path table.
- **Platform adaptation (Android),** per the design's note: same layout; no glass blur; squarer sheet corners; ship confirmation rendered as a full-width dialog instead of a bottom sheet.
- **State:**
  - Server state: TanStack Query.
  - Session state: small Zustand store (user, company, stores, tokens) backed by `expo-secure-store`.
- **Directory sketch:**
  ```
  app/                    # Expo Router routes
    (tabs)/index.tsx      # Home
    (tabs)/tests.tsx
    (tabs)/alerts.tsx
    test/[id].tsx         # Test detail
    screens/…             # 16 secondary screens
    login.tsx
  src/
    api/                  # client, endpoint modules, types
    components/
    theme/
    stores/
    utils/                # formatters, significance display helpers
  ```

## 3. Screens & phased delivery

### Phase 0 — Foundation
Scaffold, theme, fonts, component library, API client with auth, login screen, session persistence, tab shell with center FAB.

The login screen is not in the design canvas; it is designed by convention from the same tokens (paper background, card, Instrument Sans headline, indigo primary button).

### Phase 1 — Core loop (first usable build)
| Screen / flow | Backend |
|---|---|
| Home (date/store header, co-pilot hero, ready-to-ship / shipped callout, 4 stat tiles, Running now list) | `GET /api/stats/dashboard`, `GET /api/campaigns` |
| Tests (filter chips All/Running/Draft/Shipped, confidence-bar cards) | `GET /api/campaigns` |
| Test detail (status, verdict card, variant A/B cards, significance panel, collapsible daily chart) | `GET /api/campaigns/[id]` (totals, daily series, significance) |
| Ship flow (floating bar → confirm sheet → toast → shipped state + rollback bar) | campaign update/rollout action on `api/campaigns/[id]` (exact action verified at implementation; rollout logic exists in `api/_lib/rollout.js`) |
| Alerts tab | Derived client-side from campaign state (significance reached, drift, recently shipped). A dedicated feed endpoint is a later backend addition. |
| Co-pilot sheet (goal chips, prompt, generated ideas, Build draft) | `POST /api/ai/generate-test`, `GET /api/ai/suggestions` |
| More sheet shell | — |

### Phase 2 — Read-mostly screens
Live (`stats/live`), Analytics (`stats/impact`, `stats/dashboard`), Funnel (`stats/funnel`), Learnings (concluded campaigns / learnings data), Favorites (pinned tests + saved ideas), Tracking (`stats/utm`, `stats/utm-detail`), Products (`stats/products`, `stats/product-detail`), Pages / Shopper behavior (`stats/page-behavior`, `stats/paths`), Events (`stats/custom-events`), Heatmaps (`stats/heatmap` — ranking + frustration list only; the overlay stays on desktop), Replays (replay listing endpoint).

Per-screen field mapping is verified against the endpoint's actual response shape when each screen is implemented.

### Phase 3 — Management screens
Flows (`api/flows`), Nudges (`api/nudges`), Audiences (`api/audiences`), Team (`api/company/members`, `api/company/invitations`, alert settings), Settings (`api/company` — data-collection toggle, purchase tracking status, account rows, logout).

### Known backend additions (in the Testerify repo — each confirmed with the user before changing that repo)
1. **Tokens in JSON for mobile:** login/refresh currently deliver JWTs only as httpOnly cookies; refresh reads the refresh token only from cookies. Add an opt-in (e.g. request flag or header) for token-in-body responses so a Bearer client can authenticate cleanly. Backward compatible with the panel.
2. **Alerts feed endpoint (optional, later):** per-campaign `alerts` dedup markers already exist in the schema; an `/api/alerts` feed can be derived server-side to replace the client-derived Phase 1 version.
3. **Favorites persistence (if the panel has none):** pinning tests / saving co-pilot ideas may need a small storage endpoint; fall back to on-device storage until then.

## 4. Data flow, auth & error handling

- **Auth flow:** email/password → `POST /api/auth/login` → access + refresh tokens stored in `expo-secure-store` → `Authorization: Bearer <access>` on every request (accepted by middleware "door 3", added during Phase 1 — the pre-existing Bearer branch only verified Shopify session tokens) → on 401, one `POST /api/auth/refresh` and retry → hard logout if refresh fails. Multi-store accounts use `POST /api/auth/switch-store`.
- **Queries:** TanStack Query; pull-to-refresh on every screen; stale-while-revalidate. Polling only where live-ness matters (Live screen, detail of a running test).
- **Mutations:** ship, rollback, toggles, invites, settings — invalidate affected queries on success. Shipping is **not optimistic**: the confirm sheet waits for the server, then shows the toast and flipped state. Cheap toggles (alert settings, flow pause) are optimistic with rollback on error.
- **Errors:** Skeleton loaders (pulse) while fetching; inline retry card on query failure; toast on mutation failure; offline banner via NetInfo.
- **Environment:** base URL `https://panel.testerify.com`, overridable via env (`EXPO_PUBLIC_API_URL`) for future local dev. Development uses a dedicated test company/store account so dev-time writes never touch a real store.

## 5. Testing

- **Unit (Jest):** API client — Bearer injection, 401 → refresh → retry, refresh-failure logout; formatters (percent, currency, relative time); alert-derivation logic.
- **Component (React Native Testing Library):** Tests list rendering states (loading/error/empty/data), filter chips, ship confirm flow against a mocked API, co-pilot sheet states.
- **Manual:** on-device via Expo throughout; each phase ends with a hands-on pass of its screens against the test store.
- **Later:** EAS builds for TestFlight / Play internal testing.

## 6. Out of scope

- Building or redesigning backend features beyond the three small additions listed above.
- Push notifications (the design's Alerts tab is in-app; push is a possible follow-up).
- The desktop-only surfaces: heatmap click overlay, flow canvas, variant editor.
- Shopify OAuth/billing surfaces (mobile app signs in with Testerify credentials only).
- Offline-first data (cache-and-refresh only).
