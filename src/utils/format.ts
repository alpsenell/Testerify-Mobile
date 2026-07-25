const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }

export function compact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    const r = Math.round(abs / 1_000_000 * 10) / 10
    if (r >= 1000) return String(Math.round(abs / 1_000_000_000)) + 'b'
    return trim1(n / 1_000_000) + 'm'
  }
  if (abs >= 1_000) {
    const r = Math.round(abs / 1_000 * 10) / 10
    if (r >= 1000) return trim1(n / 1_000_000) + 'm'
    return trim1(n / 1_000) + 'k'
  }
  return String(Math.round(n))
}

const trim1 = (x: number) => {
  const s = (Math.round(x * 10) / 10).toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

export function pct(n: number, digits = 1): string {
  return n.toFixed(digits) + '%'
}

export function signedPct(n: number, digits = 1): string {
  const body = pct(Math.abs(n), digits)
  return n < 0 ? `−${body}` : `+${body}`
}

export function money(n: number, code?: string | null): string {
  const isNegative = n < 0
  const num = compact(Math.abs(n))
  const formatted = !code ? num : SYMBOL[code] ? `${SYMBOL[code]}${num}` : `${num} ${code}`
  return isNegative ? `−${formatted}` : formatted
}

export function relTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  const dayKey = (x: Date) => x.toISOString().slice(0, 10)
  if (dayKey(d) === dayKey(now)) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  if (dayKey(d) === dayKey(new Date(now.getTime() - 86_400_000))) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function daysBetween(aIso: string, b: Date = new Date()): number {
  return Math.max(0, Math.floor((b.getTime() - new Date(aIso).getTime()) / 86_400_000))
}
