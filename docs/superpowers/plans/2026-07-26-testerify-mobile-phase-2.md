# Testerify Mobile — Phase 2 Implementation Plan (read-mostly screens)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 11 read-mostly secondary screens from the More sheet — Live, Learnings, Analytics, Funnel, Heatmaps, Tracking, Products, Pages, Events, Replays, Favorites — wired to real backend data, plus the Phase-2 kickoff hygiene the Phase-1 final review gated on.

**Architecture:** unchanged from Phase 1 — screen bodies in `src/screens/`, thin route wrappers, TanStack Query per endpoint, theme tokens, shared components. Secondary screens are stack routes at `src/app/screens/<name>.tsx`, opened from the More sheet (each screen task replaces its own "coming soon" toast with navigation).

**Tech Stack:** as Phase 1, plus ONE sanctioned new dependency: `@react-native-async-storage/async-storage` (favorites + alerts-read persistence).

**References (authoritative, in-repo/ledger):**
- Spec: `docs/superpowers/specs/2026-07-25-testerify-mobile-design.md`
- **API shapes doc (field names are LAW):** `.superpowers/sdd/phase2-api-shapes.md` — every screen task names its section; implementers transcribe types from it, never invent fields.
- **Design source:** `docs/design/Testerify-Mobile.dc.html` — screen blocks: onLive ~270-292, onLearnings ~294-338, onAnalytics ~340-402, onFunnel ~404-447, onHeatmaps ~449-488, onFavorites ~520-561, onTracking ~563-607, onProducts ~609-650, onReplays ~652-696, onPages ~834-921, onEvents ~923-995; data/renderVals ~1615-2010; ring() ~1341-1352.

## Global Constraints

- Everything from the Phase 1 plan's Global Constraints carries over (repo paths, `EXPO_PUBLIC_API_URL`, test-store-only, design tokens, TS strict, full-suite + tsc green before every commit, commit via `.superpowers/sdd/commit.sh "<msg>"` while this session's stale hook lives).
- **No new dependencies** beyond `@react-native-async-storage/async-storage` (installed in Task 3).
- **No fabricated data**: where the design renders a value the endpoint does not provide, use the honest-substitute rule (real fields only, deviation noted in the task report). Known sanctioned deviations: Live's "in a test · on a product page" split and per-visitor "Latest sessions" feed (no backend source — build from real aggregates only; a backend endpoint is a user-decision item, not this plan's scope); Products' "leaky" badge per shapes doc gap note; Favorites is on-device only (no server store exists — confirmed).
- Screens render the established states everywhere: Skeleton (pending), RetryCard (error), EmptyState (no data), pull-to-refresh.
- Every screen task ALSO: adds its route to `src/app/screens/`, switches its MoreSheet item from toast to `router.push`, and appends its screen to the README regression checklist.
- Plan-gated endpoints: any endpoint the shapes doc marks as plan-gated (402 `PLAN_LIMIT_REACHED`) must render a friendly upgrade EmptyState, not a RetryCard loop.

---

### Task 1: Kickoff hygiene (final-review gate)

**Files:** `jest.setup.js`, `package.json` (@types/jest align), `src/theme/index.ts` (+`white` token), ~10 files with raw `#fff`, `src/components/OfflineBanner.tsx` (safe-area insets), `src/components/TabBar.tsx` (FAB `accessibilityRole="button"`).

- [ ] Kill the Jest worker-exit warning at the ROOT: configure fake timers in `jest.setup.js` (`jest.useFakeTimers()` global is too blunt — prefer guarding `Animated.loop` start behind an env check in `Skeleton`/`StatusPill`: `const isTestEnv = process.env.NODE_ENV === 'test'`; skip loop start when true) — then verify `npx jest` exits cleanly WITHOUT `--forceExit` and remove any `--forceExit` from docs/reports going forward.
- [ ] Align `@types/jest` to the jest 29 line (`^29.5.14`), verify tsc + suite.
- [ ] Add `colors.white: '#fff'` to theme; sweep all raw `'#fff'` literals in `src/` to it.
- [ ] OfflineBanner: replace static paddingTop with `useSafeAreaInsets()` (expo-router provides `SafeAreaProvider` at runtime; mock `react-native-safe-area-context` in `jest.setup.js` with its official mock).
- [ ] Commit: `chore: phase-2 kickoff — clean jest exit, safe-area banner, white token, types align`

### Task 2: Phase-2 API modules (typed from the shapes doc)

**Files:** Create `src/api/stats.ts` (live, funnel, heatmap, utm + utm-detail, products + product-detail, page-behavior, custom-events, replays fetchers) and extend `src/api/ai.ts` (insights, per shapes doc §Pages) — every type transcribed from `.superpowers/sdd/phase2-api-shapes.md`. Thin fetchers only; `unknown` for opaque fields.
**Interfaces:** exported fetchers named `fetchLive`, `fetchFunnel`, `fetchHeatmap`, `fetchUtm`, `fetchUtmDetail`, `fetchProducts`, `fetchProductDetail`, `fetchPageBehavior`, `fetchCustomEvents`, `fetchReplays`, `fetchInsights` with query-param args exactly as the shapes doc specifies (e.g. `days`).
- [ ] TDD any non-trivial param serialization; type-check is the main gate; commit: `feat: typed phase-2 stats api modules`

### Task 3: Shared pieces — WinRateRing, SegmentedControl, SearchField, persisted stores

