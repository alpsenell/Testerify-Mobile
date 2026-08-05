import { useMemo, useState } from 'react'
import { lastNDays } from '../utils/range'
import type { RangeDays } from '../utils/range'

// Per-screen date-range state: a preset day count plus the inclusive
// from/to window it resolves to. Deliberately local, not global — each
// analytics screen keeps its own window, like the web panel.
export function useDateRange(defaultDays: RangeDays = 7) {
  const [days, setDays] = useState<RangeDays>(defaultDays)
  const range = useMemo(() => lastNDays(days), [days])
  return { days, setDays, range }
}
