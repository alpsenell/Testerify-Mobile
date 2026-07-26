import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const ACCESS = 'testerify.access'
const REFRESH = 'testerify.refresh'

// expo-secure-store has no web implementation. The web build is a dev-only
// preview (Phase 1 ships iOS/Android), so tokens fall back to localStorage
// there. Revisit before ever treating web as a production surface.
type TokenStore = {
  getItemAsync(key: string): Promise<string | null>
  setItemAsync(key: string, value: string): Promise<void>
  deleteItemAsync(key: string): Promise<void>
}

const webStore: TokenStore = {
  async getItemAsync(key) {
    return globalThis.localStorage?.getItem(key) ?? null
  },
  async setItemAsync(key, value) {
    globalThis.localStorage?.setItem(key, value)
  },
  async deleteItemAsync(key) {
    globalThis.localStorage?.removeItem(key)
  },
}

const store: TokenStore = Platform.OS === 'web' ? webStore : SecureStore

export type TokenPair = { access: string; refresh: string }

export async function getTokens(): Promise<TokenPair | null> {
  const [access, refresh] = await Promise.all([store.getItemAsync(ACCESS), store.getItemAsync(REFRESH)])
  return access && refresh ? { access, refresh } : null
}
export async function setTokens(t: TokenPair): Promise<void> {
  await Promise.all([store.setItemAsync(ACCESS, t.access), store.setItemAsync(REFRESH, t.refresh)])
}
export async function clearTokens(): Promise<void> {
  await Promise.all([store.deleteItemAsync(ACCESS), store.deleteItemAsync(REFRESH)])
}
