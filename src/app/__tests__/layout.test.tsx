import { render, screen } from '@testing-library/react-native'

const mockUseFonts = jest.fn()
const mockCaptured: { map: Record<string, unknown>; stackProps: Record<string, unknown> } = { map: {}, stackProps: {} }

jest.mock('@expo-google-fonts/instrument-sans', () => ({
  useFonts: (m: Record<string, unknown>) => { mockCaptured.map = m; return mockUseFonts() },
  InstrumentSans_400Regular: 1, InstrumentSans_500Medium: 2,
  InstrumentSans_600SemiBold: 3, InstrumentSans_700Bold: 4,
}))
jest.mock('@expo-google-fonts/ibm-plex-mono', () => ({
  IBMPlexMono_400Regular: 5, IBMPlexMono_500Medium: 6, IBMPlexMono_600SemiBold: 7,
}))
jest.mock('expo-router', () => {
  const { Text } = require('react-native')
  return {
    Stack: (props: Record<string, unknown>) => {
      mockCaptured.stackProps = props
      return <Text>STACK</Text>
    },
  }
})

import RootLayout from '../_layout'
import { fonts } from '../../theme'

beforeEach(() => { mockUseFonts.mockReset(); mockCaptured.map = {}; mockCaptured.stackProps = {} })

test('renders nothing until fonts load', async () => {
  mockUseFonts.mockReturnValue([false])
  const r = await render(<RootLayout />)
  expect(r.toJSON()).toBeNull()
})

test('renders the navigator once fonts load', async () => {
  mockUseFonts.mockReturnValue([true])
  await render(<RootLayout />)
  expect(screen.getByText('STACK')).toBeTruthy()
})

test('every family named in theme.fonts is actually loaded', async () => {
  mockUseFonts.mockReturnValue([true])
  await render(<RootLayout />)
  const loadedFamilies = Object.keys(mockCaptured.map)
  for (const family of Object.values(fonts)) {
    expect(loadedFamilies).toContain(family)
  }
})

test('hides the default navigator header', async () => {
  mockUseFonts.mockReturnValue([true])
  await render(<RootLayout />)
  expect(mockCaptured.stackProps).toMatchObject({ screenOptions: { headerShown: false } })
})
