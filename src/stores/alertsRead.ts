import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

type AlertsRead = {
  readIds: string[]
  markAllRead(ids: string[]): void
}

// Persisted via AsyncStorage (Phase 2 — closes the Phase-1 in-memory-only
// deviation). Default state ([]) is set synchronously at store creation, so
// consumers reading pre-hydration see an empty array, never undefined; the
// interface is unchanged so existing consumers don't need to change.
export const useAlertsRead = create<AlertsRead>()(
  persist(
    (set, get) => ({
      readIds: [],
      markAllRead: (ids) => set({ readIds: Array.from(new Set([...get().readIds, ...ids])) }),
    }),
    { name: 'testerify.alertsRead', storage: createJSONStorage(() => AsyncStorage) },
  ),
)
