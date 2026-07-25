import { create } from 'zustand'

type AlertsRead = {
  readIds: string[]
  markAllRead(ids: string[]): void
}

// In-memory for Phase 1 — persistence (e.g. AsyncStorage) is a Phase 2 nicety.
export const useAlertsRead = create<AlertsRead>((set, get) => ({
  readIds: [],
  markAllRead: (ids) => set({ readIds: Array.from(new Set([...get().readIds, ...ids])) }),
}))
