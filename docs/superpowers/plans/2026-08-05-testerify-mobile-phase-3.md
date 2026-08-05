# Testerify Mobile — Phase 3 Implementation Plan (management screens)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The four management screens — Flows, Nudges, Team, Settings — wired to real backend data, closing the More sheet.

**Architecture:** Unchanged from Phases 1–2. Screen bodies in `src/screens/`, thin route wrappers in `src/app/screens/`, TanStack Query per endpoint, `useMutation` per write, theme tokens, shared components. This is the first write-heavy phase: reversible toggles are optimistic with rollback, destructive actions wait for the server behind an `Alert.alert` confirm.

**Tech Stack:** As Phases 1–2. **No new dependencies** — the invite link uses React Native's built-in `Share`, not `expo-clipboard`.

**References:**
- Spec (authoritative, field shapes included): `docs/superpowers/specs/2026-08-05-testerify-mobile-phase-3-design.md`
- Design source: `docs/design/Testerify-Mobile.dc.html` — onFlows ~490-517, onNudges ~698-750, onTeam ~997-1050, onSettings ~779-833
- Panel repo (endpoint truth): `~/Desktop/PersonalProjects/Testerify/api/{flows,company}`

## Global Constraints

- Everything from the Phase 1 and Phase 2 Global Constraints carries over: repo paths, `EXPO_PUBLIC_API_URL`, **test-store only**, design tokens (`src/theme`), TS strict, full suite + `tsc --noEmit` green before every commit.
- **No new dependencies.**
- **No fabricated data.** Where the design shows a value no endpoint provides, cut it and record the deviation in the task report. Already-sanctioned cuts: the Settings purchase-tracking card, the Flows "New" button, the Audiences screen.
- Every screen renders skeleton (pending), `RetryCard` (error), `EmptyState` (no data), and pull-to-refresh.
- **Permission rule:** controls the signed-in user's role cannot use are **not rendered** (`useAuth().user.role`; `member(1) < manager(2) < admin(3)`). The server stays the authority — a 403 surfaces as an error toast.
- **Mutation rule:** flow and nudge pause/resume are optimistic with rollback on error. Everything else (delete, remove, revoke, regenerate, data-collection) waits for the server, behind an `Alert.alert` confirm with a `destructive` action.
- New screen tests follow the Phase-2 teardown: drain react-query's notification batch inside `act()` before `cleanup()` (see `src/screens/__tests__/learnings.test.tsx`), and swap `useToast`'s `show` for a spy in any test that toasts.
- Commit per task with the message given in the task.

---

### Task 1: Phase-3 API modules

**Files:**
- Create: `src/api/flows.ts`, `src/api/company.ts`
- Test: `src/api/__tests__/company.test.ts`

**Interfaces produced:**
```ts
// src/api/flows.ts
export type FlowStatus = 'active' | 'paused'
export type Flow = {
  id: string; name: string; status: FlowStatus; steps: unknown[]
  campaignId: string | null; campaignName: string | null
  createdAt: string; updatedAt: string
}
export const fetchFlows: () => Promise<Flow[]>
export const updateFlowStatus: (id: string, status: FlowStatus) => Promise<unknown>
export const deleteFlow: (id: string) => Promise<unknown>

// src/api/company.ts
export type Role = 'member' | 'manager' | 'admin'
export type Company = { /* full shape per spec §2 */ dataCollectionEnabled: boolean }
export type Member = { id: string; name: string; email: string; role: Role; createdAt: string; lastLoginAt: string | null }
export type Invitation = { id: string; email: string; role: Role; status: string; expiresAt: string; createdAt: string; invitedByName: string | null }
export const fetchCompany: () => Promise<Company>
export const setDataCollection: (enabled: boolean) => Promise<Company>
export const fetchMembers: () => Promise<Member[]>
export const updateMemberRole: (id: string, role: Role) => Promise<unknown>
export const removeMember: (id: string) => Promise<unknown>
export const fetchInvitations: () => Promise<Invitation[]>
export const createInvitation: (email: string, role: Role) => Promise<{ invitation: Invitation; link: string }>
export const regenerateInvitation: (id: string) => Promise<{ invitation: Invitation; link: string }>
export const revokeInvitation: (id: string) => Promise<unknown>
```

