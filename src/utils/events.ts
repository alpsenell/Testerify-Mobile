import type { EventStat } from '../api/stats'

export function filterEvents(events: EventStat[], query: string): EventStat[] {
  const q = query.trim().toLowerCase()
  if (!q) return events
  return events.filter((e) => e.name.toLowerCase().includes(q))
}

// Share of the store's visitors that fired the event at least once. Null when
// the window reports no visitors at all — a percentage of nothing is noise.
export function reach(event: EventStat, totalVisitors: number): number | null {
  if (totalVisitors === 0) return null
  return event.visitors / totalVisitors * 100
}

export type FiredBucket = { key: string; label: string; count: number; visitors: number; isSiteWide: boolean }

// Where the event fired: one bucket per campaign, plus the site-wide bucket
// when the endpoint reports one. Biggest first — the bars read relative to
// the largest bucket.
export function firedBuckets(event: EventStat): FiredBucket[] {
  const buckets: FiredBucket[] = event.campaigns.map((c) => ({
    key: c.campaignId, label: c.name, count: c.count, visitors: c.visitors, isSiteWide: false,
  }))
  if (event.siteWide) {
    buckets.push({
      key: 'site-wide', label: 'Site-wide (outside tests)',
      count: event.siteWide.count, visitors: event.siteWide.visitors, isSiteWide: true,
    })
  }
  return buckets.sort((a, b) => b.count - a.count)
}

// Device / country / campaign chips for one sample, skipping whatever the
// endpoint didn't record.
export function sampleChips(sample: EventStat['samples'][number], campaignName: (id: string) => string | null): string[] {
  const chips: string[] = []
  if (sample.device) chips.push(sample.device)
  if (sample.country) chips.push(sample.country)
  const campaign = sample.campaignId ? campaignName(sample.campaignId) : null
  if (campaign) chips.push(campaign)
  return chips
}

// The sample's own payload, rendered as compact key=value pairs. Empty
// payloads say so rather than showing "{}".
export function metadataLine(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata ?? {})
  if (entries.length === 0) return 'no payload'
  return entries.map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ')
}
