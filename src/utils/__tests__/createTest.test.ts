import {
  buildCreateBody, buildLaunchPatch, buildSchedulePatch, buildTargeting, clampSplit,
  cleanGoals, isPageType, isValidDateInput, parseUrlTarget, servesIdenticalPages,
} from '../createTest'
import type { GoalDraft, WizardDraft } from '../createTest'

const goal = (over: Partial<GoalDraft>): GoalDraft => ({ id: 'g', type: 'order', selector: '', url: '', ...over })

const draft = (over: Partial<WizardDraft> = {}): WizardDraft => ({
  name: 'Sticky CTA', kind: 'ab', mode: 'all', pages: [], target: '', audienceId: null,
  redirectUrl: '', goals: [goal({ id: 'g1' })], trafficSplit: 50, ...over,
})

describe('parseUrlTarget', () => {
  test('a bare path gains its leading slash', () => {
    expect(parseUrlTarget('collections/sale')).toEqual({ path: '/collections/sale', targetUrl: null })
    expect(parseUrlTarget('/sale')).toEqual({ path: '/sale', targetUrl: null })
  })

  test('a full URL keeps its pathname as the rule and travels whole as targetUrl', () => {
    expect(parseUrlTarget('https://store.com/pages/landing?x=1')).toEqual({
      path: '/pages/landing', targetUrl: 'https://store.com/pages/landing?x=1',
    })
    expect(parseUrlTarget('https://store.com')).toEqual({ path: '/', targetUrl: 'https://store.com' })
  })

  test('empty input falls back to the root path, like the server', () => {
    expect(parseUrlTarget('  ')).toEqual({ path: '/', targetUrl: null })
  })
})

describe('cleanGoals', () => {
  test('click without a selector and url without a url are skipped, like the server', () => {
    expect(cleanGoals([
      goal({ id: 'g1', type: 'order' }),
      goal({ id: 'g2', type: 'click', selector: '  ' }),
      goal({ id: 'g3', type: 'url', url: '' }),
      goal({ id: 'g4', type: 'click', selector: ' .buy ' }),
      goal({ id: 'g5', type: 'url', url: '/thanks' }),
      goal({ id: 'g6', type: 'cart' }),
    ])).toEqual([
      { type: 'order' },
      { type: 'click', selector: '.buy' },
      { type: 'url', url: '/thanks' },
      { type: 'cart' },
    ])
  })

  test('caps at 10 goals', () => {
    const goals = Array.from({ length: 12 }, (_, i) => goal({ id: `g${i}`, type: 'order' }))
    expect(cleanGoals(goals)).toHaveLength(10)
  })
})

describe('buildTargeting', () => {
  test('pages mode with no pages degrades to all, like the server', () => {
    expect(buildTargeting({ mode: 'pages', pages: [], target: '', audienceId: null })).toEqual({ mode: 'all' })
  })

  test('carries the saved-audience reference on any mode', () => {
    expect(buildTargeting({ mode: 'pages', pages: ['home', 'cart'], target: '', audienceId: 'a1' }))
      .toEqual({ mode: 'pages', pages: ['home', 'cart'], audienceId: 'a1' })
    expect(buildTargeting({ mode: 'all', pages: [], target: '', audienceId: 'a1' }))
      .toEqual({ mode: 'all', audienceId: 'a1' })
  })

  test('url mode stores the path', () => {
    expect(buildTargeting({ mode: 'url', pages: [], target: 'sale', audienceId: null }))
      .toEqual({ mode: 'url', path: '/sale' })
  })
})

describe('buildCreateBody', () => {
  test('an ab draft carries the clamped split and cleaned goals', () => {
    expect(buildCreateBody(draft({
      name: '  Sticky CTA ',
      trafficSplit: 97,
      goals: [goal({ id: 'g1', type: 'order' }), goal({ id: 'g2', type: 'click', selector: '' })],
    }))).toEqual({
      name: 'Sticky CTA',
      kind: 'ab',
      targeting: { mode: 'all' },
      goals: [{ type: 'order' }],
      trafficSplit: 90,
    })
  })

  test('personalization omits trafficSplit — the server pins 90/10 regardless', () => {
    const body = buildCreateBody(draft({ kind: 'personalization' }))
    expect(body.kind).toBe('personalization')
    expect(body).not.toHaveProperty('trafficSplit')
  })

  test('a redirect URL travels trimmed; absent when empty', () => {
    expect(buildCreateBody(draft({ redirectUrl: ' https://s.com/b ' })).redirectUrl).toBe('https://s.com/b')
    expect(buildCreateBody(draft())).not.toHaveProperty('redirectUrl')
  })

  test('url mode with a full URL sends targetUrl for the editor preview', () => {
    const body = buildCreateBody(draft({ mode: 'url', target: 'https://store.com/pages/a' }))
    expect(body.targeting).toEqual({ mode: 'url', path: '/pages/a' })
    expect(body.targetUrl).toBe('https://store.com/pages/a')
  })

  test('url mode with a bare path sends no targetUrl', () => {
    expect(buildCreateBody(draft({ mode: 'url', target: '/sale' }))).not.toHaveProperty('targetUrl')
  })
})

describe('action patches', () => {
  test('launch is a status write, with the end date only when set', () => {
    expect(buildLaunchPatch()).toEqual({ status: 'running' })
    expect(buildLaunchPatch(' 2026-09-01 ')).toEqual({ status: 'running', endsAt: '2026-09-01' })
  })

  test('schedule carries startsAt and an optional endsAt', () => {
    expect(buildSchedulePatch('2026-08-15')).toEqual({ startsAt: '2026-08-15' })
    expect(buildSchedulePatch('2026-08-15', '2026-09-01')).toEqual({ startsAt: '2026-08-15', endsAt: '2026-09-01' })
  })
})

describe('review-step guards', () => {
  test('a plain ab test with no redirect serves identical pages', () => {
    expect(servesIdenticalPages({ kind: 'ab', redirectUrl: '' })).toBe(true)
    expect(servesIdenticalPages({ kind: 'ab', redirectUrl: 'https://s.com/b' })).toBe(false)
    expect(servesIdenticalPages({ kind: 'personalization', redirectUrl: '' })).toBe(false)
  })

  test('clampSplit keeps the server bounds', () => {
    expect(clampSplit(5)).toBe(10)
    expect(clampSplit(95)).toBe(90)
    expect(clampSplit(50)).toBe(50)
  })

  test('date input validation', () => {
    expect(isValidDateInput('2026-08-15')).toBe(true)
    expect(isValidDateInput('')).toBe(false)
    expect(isValidDateInput('not-a-date')).toBe(false)
  })

  test('isPageType recognizes the rule vocabulary', () => {
    expect(isPageType('product')).toBe(true)
    expect(isPageType('blog')).toBe(false)
    expect(isPageType(undefined)).toBe(false)
  })
})
