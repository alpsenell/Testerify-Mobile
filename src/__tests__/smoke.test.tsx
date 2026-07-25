import { render } from '@testing-library/react-native'
import { Text } from 'react-native'

test('harness renders', async () => {
  // @testing-library/react-native v14 made `render` async (it now drives a
  // "test-renderer" root under React 19 concurrent rendering) — await it.
  const { getByText } = await render(<Text>ok</Text>)
  expect(getByText('ok')).toBeTruthy()
})