**Files:** `src/components/charts/WinRateRing.tsx` (port design `ring()` ~1341-1352, props `{value: number; color?: string; size?: number}`), `src/components/SegmentedControl.tsx` (design's 2px-padded track toggle: track `colors.track` + border, active segment card-bg + shadow, min-height 38), `src/components/SearchField.tsx` (design's 44px search row: card bg, border, search icon, TextInput), `src/stores/favorites.ts` (AsyncStorage-persisted: `{pinnedIds: string[]; savedIdeas: AiIdea[]; togglePin(id); saveIdea(idea); removeIdea(title)}`), upgrade `src/stores/alertsRead.ts` to AsyncStorage persistence (closes the Phase-1 deviation).
- [ ] `npx expo install @react-native-async-storage/async-storage`; mock in jest.setup.js (official mock).
- [ ] TDD the stores (persistence round-trip via the mock); render tests for the three components; commit: `feat: shared phase-2 components and persisted favorites/alerts-read stores`

### Tasks 4–14: Screens (one task each, uniform pattern)

Each task: screen body `src/screens/<Name>.tsx`, route `src/app/screens/<name>.tsx`, MoreSheet wiring, screen test in `src/screens/__tests__/`, README checklist row, commit `feat: <name> screen`. Layout from the design block (line ranges above); data from the shapes-doc section; states + pull-to-refresh mandatory; formatters/theme everywhere. Per-screen notes:

- [ ] **Task 4 — Live** (`fetchLive`): big on-site-now number (design's 64px accent), plus whatever real aggregate the endpoint provides (locations). SANCTIONED CUTS: no "63 in a test · 41 on a product page" line, no per-visitor session rows (no backend source; see Global Constraints). Poll with `refetchInterval: 15000` — the one screen where liveness matters.
- [ ] **Task 5 — Learnings** (campaigns list, client-filtered per shapes doc): concluded campaigns (status completed/rollout per shapes doc), search (SearchField, name+note), filter chips All/Won/No winner with counts, outcome badges from rollout, meta grid, note card; NOTE EDITING: tapping the note opens inline edit → `PATCH /api/campaigns/[id] {learningNote}` mutation (invalidate campaigns; toast on error). Empty search → 'No learnings match.'
- [ ] **Task 6 — Analytics** (campaigns-derived per shapes doc + WinRateRing): stat tiles (tests run, winners shipped w/ win rate, avg winning uplift, revenue impact — compute per shapes doc), AI-styled summary line built from REAL fields only, win-rate ring section, uplift leaderboard (bars relative to max, negative → colors.neg), velocity bar chart (tests started per week, last 8 weeks from createdAt).
- [ ] **Task 7 — Funnel** (`fetchFunnel`): stat tiles, step list with reach bars + drop percentages per design; biggest-drop tile computed from steps.
- [ ] **Task 8 — Heatmaps** (`fetchHeatmap`): 2 stat tiles, pages ranking with device split, share pill, clicks, frustration chip (only if the shapes doc's fields support it — else honest substitute), hidden-pages footnote if the endpoint reports it. Overlay stays desktop (design says so).
- [ ] **Task 9 — Tracking** (`fetchUtm`/`fetchUtmDetail`): stat tiles, SegmentedControl for source/medium/campaign dimension, breakdown rows with share bars. Summary line from real fields only.
- [ ] **Task 10 — Products** (`fetchProducts`): stat tiles, SearchField, product cards with 4-cell metric grid; leaky badge ONLY if computable from real fields per shapes doc gap note (else omit, note deviation).
- [ ] **Task 11 — Pages** (`fetchPageBehavior` + `fetchInsights`): stat tiles, by-page-type bars (tap-to-filter local state), top-paths table, mini funnel strip, AI behavior insight section (Analyze button → `fetchInsights` mutation-style call; idle/done states per design; NO client timeout).
- [ ] **Task 12 — Events** (`fetchCustomEvents`): SearchField, expandable event rows (chevron rotate, overview grid, where-it-fired bars, recent samples with chips) per design onEvents block.
- [ ] **Task 13 — Replays** (`fetchReplays`): 3 KPI tiles, SegmentedControl trigger filter (All/Rage/Dead clicks), session rows with trigger chips + play affordance (tapping shows toast 'Replays play on the desktop panel.' — sanctioned: no mobile player), brief-sessions footnote if endpoint supports.
- [ ] **Task 14 — Favorites** (favorites store + campaigns): pinned tests as rich cards (status pill, name, goal, Sparkline from `trend`, 3-stat row) — pin/unpin via star toggle ALSO added to TestDetail header (small TestDetail edit); saved AI ideas list with Build button (reuse draftRequestFor/generateTestDraft) + save affordance added to CopilotSheet idea cards (the Phase-1-omitted '+' button, now backed by the store).

### Task 15: More-sheet completion sweep + regression update

- [ ] Verify all 16 More items: 11 navigate (Tasks 4-14), 5 still toast with updated copy '… arrives in Phase 3.' (Flows, Nudges, Audiences, Team, Settings).
- [ ] README: consolidated Phase-2 regression rows; note Live polling and plan-gate behavior.
- [ ] Full suite + tsc + `npx expo export --platform ios` sanity; commit: `chore: phase-2 wrap — more-sheet routes, regression checklist`

---

## Self-Review (at write time)

1. **Spec coverage:** all 11 Phase-2 screens tasked; kickoff gates from the final review are Task 1; the two Phase-1 deviations this phase closes (alerts-read persistence, co-pilot save/favorites) are in Tasks 3/14. Phase 3 (Flows/Nudges/Audiences/Team/Settings) explicitly out.
2. **Placeholders:** field-level detail intentionally lives in the shapes doc (single source, transcription-verified there) — tasks name their sections; no TBDs.
3. **Type consistency:** fetcher names fixed here; component prop contracts stated where later tasks consume them (WinRateRing, SegmentedControl, SearchField, favorites store).
