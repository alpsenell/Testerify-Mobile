// Pure payload builders for the test wizard, transcribed from the panel's
// api/campaigns/index.js (createCampaign), api/campaigns/[id].js
// (updateCampaign), api/_lib/targeting.js and api/_lib/goals.js. They live in
// utils — not next to the fetchers — because screen tests jest.mock the api
// modules wholesale, which would auto-mock these into undefined-returners.

export type TestKind = 'ab' | 'personalization'
export type TargetingMode = 'all' | 'pages' | 'url'
export type PageType = 'home' | 'product' | 'collection' | 'cart'
export type GoalType = 'order' | 'cart' | 'click' | 'url'

export const PAGE_TYPES: PageType[] = ['home', 'product', 'collection', 'cart']

export const isPageType = (v: unknown): v is PageType =>
  typeof v === 'string' && (PAGE_TYPES as string[]).includes(v)

// Mirrors the server's DEFAULT_NAMES — shown on goal-type segments and in the
// review summary.
export const GOAL_LABELS: Record<GoalType, string> = {
  order: 'Purchase',
  cart: 'Add to cart',
  click: 'Click',
  url: 'Page visit',
}

export type GoalDraft = { id: string; type: GoalType; selector: string; url: string }
export type CleanGoal = { type: GoalType; selector?: string; url?: string }

export const MAX_GOALS = 10
export const SPLIT_MIN = 10
export const SPLIT_MAX = 90
export const SPLIT_DEFAULT = 50

export const clampSplit = (n: number) =>
  Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, Math.round(n)))

export type WizardDraft = {
  name: string
  kind: TestKind
  mode: TargetingMode
  pages: PageType[]
  // What the merchant typed for a specific-URL rule: a path ('/sale') or a
  // full URL — see parseUrlTarget.
  target: string
  audienceId: string | null
  redirectUrl: string
  goals: GoalDraft[]
  trafficSplit: number
}

export type Targeting =
  | { mode: 'all'; audienceId?: string }
  | { mode: 'pages'; pages: PageType[]; audienceId?: string }
  | { mode: 'url'; path: string; audienceId?: string }

export type CreateCampaignBody = {
  name: string
  kind: TestKind
  targeting: Targeting
  goals: CleanGoal[]
  trafficSplit?: number
  redirectUrl?: string
  targetUrl?: string
}

// A specific-URL rule stores a path; when the merchant pastes a full URL we
// keep the pathname as the rule and send the whole URL along as targetUrl so
// the desktop editor can preview the page. Regex instead of `new URL` — no
// dependence on the runtime's URL completeness.
export function parseUrlTarget(input: string): { path: string; targetUrl: string | null } {
  const raw = input.trim()
  const m = raw.match(/^https?:\/\/[^/?#]+([^?#]*)/i)
  if (m) return { path: m[1] || '/', targetUrl: raw }
  const path = raw ? (raw.startsWith('/') ? raw : `/${raw}`) : '/'
  return { path, targetUrl: null }
}

// Mirror api/_lib/goals.js: a click goal without a selector or a url goal
// without a url is meaningless and dropped server-side — drop it here too so
// the review step counts what will actually be stored. Capped at 10.
export function cleanGoals(goals: GoalDraft[]): CleanGoal[] {
  const out: CleanGoal[] = []
  for (const g of goals) {
    if (out.length === MAX_GOALS) break
    if (g.type === 'click') {
      const selector = g.selector.trim()
      if (!selector) continue
      out.push({ type: 'click', selector })
    } else if (g.type === 'url') {
      const url = g.url.trim()
      if (!url) continue
      out.push({ type: 'url', url })
    } else {
      out.push({ type: g.type })
    }
  }
  return out
}

export function buildTargeting(draft: Pick<WizardDraft, 'mode' | 'pages' | 'target' | 'audienceId'>): Targeting {
  const base: Targeting =
    draft.mode === 'url'
      ? { mode: 'url', path: parseUrlTarget(draft.target).path }
      : draft.mode === 'pages' && draft.pages.length
        ? { mode: 'pages', pages: draft.pages }
        : { mode: 'all' }
  return draft.audienceId ? { ...base, audienceId: draft.audienceId } : base
}

// POST /api/campaigns body. Personalization omits trafficSplit — the server
// pins Experience/Holdout at 90/10 and ignores the slider, so sending a
// number would only suggest it did something.
export function buildCreateBody(draft: WizardDraft): CreateCampaignBody {
  const body: CreateCampaignBody = {
    name: draft.name.trim(),
    kind: draft.kind,
    targeting: buildTargeting(draft),
    goals: cleanGoals(draft.goals),
  }
  if (draft.kind === 'ab') body.trafficSplit = clampSplit(draft.trafficSplit)
  const redirect = draft.redirectUrl.trim()
  if (redirect) body.redirectUrl = redirect
  if (draft.mode === 'url') {
    const { targetUrl } = parseUrlTarget(draft.target)
    if (targetUrl) body.targetUrl = targetUrl
  }
  return body
}

// PATCH bodies for the review-step actions. Launch carries the optional end
// date so a "run until the sale ends" launch is one request.
export function buildLaunchPatch(endsAt = ''): { status: 'running'; endsAt?: string } {
  const ends = endsAt.trim()
  return ends ? { status: 'running', endsAt: ends } : { status: 'running' }
}

export function buildSchedulePatch(startsAt: string, endsAt = ''): { startsAt: string; endsAt?: string } {
  const ends = endsAt.trim()
  return ends ? { startsAt: startsAt.trim(), endsAt: ends } : { startsAt: startsAt.trim() }
}

// The one honest warning the wizard must show: a plain ab test with no
// redirect URL has two identical variants — visitors see the same page on
// both sides until changes are added in the desktop editor.
export const servesIdenticalPages = (draft: Pick<WizardDraft, 'kind' | 'redirectUrl'>) =>
  draft.kind === 'ab' && !draft.redirectUrl.trim()

export const isValidDateInput = (s: string) => {
  const t = s.trim()
  return t.length > 0 && !Number.isNaN(Date.parse(t))
}
