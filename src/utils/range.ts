import { dayKey } from './format'

export type DateRange = { from: string; to: string }

// Inclusive `YYYY-MM-DD` range covering the last `days` calendar days, today
// included — the window the stats endpoints take as `from`/`to`. UTC-keyed for
// the same reason as dayKey(): the numbers must not shift with the device's
// timezone.
export function lastNDays(days: number, now: Date = new Date()): DateRange {
  const to = dayKey(now)
  const from = dayKey(new Date(now.getTime() - (days - 1) * 86_400_000))
  return { from, to }
}
