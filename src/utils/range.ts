import { dayKey } from './format'

export type DateRange = { from: string; to: string }

// The window presets every analytics screen offers — mirrors the web panel's
// RangePicker (1/7/30/90 days).
export const RANGE_PRESETS = [1, 7, 30, 90] as const
export type RangeDays = (typeof RANGE_PRESETS)[number]

export function presetLabel(days: RangeDays): string {
  return days === 1 ? 'Today' : `${days}d`
}

// Subtitle sentence: 'Today' / 'Last 30 days' — used as `${windowSentence(days)}.`
export function windowSentence(days: RangeDays): string {
  return days === 1 ? 'Today' : `Last ${days} days`
}

// Mid-sentence fragment: 'today' / 'in the last 30 days'.
export function inWindow(days: RangeDays): string {
  return days === 1 ? 'today' : `in the last ${days} days`
}

// Inclusive `YYYY-MM-DD` range covering the last `days` calendar days, today
// included — the window the stats endpoints take as `from`/`to`. UTC-keyed for
// the same reason as dayKey(): the numbers must not shift with the device's
// timezone.
export function lastNDays(days: number, now: Date = new Date()): DateRange {
  const to = dayKey(now)
  const from = dayKey(new Date(now.getTime() - (days - 1) * 86_400_000))
  return { from, to }
}
