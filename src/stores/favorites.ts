import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AiIdea } from '../api/ai'
import { useAuth } from './auth'
import { LEGACY_SCOPE, claimLegacy, scopeFor } from '../utils/tenantScope'

export type CompanyFavorites = { pinnedIds: string[]; savedIdeas: AiIdea[] }

const EMPTY: CompanyFavorites = { pinnedIds: [], savedIdeas: [] }

type Favorites = CompanyFavorites & {
  // Persisted, tenant-namespaced source of truth. The flat pinnedIds /
  // savedIdeas above are the active company's slice, projected here so every
  // existing consumer keeps reading the same fields.
  byCompany: Record<string, CompanyFavorites>
  scope: string
  togglePin(id: string): void
  saveIdea(idea: AiIdea): void
  removeIdea(title: string): void
  setCompany(companyId: string | null): void
}

// Adopting pre-namespacing data must never lose whatever the tenant already
// has: pins union, ideas dedupe by title with the newer (current) one winning.
function mergeFavorites(legacy: CompanyFavorites, existing: CompanyFavorites | undefined): CompanyFavorites {
  if (!existing) return legacy
  const titles = new Set(existing.savedIdeas.map((i) => i.title))
  return {
    pinnedIds: Array.from(new Set([...legacy.pinnedIds, ...existing.pinnedIds])),
    savedIdeas: [...legacy.savedIdeas.filter((i) => !titles.has(i.title)), ...existing.savedIdeas],
  }
}

// Persisted via AsyncStorage (Phase 2 — closes the Phase-1 in-memory-only
// deviation, see alertsRead.ts), namespaced by company (Phase 3 — store
// switching re-scopes the session without a re-login). Default state is set
// synchronously at store creation, so consumers reading pre-hydration see
// empty arrays, never undefined; persist's hydrate() then merges any on-device
// data in asynchronously, and setCompany() projects the right tenant's slice
// once the session is restored.
export const useFavorites = create<Favorites>()(
  persist(
    (set, get) => {
      // Every write goes to both the flat projection and the persisted map,
      // so a re-read after a switch can never see the wrong tenant's data.
      const write = (next: CompanyFavorites) => {
        const { scope, byCompany } = get()
        set({ ...next, byCompany: { ...byCompany, [scope]: next } })
      }

      return {
        pinnedIds: [],
        savedIdeas: [],
        byCompany: {},
        scope: scopeFor(null),

        togglePin: (id) => {
          const { pinnedIds, savedIdeas } = get()
          write({
            pinnedIds: pinnedIds.includes(id) ? pinnedIds.filter((x) => x !== id) : [...pinnedIds, id],
            savedIdeas,
          })
        },

        // Save is idempotent by title, so re-tapping the copilot sheet's save
        // affordance on the same idea updates it in place instead of piling up
        // duplicates.
        saveIdea: (idea) => {
          const { pinnedIds, savedIdeas } = get()
          write({ pinnedIds, savedIdeas: [...savedIdeas.filter((i) => i.title !== idea.title), idea] })
        },

        removeIdea: (title) => {
          const { pinnedIds, savedIdeas } = get()
          write({ pinnedIds, savedIdeas: savedIdeas.filter((i) => i.title !== title) })
        },

        // Called on hydration and whenever the active company changes (see the
        // subscription below). Swaps the projected slice; never merges across
        // tenants.
        setCompany: (companyId) => {
          const scope = scopeFor(companyId)
          const byCompany = claimLegacy(get().byCompany, scope, mergeFavorites)
          const slice = byCompany[scope] ?? EMPTY
          set({ scope, byCompany, pinnedIds: slice.pinnedIds, savedIdeas: slice.savedIdeas })
        },
      }
    },
    {
      name: 'testerify.favorites',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Only the map is durable — the flat fields are a view of it.
      partialize: (s) => ({ byCompany: s.byCompany }),
      migrate: (persisted, version) => {
        if (version === 0) {
          const flat = (persisted ?? {}) as Partial<CompanyFavorites>
          return {
            byCompany: {
              [LEGACY_SCOPE]: {
                pinnedIds: flat.pinnedIds ?? [],
                savedIdeas: flat.savedIdeas ?? [],
              },
            },
          }
        }
        return persisted as { byCompany: Record<string, CompanyFavorites> }
      },
      // Hydration lands before the session is restored, so this projects the
      // signed-out bucket; the subscription below re-projects the moment the
      // real company arrives.
      onRehydrateStorage: () => (state) => {
        state?.setCompany(useAuth.getState().company?.id ?? null)
      },
    },
  ),
)

useAuth.subscribe((s, prev) => {
  if (s.company?.id !== prev.company?.id) useFavorites.getState().setCompany(s.company?.id ?? null)
})
