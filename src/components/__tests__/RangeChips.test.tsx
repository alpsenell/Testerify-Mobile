import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native'
import { RangeChips } from '../RangeChips'
import { useDateRange } from '../../hooks/useDateRange'

test('renders every preset and reports picks as numbers', async () => {
  const onPick = jest.fn()
  await render(<RangeChips days={7} onPick={onPick} />)

  expect(screen.getByText('Today')).toBeTruthy()
  expect(screen.getByText('7d')).toBeTruthy()
  expect(screen.getByText('30d')).toBeTruthy()
  expect(screen.getByText('90d')).toBeTruthy()

  fireEvent.press(screen.getByText('30d'))
  expect(onPick).toHaveBeenCalledWith(30)
})

test('useDateRange resolves the picked preset to an inclusive window', async () => {
  const { result } = await renderHook(() => useDateRange(7))
  expect(result.current.days).toBe(7)

  const span = (r: { from: string; to: string }) =>
    Math.round((Date.parse(r.to) - Date.parse(r.from)) / 86_400_000) + 1
  expect(span(result.current.range)).toBe(7)

  await act(async () => result.current.setDays(90))
  expect(result.current.days).toBe(90)
  expect(span(result.current.range)).toBe(90)
})
