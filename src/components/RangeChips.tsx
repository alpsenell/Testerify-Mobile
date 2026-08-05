import { SegmentedControl } from './SegmentedControl'
import { RANGE_PRESETS, presetLabel } from '../utils/range'
import type { RangeDays } from '../utils/range'

export function RangeChips({ days, onPick }: { days: RangeDays; onPick: (days: RangeDays) => void }) {
  return (
    <SegmentedControl
      options={RANGE_PRESETS.map((d) => ({ key: String(d), label: presetLabel(d) }))}
      active={String(days)}
      onPick={(key) => onPick(Number(key) as RangeDays)}
    />
  )
}