- [ ] **Step 1:** Write `src/api/__tests__/company.test.ts` asserting each fetcher hits the right path and method with the right body, using a mocked `apiFetch` (mirror `src/api/__tests__/stats.test.ts`'s style). Assert `setDataCollection(false)` sends `PATCH /api/company` with `{"dataCollectionEnabled":false}`, and `createInvitation('a@b.co','manager')` sends `POST /api/company/invitations` with `{"email":"a@b.co","role":"manager"}`.
- [ ] **Step 2:** Run `npx jest src/api/__tests__/company.test.ts` — expect failure (module missing).
- [ ] **Step 3:** Write both modules, transcribing types from spec §2. Fetchers are thin: unwrap the documented envelope (`{ flows }`, `{ company }`, `{ members }`, `{ invitations }`) and return the payload; `unknown` for opaque fields (`steps`, `notifications`, `pageTypeConfig`).
- [ ] **Step 4:** Run the test + `npx tsc --noEmit`. Both green.
- [ ] **Step 5:** Commit: `feat: typed phase-3 flows and company api modules`

### Task 2: Shared pieces — role helpers, Toggle, confirm

**Files:**
- Create: `src/utils/roles.ts`, `src/components/Toggle.tsx`, `src/utils/confirm.ts`
- Test: `src/utils/__tests__/roles.test.ts`, `src/components/__tests__/Toggle.test.tsx`

**Interfaces produced:**
```ts
// src/utils/roles.ts — mirrors api/_lib/roles.js; the client copy of one rule
export const ROLES: Role[]                                  // ['member','manager','admin']
export const rankOf: (role: string | undefined | null) => number   // unknown → 0
export const hasAtLeast: (role: string | undefined | null, min: Role) => boolean
export const roleLabel: (role: Role) => string              // 'Member' | 'Manager' | 'Admin'

// src/components/Toggle.tsx — the design's 52×32 switch (dc.html ~797-799)
export function Toggle(props: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean; accessibilityLabel: string }): JSX.Element

// src/utils/confirm.ts — one wrapper so every destructive confirm reads the same
export function confirmDestructive(opts: { title: string; message: string; confirmLabel: string; cancelLabel?: string; onConfirm: () => void }): void
```

- [ ] **Step 1:** Write `roles.test.ts`: `rankOf('admin') === 3`; `rankOf('nonsense') === 0`; `rankOf(null) === 0`; `hasAtLeast('manager','member') === true`; `hasAtLeast('member','admin') === false`; `hasAtLeast(undefined,'member') === false`; `roleLabel('manager') === 'Manager'`.
- [ ] **Step 2:** Run it — expect failure. Then implement `src/utils/roles.ts` and re-run to green.
- [ ] **Step 3:** Write `Toggle.test.tsx`: renders with its `accessibilityLabel`, `fireEvent.press` calls `onValueChange` with the negated value, and a `disabled` toggle does **not** call it. Implement `Toggle` (track `colors.pos` when on / `colors.border` when off, 26px white knob, `accessibilityRole="switch"`, `accessibilityState={{ checked: value, disabled }}`, min 44px touch target). Run to green.
- [ ] **Step 4:** Implement `confirm.ts` wrapping `Alert.alert(title, message, [{ text: cancelLabel ?? 'Cancel', style: 'cancel' }, { text: confirmLabel, style: 'destructive', onPress: onConfirm }])`. No test of its own — screen tests assert it through a mocked `Alert.alert`.
- [ ] **Step 5:** Run the full suite + `tsc`. Commit: `feat: role helpers, toggle switch and shared destructive confirm`

### Task 3: Flows screen

**Files:**
- Create: `src/screens/Flows.tsx`, `src/app/screens/flows.tsx`, `src/screens/__tests__/flows.test.tsx`
- Modify: `src/components/sheets/MoreSheet.tsx` (add `Flows: '/screens/flows'`), `src/components/sheets/__tests__/MoreSheet.test.tsx` (move `'Flows'` from `LABELS` to `ROUTED`), `README.md` (regression row)

Layout from dc.html ~490-517: kicker `Automation`, h1 `Flows`, blurb "Trigger an A/B test when a visitor follows a journey.", **no New button**. Card per flow: flow glyph + name, status pill (`active` → `pos` tone with pulse, `paused` → `neutral`), a mono line reading `` `${steps.length} step${s}` `` (the raw step objects belong to the builder — do not attempt to decode them), a footer row with the linked campaign (`campaignName ?? 'No campaign linked'`) and two 36px actions: pause/resume (`pause`/`play` icon) and delete (`trash`).

- [ ] **Step 1:** Write `flows.test.tsx` covering: renders both flows with name, status and step count; pause calls `updateFlowStatus('f1','paused')` and flips the pill **before the server responds** (optimistic — resolve the mock via a deferred promise and assert the pill first); a rejected pause rolls the pill back and toasts; delete opens the confirm (mock `Alert.alert`, invoke its destructive button) and only then calls `deleteFlow`; empty state; retry card; back → `router.back()`.
- [ ] **Step 2:** Run it — expect failure (screen missing).
- [ ] **Step 3:** Implement `Flows.tsx`. Optimistic pause/resume via `onMutate` (cancel `['flows']`, snapshot, `setQueryData`), `onError` restoring the snapshot plus a toast, `onSettled` invalidating. Delete goes through `confirmDestructive({ title: 'Delete this flow?', message: 'The flow stops running immediately and can\'t be restored from mobile.', confirmLabel: 'Delete' })` and waits for the server.
- [ ] **Step 4:** Add the route wrapper, wire MoreSheet + its test, add the README row. Run full suite + `tsc`.
- [ ] **Step 5:** Commit: `feat: flows screen`

### Task 4: Nudges screen

**Files:**
- Create: `src/screens/Nudges.tsx`, `src/app/screens/nudges.tsx`, `src/screens/__tests__/nudges.test.tsx`
- Modify: `MoreSheet.tsx` + its test (`Nudges: '/screens/nudges'`), `README.md`

Layout from dc.html ~698-750: kicker `Widget library`, h1 `Nudges`, blurb "Every nudge runs against a holdout that proves it pays for itself.", section heading "Your nudges". Data: `fetchCampaigns()` filtered to `kind === 'nudge'` (add `src/utils/nudges.ts` with `onlyNudges(campaigns)` and unit-test it alongside). Card: name, `targetUrl ?? 'Any page'`, status pill via the existing `statusLabel`/`statusTone`/`statusPulse`, and a 2×2 stat grid — Visitors `compact(visitors)`, Conv. rate `pct(conversionRate)`, Uplift `signedPct(uplift)` (coloured `colors.neg` when negative), Confidence `pct(confidence, 0)`. Pause/resume only; **no delete**.

- [ ] **Step 1:** Write `src/utils/__tests__/nudges.test.ts` (`onlyNudges` keeps `kind: 'nudge'`, drops `'ab'`/`'offer'`/`'personalization'`) and `nudges.test.tsx` (renders a nudge's four stats; an A/B campaign in the same payload is not listed; pause is optimistic and rolls back on failure; empty state "No nudges yet."; retry; back).
- [ ] **Step 2:** Run both — expect failure.
- [ ] **Step 3:** Implement `onlyNudges`, then `Nudges.tsx`. Pause/resume reuses `PATCH /api/campaigns/[id]` — add `setCampaignStatus(id, status)` to `src/api/campaigns.ts` next to `rollbackCampaign` (which is the same call with `status: 'running'`; leave `rollbackCampaign` alone so Phase-1 tests keep passing). Invalidate `['campaigns']` and `['dashboard']` on settle.
- [ ] **Step 4:** Route wrapper, MoreSheet wiring + test, README row. Full suite + `tsc`.
- [ ] **Step 5:** Commit: `feat: nudges screen`

### Task 5: Team screen

**Files:**
- Create: `src/screens/Team.tsx`, `src/app/screens/team.tsx`, `src/screens/__tests__/team.test.tsx`
- Modify: `MoreSheet.tsx` + its test, `README.md`

Layout from dc.html ~997-1050. Three sections:

1. **Invite a colleague** (manager+ only; not rendered for members) — email `TextInput` (`autoCapitalize="none"`, `keyboardType="email-address"`), role `SegmentedControl` (Member / Manager / Admin — Admin option only when the signed-in user is an admin, since only admins may grant admin), "Create invite" button, and the design's role-explainer footnote. On success the returned `link` renders in a `selectable` `Text` with a "Share link" button calling `Share.share({ message: link })` from `react-native`. Link is held in component state only — never persisted.
2. **Pending invites** — email, role chip, `Expires ${shortDate(expiresAt)}`, and two actions: **New link** (regenerate; confirm first: "Any link you already sent stops working.") and **Revoke** (confirm).
3. **Members** — name, email, role chip, `lastLoginAt ? relTime(lastLoginAt) : 'Never signed in'`. Role change (admin only) via a small role picker; remove (manager+, and never on yourself — compare against `useAuth().user.id`) behind a confirm.

- [ ] **Step 1:** Write `team.test.tsx`. Render helper takes a role so the permission matrix is cheap to assert. Cases: an admin sees the invite form, role pickers and remove actions; a **member** sees neither the invite form nor any remove/role control; a manager sees invite + remove but no role picker and no Admin role option; creating an invite calls `createInvitation` and shows the returned link; "New link" confirms then calls `regenerateInvitation`; revoke confirms then calls `revokeInvitation`; you cannot remove yourself (no control on your own row); a failed create toasts; empty invite list renders its empty state; retry; back.
- [ ] **Step 2:** Run — expect failure.
- [ ] **Step 3:** Implement `Team.tsx`. Two queries (`['members']`, `['invitations']`); mutations invalidate their own key. Guard every control with `hasAtLeast(user?.role, …)`.
- [ ] **Step 4:** Route wrapper, MoreSheet wiring + test, README row. Full suite + `tsc`.
- [ ] **Step 5:** Commit: `feat: team screen`

### Task 6: Settings screen

**Files:**
- Create: `src/screens/Settings.tsx`, `src/app/screens/settings.tsx`, `src/screens/__tests__/settings.test.tsx`
- Modify: `MoreSheet.tsx` + its test, `README.md`

Layout from dc.html ~779-833, **minus the purchase-tracking card** (no backing field — spec §3). Sections:

1. **Data collection** — status dot + label (`Collecting` / `Paused`, `colors.pos` / `colors.warn`), the design's explanatory copy, and `Toggle` bound to `company.dataCollectionEnabled`. **Admin only: non-admins see the state text without the toggle.** Flipping goes through `confirmDestructive` when turning **off** — title "Pause data collection?", message "Testerify stops receiving data from your storefront within a minute. Running tests keep their existing results but stop collecting new ones." Turning it back **on** needs no confirm. Not optimistic: the switch moves after the server responds. Footnote: "Pausing takes effect within a minute for new page views. Only admins can change this."
2. **Account** — read-only rows from `company` and `useAuth().user`: Workspace (`company.name`), Plan (`company.plan`), Your role (`roleLabel(user.role)`), Signed in as (`user.email`). Footnote: "Plan & billing, team invites and page-type mapping are desktop-only — this screen covers what you may need to flip in a hurry."
3. **Log out** — bordered `colors.neg` button, confirm ("Log out?" / "You'll need your email and password to sign back in."), then `useAuth().signOut()`. **This is the app's first logout affordance.**

- [ ] **Step 1:** Write `settings.test.tsx`: renders the collecting state and account rows; an admin turning collection **off** gets a confirm and only then `setDataCollection(false)`; turning it **on** skips the confirm; a **member** sees the state text but no switch; a failed toggle toasts and the switch stays put; log out confirms then calls `signOut`; retry; back.
- [ ] **Step 2:** Run — expect failure.
- [ ] **Step 3:** Implement `Settings.tsx`.
- [ ] **Step 4:** Route wrapper, MoreSheet wiring + test, README row. Full suite + `tsc`.
- [ ] **Step 5:** Commit: `feat: settings screen with logout`

### Task 7: Phase-3 wrap

- [ ] **Step 1:** MoreSheet: **15 of 16 items navigate**; only Audiences still toasts. Update its copy from the Phase-2 wording to `Saved audiences live on the desktop panel.` and update `MoreSheet.test.tsx` so `LABELS` is `['Audiences']` and `ROUTED` holds the other 15.
- [ ] **Step 2:** README: add the Phase-3 regression rows under the steps 11–21 preamble (extending it to 11–25), note the permission matrix as something to check with two different accounts, and move Phase 3 out of the roadmap's deferred list. Record the Audiences cut and the purchase-tracking cut in the deviations table.
- [ ] **Step 3:** Full suite + `tsc --noEmit` + `npx expo export --platform ios`.
- [ ] **Step 4:** Commit: `chore: phase-3 wrap — more-sheet complete, regression checklist`

---

## Self-Review (at write time)

1. **Spec coverage:** §1 scope → Tasks 3–6 plus the Audiences toast in Task 7. §2 shapes → Task 1. §3 deviations → Tasks 3 (New button), 6 (purchase card), 7 (Audiences). §4 screens → Tasks 3–6. §5 permissions → Task 2 helpers, asserted in Tasks 5 and 6. §6 mutations → optimistic in Tasks 3–4, confirm-and-wait in Tasks 3, 5, 6. §7 testing → each task's Step 1.
2. **Placeholders:** none — every screen names its design line range, its fields, and its copy.
3. **Type consistency:** `Role` is defined once in `src/api/company.ts` and consumed by `src/utils/roles.ts` and Tasks 5–6. `FlowStatus` likewise from `src/api/flows.ts`. `setCampaignStatus` (Task 4) is additive to `src/api/campaigns.ts` and does not disturb `rollbackCampaign`.
