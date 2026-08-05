import { act, cleanup, render, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import Login from '../../app/login'
import { useAuth } from '../../stores/auth'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }))

const TOKEN = 'a3f9c1d4e5b6a7c8d9e0f1a2b3c4d5e6a3f9c1d4e5b6a7c8d9e0f1a2b3c4d5e6'
const realSignIn = useAuth.getState().signIn

afterEach(async () => {
  // See tracking.test.tsx — drain pending work inside act() before teardown.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  useAuth.setState({ status: 'signedOut', user: null, company: null, signIn: realSignIn })
  cleanup()
  jest.clearAllMocks()
})

test('signs in and lands in the app', async () => {
  const signIn = jest.fn().mockResolvedValue(undefined)
  useAuth.setState({ signIn })

  const screen = await render(<Login />)
  const user = userEvent.setup()
  await user.paste(screen.getByTestId('email'), '  alp@x.com ')
  await user.paste(screen.getByTestId('password'), 'longenough')
  // "Sign in" is both the heading and the button label — press the button.
  await user.press(screen.getAllByText('Sign in').at(-1)!)

  await waitFor(() => expect(signIn).toHaveBeenCalledWith('alp@x.com', 'longenough'))
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)'))
})

test('offers the signup route', async () => {
  const screen = await render(<Login />)
  const user = userEvent.setup()
  await user.press(screen.getByText('Create a workspace'))
  expect(router.push).toHaveBeenCalledWith('/register')
})

// Invite links point at the panel (universal links need a paid Apple account),
// so pasting one is how an invited colleague gets into the app.
test('a pasted panel invite link opens the invite route with just the token', async () => {
  const screen = await render(<Login />)
  const user = userEvent.setup()
  await user.press(screen.getByText('Have an invite link?'))

  await user.paste(screen.getByTestId('invite-link'), `https://panel.testerify.com/invite/${TOKEN}?utm_source=email`)
  await user.press(screen.getByText('Open invitation'))

  expect(router.push).toHaveBeenCalledWith({ pathname: '/invite/[token]', params: { token: TOKEN } })
})

test('a link pasted without its token is refused before navigating', async () => {
  const screen = await render(<Login />)
  const user = userEvent.setup()
  await user.press(screen.getByText('Have an invite link?'))

  await user.paste(screen.getByTestId('invite-link'), 'https://panel.testerify.com/invite/')
  await user.press(screen.getByText('Open invitation'))

  await waitFor(() => expect(screen.getByText(/doesn't look like an invite link/)).toBeTruthy())
  expect(router.push).not.toHaveBeenCalled()
})

test('a failed sign-in surfaces the server message', async () => {
  const signIn = jest.fn().mockRejectedValue(new Error('Invalid email or password'))
  useAuth.setState({ signIn })

  const screen = await render(<Login />)
  const user = userEvent.setup()
  await user.paste(screen.getByTestId('email'), 'alp@x.com')
  await user.paste(screen.getByTestId('password'), 'nope')
  // "Sign in" is both the heading and the button label — press the button.
  await user.press(screen.getAllByText('Sign in').at(-1)!)

  await waitFor(() => expect(screen.getByText('Invalid email or password')).toBeTruthy())
})
