import { act, cleanup, render, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { RegisterScreen } from '../Register'
import { useAuth } from '../../stores/auth'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }))

const realSignUp = useAuth.getState().signUp

afterEach(async () => {
  // See tracking.test.tsx — drain pending work inside act() before teardown.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  useAuth.setState({ status: 'signedOut', user: null, company: null, signUp: realSignUp })
  cleanup()
  jest.clearAllMocks()
})

// userEvent (not fireEvent): concurrent rendering applies controlled-input
// state async, and the submit button is gated on those fields — userEvent's
// managed act keeps them in sync without hand-rolled act() flushes.
const fill = async (screen: ReturnType<typeof render> extends Promise<infer T> ? T : never, values: {
  companyName?: string; name?: string; email?: string; password?: string
}) => {
  const user = userEvent.setup()
  if (values.companyName !== undefined) await user.paste(screen.getByTestId('companyName'), values.companyName)
  if (values.name !== undefined) await user.paste(screen.getByTestId('name'), values.name)
  if (values.email !== undefined) await user.paste(screen.getByTestId('email'), values.email)
  if (values.password !== undefined) await user.paste(screen.getByTestId('password'), values.password)
  return user
}

test('creates the workspace with trimmed fields, then lands in the app', async () => {
  const signUp = jest.fn().mockResolvedValue(undefined)
  useAuth.setState({ signUp })

  const screen = await render(<RegisterScreen />)
  const user = await fill(screen, {
    companyName: '  Alder & Ash  ', name: '  Alp  ', email: '  alp@x.com  ', password: 'longenough',
  })
  await user.press(screen.getByText('Create workspace'))

  await waitFor(() => expect(signUp).toHaveBeenCalledWith('Alder & Ash', 'Alp', 'alp@x.com', 'longenough'))
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)'))
})

test('a short password is caught before the round-trip', async () => {
  const signUp = jest.fn().mockResolvedValue(undefined)
  useAuth.setState({ signUp })

  const screen = await render(<RegisterScreen />)
  const user = await fill(screen, { companyName: 'Alder', name: 'Alp', email: 'alp@x.com', password: 'short' })
  await user.press(screen.getByText('Create workspace'))

  await waitFor(() => expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy())
  expect(signUp).not.toHaveBeenCalled()
  expect(router.replace).not.toHaveBeenCalled()
})

test('a taken email surfaces the server message and stays on the form', async () => {
  const signUp = jest.fn().mockRejectedValue(new Error('Email already registered'))
  useAuth.setState({ signUp })

  const screen = await render(<RegisterScreen />)
  const user = await fill(screen, { companyName: 'Alder', name: 'Alp', email: 'taken@x.com', password: 'longenough' })
  await user.press(screen.getByText('Create workspace'))

  await waitFor(() => expect(screen.getByText('Email already registered')).toBeTruthy())
  expect(router.replace).not.toHaveBeenCalled()
  expect(screen.getByText('Create workspace')).toBeTruthy()
})

test('the submit stays inert until every field has something in it', async () => {
  const signUp = jest.fn().mockResolvedValue(undefined)
  useAuth.setState({ signUp })

  const screen = await render(<RegisterScreen />)
  const user = await fill(screen, { companyName: 'Alder', password: 'longenough' })
  await user.press(screen.getByText('Create workspace'))

  expect(signUp).not.toHaveBeenCalled()
})

test('offers a way back to sign in', async () => {
  const screen = await render(<RegisterScreen />)
  const user = userEvent.setup()
  await user.press(screen.getByText('Already have an account? Sign in'))
  expect(router.replace).toHaveBeenCalledWith('/login')
})
