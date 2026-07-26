import { render, screen, fireEvent } from '@testing-library/react-native'
import { SearchField } from '../SearchField'

const nodes = (n: any, t: string, acc: any[] = []): any[] => {
  if (!n || typeof n !== 'object') return acc
  if (n.type === t) acc.push(n)
  ;(n.children || []).forEach((c: any) => nodes(c, t, acc))
  return acc
}

test('renders the given placeholder', async () => {
  await render(<SearchField value="" onChangeText={jest.fn()} placeholder="Search name or note" />)
  expect(screen.getByPlaceholderText('Search name or note')).toBeTruthy()
})

test('reflects the current value', async () => {
  await render(<SearchField value="hero banner" onChangeText={jest.fn()} placeholder="Search" />)
  expect(screen.getByDisplayValue('hero banner')).toBeTruthy()
})

test('forwards typed text via onChangeText', async () => {
  const onChangeText = jest.fn()
  await render(<SearchField value="" onChangeText={onChangeText} placeholder="Search" />)
  fireEvent.changeText(screen.getByPlaceholderText('Search'), 'checkout')
  expect(onChangeText).toHaveBeenCalledWith('checkout')
})

test('renders a search icon', async () => {
  const r = await render(<SearchField value="" onChangeText={jest.fn()} placeholder="Search" />)
  // Icon name="search" draws a lens circle + handle path (see Icon.tsx)
  expect(nodes(r.toJSON(), 'RNSVGCircle').length).toBeGreaterThan(0)
  expect(nodes(r.toJSON(), 'RNSVGPath').length).toBeGreaterThan(0)
})
