import { render, screen, fireEvent } from '@testing-library/react-native'
import { SegmentedControl } from '../SegmentedControl'
import { colors } from '../../theme'

const options = [
  { key: 'source', label: 'Source' },
  { key: 'medium', label: 'Medium' },
  { key: 'campaign', label: 'Campaign' },
]

test('renders every option label', async () => {
  await render(<SegmentedControl options={options} active="source" onPick={jest.fn()} />)
  expect(screen.getByText('Source')).toBeTruthy()
  expect(screen.getByText('Medium')).toBeTruthy()
  expect(screen.getByText('Campaign')).toBeTruthy()
})

test('fires onPick with the tapped key', async () => {
  const onPick = jest.fn()
  await render(<SegmentedControl options={options} active="source" onPick={onPick} />)
  fireEvent.press(screen.getByText('Medium'))
  expect(onPick).toHaveBeenCalledTimes(1)
  expect(onPick).toHaveBeenCalledWith('medium')
})

test('reflects the active option with ink text, inactive options with muted text', async () => {
  await render(<SegmentedControl options={options} active="medium" onPick={jest.fn()} />)
  expect(screen.getByText('Medium').props.style.color).toBe(colors.ink)
  expect(screen.getByText('Source').props.style.color).toBe(colors.muted)
  expect(screen.getByText('Campaign').props.style.color).toBe(colors.muted)
})

test('re-renders the active segment when the active prop changes', async () => {
  const r = await render(<SegmentedControl options={options} active="source" onPick={jest.fn()} />)
  expect(screen.getByText('Source').props.style.color).toBe(colors.ink)
  await r.rerender(<SegmentedControl options={options} active="campaign" onPick={jest.fn()} />)
  expect(screen.getByText('Source').props.style.color).toBe(colors.muted)
  expect(screen.getByText('Campaign').props.style.color).toBe(colors.ink)
})
