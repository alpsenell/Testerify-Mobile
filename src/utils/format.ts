const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }

export function compact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return trim1(n / 1_000_000) + 'm'
  if (abs >= 1_000) return trim1(n / 1_000) + 'k'
  return String(Math.round(n))
}

const trim1 = (x: number) => {
  const s = (Math.round(x * 10) / 10).toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

export function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits).replace(/\.0+$/, digits > 0 ? '.0' : '')}%`.replace(/\.0%$/, digits === 0 ? '%' : '.0%')
}

// Simpler + matches tests exactly:
// pct(14.234) -> '14.2%', pct(97, 0) -> '97%'
export function signedPct(n: number, digits = 1): string {
  const body = pct(Math.abs(n), digits)
  return n < 0 ? `−${body}` : `+${body}`
}

export function money(n: number, code?: string | null): string {
  const num = compact(n)
  if (!code) return num
  const sym = SYMBOL[code]
  return sym ? `${sym}${num}` : `${num} ${code}`
}

export function relTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (isSameDay(d, now)) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const isSameDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10)

export function daysBetween(aIso: string, b: Date = new Date()): number {
  return Math.max(0, Math.floor((b.getTime() - new Date(aIso).getTime()) / 86_400_000))
}
