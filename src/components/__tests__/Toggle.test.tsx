import { render, fireEvent } from '@testing-library/react-native'
import { Toggle } from '../Toggle'

test('reports its state to assistive tech', async () => {
  const { getByLabelText } = await render(
    <Toggle value onValueChange={jest.fn()} accessibilityLabel="Toggle data collection" />,
  )
  const toggle = getByLabelText('Toggle data collection')
  expect(toggle.props.accessibilityRole).toBe('switch')
  expect(toggle.props.accessibilityState).toMatchObject({ checked: true })
})

test('pressing asks for the opposite value', async () => {
  const onValueChange = jest.fn()
  const { getByLabelText } = await render(
    <Toggle value={false} onValueChange={onValueChange} accessibilityLabel="Toggle data collection" />,
  )
  fireEvent.press(getByLabelText('Toggle data collection'))
  expect(onValueChange).toHaveBeenCalledWith(true)
})

test('a disabled toggle does not fire', async () => {
  const onValueChange = jest.fn()
  const { getByLabelText } = await render(
    <Toggle value onValueChange={onValueChange} disabled accessibilityLabel="Toggle data collection" />,
  )
  fireEvent.press(getByLabelText('Toggle data collection'))
  expect(onValueChange).not.toHaveBeenCalled()
  expect(getByLabelText('Toggle data collection').props.accessibilityState).toMatchObject({ disabled: true })
})
