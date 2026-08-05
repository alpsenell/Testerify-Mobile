# Testerify Mobile — Phase 3 Design (management screens)

**Status:** approved 2026-08-05. Supersedes the one-line Phase 3 entry in
[`2026-07-25-testerify-mobile-design.md`](2026-07-25-testerify-mobile-design.md) §3, which named five screens and two
endpoints that don't exist.

## 1. Scope

Four screens, each a stack route under `src/app/screens/`, opened from the More sheet:
**Flows**, **Nudges**, **Team**, **Settings**. This closes the More sheet — every one of its 16 items
then leads somewhere real.

**Audiences is cut.** The design describes "save who-sees-this definitions once, reuse them across tests
and flows", but no such entity exists: there is no `audiences` table, no `/api/audiences`, and no panel
page. `audience` is an inline object on a campaign (`devices`, `visitor`, `utmSource`, `utmMedium`,
`referrer`) written by `NewCampaignPage.vue`. Saved audiences are a product decision for the panel, and
mobile is the wrong place for a feature to debut. Its More-sheet item keeps a toast, with copy updated
from "arrives in Phase 3" to point at the desktop panel.

Out of scope, as in earlier phases: the flow canvas, the variant editor, campaign creation, plan and
billing, page-type mapping, store switching (`/api/auth/switch-store`).

## 2. Backend reality (verified against the panel repo, 2026-08-05)

The Phase-2 shapes doc was never committed and is gone. Field shapes therefore live **here**, transcribed
from `~/Desktop/PersonalProjects/Testerify`. Field names are law; implementers transcribe, never invent.

### `GET /api/flows` → `{ flows: Flow[] }` (`api/flows/index.js`)

```ts
type Flow = {
  id: string; name: string
  status: 'active' | 'paused'          // normalizeFlow: anything not 'active' is 'paused'
  steps: unknown[]                     // step objects; shape owned by the flow builder
  campaignId: string | null
  campaignName: string | null          // left join — null when the flow points at nothing
  createdAt: string; updatedAt: string
}
```

- `PATCH /api/flows/[id]` — body `{ status }` for pause/resume. Any member may write; flows are not admin-gated.
- `DELETE /api/flows/[id]` — hard delete.

### Nudges — no endpoint; derived from campaigns

Nudges are `CampaignListItem`s with `kind === 'nudge'` (`src/api/campaigns.ts`, already typed). The
design's "holdout" is the control variant: `control` / `challenger` / `uplift` / `confidence` / `sigStatus`
carry the same meaning as for an A/B test. Pause/resume reuses `PATCH /api/campaigns/[id] { status }`.

### `GET /api/company` → `{ company }` (`api/company/index.js`)

```ts
type Company = {
  id: string; name: string; slug: string; apiKey: string
  websiteUrl: string | null; onboardingCompleted: boolean
  plan: string; billingStatus: string; trialEndsAt: string | null
  shopifyDomain: string | null
  notifications: unknown; pageTypeConfig: unknown
  dataCollectionEnabled: boolean
  createdAt: string
}
```

- `PATCH /api/company` — body `{ dataCollectionEnabled: boolean }`. **Admin only** (403 otherwise).

### `GET /api/company/members` → `{ members: Member[] }`

```ts
type Member = {
  id: string; name: string; email: string
  role: 'member' | 'manager' | 'admin'
  createdAt: string; lastLoginAt: string | null
}
```

- `PATCH /api/company/members/[id]` — `{ role }`. Admin only.
- `DELETE /api/company/members/[id]` — remove. Manager+.

### `GET /api/company/invitations` → `{ invitations: Invitation[] }`

```ts
type Invitation = {
  id: string; email: string
  role: 'member' | 'manager' | 'admin'
  status: string; expiresAt: string; createdAt: string
  invitedByName: string | null
}
```

- `POST /api/company/invitations` — `{ email, role }` → `201 { invitation, link }`. **The link is returned
  exactly once, at creation.** The list endpoint never re-serves it (the token is stored hashed).
- `POST /api/company/invitations/[id]` — regenerate: mints a new token, resets `expiresAt`, **invalidating
  any link already shared**. This is the only way to get a link for an existing invite.
