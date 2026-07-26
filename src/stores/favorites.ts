import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AiIdea } from '../api/ai'

type Favorites = {
  pinnedIds: string[]
  savedIdeas: AiIdea[]
  togglePin(id: string): void
  saveIdea(idea: AiIdea): void
  removeIdea(title: string): void
}

// Persisted via AsyncStorage (Phase 2 — closes the Phase-1 in-memory-only
// deviation, see alertsRead.ts). Default state ([], []) is set synchronously
// at store creation, so consumers reading pre-hydration see empty arrays,
// never undefined; persist's hydrate() then merges any on-device data in
// asynchronously once AsyncStorage resolves.
export const useFavorites = create<Favorites>()(
  persist(
    (set, get) => ({
      pinnedIds: [],
      savedIdeas: [],

      togglePin: (id) => {
        const { pinnedIds } = get()
        set({
          pinnedIds: pinnedIds.includes(id) ? pinnedIds.filter((x) => x !== id) : [...pinnedIds, id],
        })
      },

      // Save is idempotent by title, so re-tapping the copilot sheet's save
      // affordance on the same idea updates it in place instead of piling up
      // duplicates.
      saveIdea: (idea) => {
        set({ savedIdeas: [...get().savedIdeas.filter((i) => i.title !== idea.title), idea] })
      },

      removeIdea: (title) => {
        set({ savedIdeas: get().savedIdeas.filter((i) => i.title !== title) })
      },
    }),
    { name: 'testerify.favorites', storage: createJSONStorage(() => AsyncStorage) },
  ),
)
