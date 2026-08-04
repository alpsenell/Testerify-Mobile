import type { EventStat } from '../../api/stats'
import { filterEvents, firedBuckets, metadataLine, reach, sampleChips } from '../events'

const event = (over: Partial<EventStat> = {}): EventStat => ({
  name: 'size_guide_open', total: 480, visitors: 320,
  lastFired: '2026-07-25T10:00:00Z', firstFired: '2026-07-01T10:00:00Z',
  campaignCount: 1,
  campaigns: [{
    campaignId: 'c1', name: 'PDP: sticky add-to-cart', count: 300, visitors: 210,
    lastFired: '2026-07-25T10:00:00Z',
    variants: [{ variantId: 'v1', name: 'A', isControl: true, count: 140, visitors: 100 }],
  }],
  siteWide: { count: 180, visitors: 110, lastFired: '2026-07-24T10:00:00Z' },
  devices: [{ device: 'mobile', count: 300 }],
  countries: [{ country: 'US', count: 400 }],
  samples: [],
  ...over,
})

test('search matches the event name', () => {
  const events = [event(), event({ name: 'newsletter_signup' })]
  expect(filterEvents(events, '')).toHaveLength(2)
  expect(filterEvents(events, 'SIZE').map((e) => e.name)).toEqual(['size_guide_open'])
  expect(filterEvents(events, 'nope')).toEqual([])
})

test('reach is a share of the window visitors, or null with no visitors', () => {
  expect(reach(event(), 1600)).toBe(20)
  expect(reach(event(), 0)).toBeNull()
})

test('buckets combine campaigns and the site-wide bucket, biggest first', () => {
  const buckets = firedBuckets(event())
  expect(buckets.map((b) => b.key)).toEqual(['c1', 'site-wide'])
  expect(buckets[1]).toMatchObject({ label: 'Site-wide (outside tests)', count: 180, isSiteWide: true })
})

test('buckets omit the site-wide row when the endpoint reports none', () => {
  expect(firedBuckets(event({ siteWide: null })).map((b) => b.key)).toEqual(['c1'])
})

test('sample chips skip what was not recorded', () => {
  const name = (id: string) => (id === 'c1' ? 'PDP: sticky add-to-cart' : null)
  expect(sampleChips({ metadata: {}, createdAt: null, campaignId: 'c1', device: 'mobile', country: 'US' }, name))
    .toEqual(['mobile', 'US', 'PDP: sticky add-to-cart'])
  expect(sampleChips({ metadata: {}, createdAt: null, campaignId: null, device: null, country: null }, name))
    .toEqual([])
})

test('metadata renders as key=value pairs, and says so when empty', () => {
  expect(metadataLine({ size: 'M', source: 'pdp' })).toBe('size=M · source=pdp')
  expect(metadataLine({ nested: { a: 1 } })).toBe('nested={"a":1}')
  expect(metadataLine({})).toBe('no payload')
})
