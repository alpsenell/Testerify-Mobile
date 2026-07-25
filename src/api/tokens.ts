import * as SecureStore from 'expo-secure-store'

const ACCESS = 'testerify.access'
const REFRESH = 'testerify.refresh'

export type TokenPair = { access: string; refresh: string }

export async function getTokens(): Promise<TokenPair | null> {
  const [access, refresh] = await Promise.all([SecureStore.getItemAsync(ACCESS), SecureStore.getItemAsync(REFRESH)])
  return access && refresh ? { access, refresh } : null
}
export async function setTokens(t: TokenPair): Promise<void> {
  await Promise.all([SecureStore.setItemAsync(ACCESS, t.access), SecureStore.setItemAsync(REFRESH, t.refresh)])
}
export async function clearTokens(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH)])
}
