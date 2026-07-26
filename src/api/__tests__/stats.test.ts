/// <reference types="jest" />
import * as SecureStore from 'expo-secure-store'
import { fetchUtm, fetchPageBehavior, fetchCustomEvents, fetchReplays } from '../stats'
import { setTokens } from '../tokens'

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
  await setTokens({ access: 'A1', refresh: 'R1' })
})

describe('fetchUtm URL serialization', () => {
  test('with all params (dimension, from, to, preset) — all present in URL', async () => {
    const spy = jest.spyOn(globalThis, 'fetch' as any).mockImplementation(() =>
      ok({ dimension: 'source', days: 7, summary: {}, breakdown: [], trend: [] })
    )
    await fetchUtm({ dimension: 'medium', from: '2026-07-19', to: '2026-07-26', preset: 30 })
    const [url] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/stats/utm?')
    expect(url).toContain('dimension=medium')
    expect(url).toContain('from=2026-07-19')
    expect(url).toContain('to=2026-07-26')
    expect(url).toContain('preset=30')
    expect(url).not.toContain('undefined')
  })

  test('with only optional preset — dimensions not in URL', async () => {
    const spy = jest.spyOn(globalThis, 'fetch' as any).mockImplementation(() =>
      ok({ dimension: 'source', days: 30, summary: {}, breakdown: [], trend: [] })
    )
    await fetchUtm({ preset: 7 })
    const [url] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/stats/utm?')
    expect(url).toContain('preset=7')
    expect(url).not.toContain('dimension=')
    expect(url).not.toContain('from=')
    expect(url).not.toContain('to=')
    expect(url).not.toContain('undefined')
  })

  test('with no params — no query string', async () => {
    const spy = jest.spyOn(globalThis, 'fetch' as any).mockImplementation(() =>
      ok({ dimension: 'source', days: 30, summary: {}, breakdown: [], trend: [] })
    )
    await fetchUtm({})
    const [url] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/stats/utm')
    expect(url).not.toContain('?')
  })
})

describe('fetchPageBehavior URL serialization', () => {
  test('with all params (from, to, preset, days, pageType) — all present in URL', async () => {
    const spy = jest.spyOn(globalThis, 'fetch' as any).mockImplementation(() =>
      ok({ rangeDays: 7, since: '', until: '', totals: {}, pages: [], funnel: {} })
    )
    await fetchPageBehavior({
      from: '2026-07-19',
      to: '2026-07-26',
      preset: 7,
      days: 30,
      pageType: 'product',
    })
    const [url] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/stats/page-behavior?')
    expect(url).toContain('from=2026-07-19')
    expect(url).toContain('to=2026-07-26')
    expect(url).toContain('preset=7')
    expect(url).toContain('days=30')
    expect(url).toContain('pageType=product')
    expect(url).not.toContain('undefined')
  })

  test('with only required params (from, to) — only from/to in URL', async () => {
    const spy = jest.spyOn(globalThis, 'fetch' as any).mockImplementation(() =>
      ok({ rangeDays: 7, since: '', until: '', totals: {}, pages: [], funnel: {} })
    )
    await fetchPageBehavior({ from: '2026-07-19', to: '2026-07-26' })
    const [url] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/stats/page-behavior?')
    expect(url).toContain('from=2026-07-19')
    expect(url).toContain('to=2026-07-26')
    expect(url).not.toContain('preset=')
    expect(url).not.toContain('days=')
    expect(url).not.toContain('pageType=')
    expect(url).not.toContain('undefined')
  })

  test('with no params — no query string', async () => {
    const spy = jest.spyOn(globalThis, 'fetch' as any).mockImplementation(() =>
      ok({ rangeDays: 30, since: '', until: '', totals: {}, pages: [], funnel: {} })
    )
    await fetchPageBehavior({})
    const [url] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/stats/page-behavior')
    expect(url).not.toContain('?')
  })
})

describe('fetchCustomEvents URL serialization', () => {
  test('with all params (from, to, view) — all present in URL', async () => {
    const spy = jest.spyOn(globalThis, 'fetch' as any).mockImplementation(() =>
      ok({ events: [], totalVisitors: 0 })
    )
    await fetchCustomEvents({ from: '2026-07-19', to: '2026-07-26', view: 'pages' })
    const [url] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/stats/custom-events?')
    expect(url).toContain('from=2026-07-19')
    expect(url).toContain('to=2026-07-26')
    expect(url).toContain('view=pages')
    expect(url).not.toContain('undefined')
  })

  test('with only from/to (no preset, no view) — only from/to in URL', async () => {
    const spy = jest.spyOn(globalThis, 'fetch' as any).mockImplementation(() =>
      ok({ events: [], totalVisitors: 0 })
    )
    await fetchCustomEvents({ from: '2026-07-19', to: '2026-07-26' })
    const [url] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/stats/custom-events?')
    expect(url).toContain('from=2026-07-19')
    expect(url).toContain('to=2026-07-26')
    expect(url).not.toContain('view=')
    expect(url).not.toContain('preset=')
    expect(url).not.toContain('undefined')
  })

  test('no preset param in URL (shaped doc §8 allows only from/to/view)', async () => {
    const spy = jest.spyOn(globalThis, 'fetch' as any).mockImplementation(() =>
      ok({ events: [], totalVisitors: 0 })
    )
    await fetchCustomEvents({ from: '2026-07-19', to: '2026-07-26', view: 'pages' })
    const [url] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).not.toContain('preset=')
    expect(url).not.toContain('undefined')
  })

  test('with no params — no query string', async () => {
    const spy = jest.spyOn(globalThis, 'fetch' as any).mockImplementation(() =>
      ok({ events: [], totalVisitors: 0 })
    )
    await fetchCustomEvents({})
    const [url] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/stats/custom-events')
    expect(url).not.toContain('?')
  })
})

describe('fetchReplays URL serialization', () => {
  test('with all params (trigger, path) — all present in URL', async () => {
    const spy = jest.spyOn(globalThis, 'fetch' as any).mockImplementation(() =>
      ok({ origin: null, sessions: [], limit: 50, total: 0, totalEvents: 0, avgDurationMs: 0 })
    )
    await fetchReplays({ trigger: 'rage', path: '/products/widget' })
    const [url] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/public/replay?')
    expect(url).toContain('trigger=rage')
    expect(url).toContain('path=%2Fproducts%2Fwidget')
    expect(url).not.toContain('undefined')
  })

  test('with only trigger (no path) — only trigger in URL', async () => {
    const spy = jest.spyOn(globalThis, 'fetch' as any).mockImplementation(() =>
      ok({ origin: null, sessions: [], limit: 50, total: 0, totalEvents: 0, avgDurationMs: 0 })
    )
    await fetchReplays({ trigger: 'dead' })
    const [url] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/public/replay?')
    expect(url).toContain('trigger=dead')
    expect(url).not.toContain('path=')
    expect(url).not.toContain('undefined')
  })

  test('with no params — no query string', async () => {
    const spy = jest.spyOn(globalThis, 'fetch' as any).mockImplementation(() =>
      ok({ origin: null, sessions: [], limit: 50, total: 0, totalEvents: 0, avgDurationMs: 0 })
    )
    await fetchReplays({})
    const [url] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/public/replay')
    expect(url).not.toContain('?')
  })
})