- `DELETE /api/company/invitations/[id]` — revoke.

Roles are ranked `member(1) < manager(2) < admin(3)` (`api/_lib/roles.js`).

## 3. Deviations from the design (deliberate)

| Design element | Reality | What ships |
|---|---|---|
| Audiences screen | No entity, endpoint, or panel page | Cut; More-sheet toast points to desktop |
| Settings "Purchase tracking · Verified" card | **No field anywhere in the panel** — no `purchaseVerified`, no first-order timestamp | Cut. Nothing fabricated in its place |
| Flows "New" button | Flow builder is the desktop canvas | Omitted — no dead affordance |
| Team "Get link" on a pending invite | Links are one-time; only regenerate produces a new one | Renders as **"New link"** with a confirm explaining the old link stops working |
| Nudges holdout stats | No nudge endpoint | Derived from the campaign's control vs challenger |

## 4. Screens

Every screen follows the established shell: stack route, back → Home, skeleton / retry card / empty state,
pull-to-refresh, theme tokens, formatters.

### Flows (`Automation`)
List of flow cards: name with flow glyph, status pill (`active` → pos + pulse, `paused` → neutral), the
step chain rendered as mono text (`steps.length` steps summarised — the raw step objects are the builder's
shape, so the card shows a count and the linked campaign, not a decoded journey), linked campaign row, and
two row actions: pause/resume and delete. Empty → "No flows yet — build one on the desktop panel."

### Nudges (`Widget library`)
`/api/campaigns` filtered to `kind === 'nudge'`. Cards carry name, where it runs (`targetUrl`), status
pill, and a 2×2 stat grid from real fields (visitors, conversion rate, uplift vs holdout, confidence).
Pause/resume only. Empty → "No nudges yet."

### Team (`Workspace`)
Three sections: **invite** (email field, role segmented control, Create invite), **pending invites**
(email, role chip, expiry, New link / Revoke), and **members** (name, email, role chip, last seen; role
change and remove for those permitted).

A created or regenerated link is returned once and must reach the colleague from the device that holds it.
It renders in a `selectable` `Text` and offers React Native's built-in `Share` sheet — **no new dependency**
(`expo-clipboard` would be one; `Share` ships with React Native). The link is never persisted on device:
dismissing the row loses it, and getting it back means regenerating, which is exactly what the API allows.

### Settings (`Workspace`)
**Data collection** — the design's switch bound to `dataCollectionEnabled`, with the state copy and the
"takes effect within a minute" footnote. **Account** — read-only rows from `company` and the signed-in
`user` (workspace, plan, your role, email). **Log out** — the app's first logout affordance; `signOut()`
has existed since Phase 1 with nothing calling it.

## 5. Permissions

`useAuth().user.role` is reliable on cold start (`restore()` hydrates it from `/api/auth/me`).
**Controls the signed-in user cannot use are not rendered**: the data-collection toggle and the role
picker are admin-only; member removal and invites are manager+. The server remains the authority — a 403
still surfaces as an error toast — but the UI does not offer taps that are guaranteed to fail.

## 6. Mutations

Reads are TanStack Query per endpoint; writes are `useMutation` invalidating the affected key. Following
the Phase 1 rule, cheap reversible toggles (flow pause/resume, nudge pause/resume) are **optimistic with
rollback on error**; everything destructive or wide-reaching **waits for the server** before the UI moves.

Destructive actions confirm through `Alert.alert` with a `destructive` action, matching the rollback
precedent in `TestDetail`. Five confirms: delete flow, remove member, revoke invite, new invite link, and
the data-collection toggle — the last with explicit consequence text, because turning it off silently
empties every other screen in the app.

## 7. Testing

Per screen: loading / error / empty / data, the permission matrix (admin vs manager vs member sees the
right controls), each mutation against a mocked API including its failure toast, and confirm dialogs
asserted via a mocked `Alert.alert`. Pure helpers (role ranking, flow status derivation, invite expiry
formatting) are unit-tested separately. Every screen adds a README regression row; the More-sheet test
asserts all 16 items — 15 navigating, 1 (Audiences) toasting.
