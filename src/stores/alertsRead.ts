import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from './auth'
import { LEGACY_SCOPE, claimLegacy, scopeFor } from '../utils/tenantScope'

type CompanyAlertsRead = { readIds: string[] }

const EMPTY: CompanyAlertsRead = { readIds: [] }

type AlertsRead = CompanyAlertsRead & {
  // Persisted, tenant-namespaced source of truth; readIds above is the active
  // company's slice, projected so consumers keep reading the same field.
  byCompany: Record<string, CompanyAlertsRead>
  scope: string
  markAllRead(ids: string[]): void
  setCompany(companyId: string | null): void
}

const mergeRead = (legacy: CompanyAlertsRead, existing: CompanyAlertsRead | undefined): CompanyAlertsRead =>
  existing ? { readIds: Array.from(new Set([...legacy.readIds, ...existing.readIds])) } : legacy

// Persisted via AsyncStorage (Phase 2 — upgraded from the Phase-1 in-memory
// deviation), namespaced by company (Phase 3 — alert ids are campaign-derived
// and therefore tenant-scoped; a shared bucket would mark another store's
// alerts read). Default state is set synchronously at store creation, so
// consumers reading pre-hydration see an empty array, never undefined, and the
// public interface is unchanged.
export const useAlertsRead = create<AlertsRead>()(
  persist(
    (set, get) => ({
      readIds: [],
      byCompany: {},
      scope: scopeFor(null),

      markAllRead: (ids) => {
        const { scope, byCompany, readIds } = get()
        const next = { readIds: Array.from(new Set([...readIds, ...ids])) }
        set({ ...next, byCompany: { ...byCompany, [scope]: next } })
      },

      setCompany: (companyId) => {
        const scope = scopeFor(companyId)
        const byCompany = claimLegacy(get().byCompany, scope, mergeRead)
        set({ scope, byCompany, readIds: (byCompany[scope] ?? EMPTY).readIds })
      },
    }),
    {
      name: 'testerify.alertsRead',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (s) => ({ byCompany: s.byCompany }),
      migrate: (persisted, version) => {
        if (version === 0) {
          const flat = (persisted ?? {}) as Partial<CompanyAlertsRead>
          return { byCompany: { [LEGACY_SCOPE]: { readIds: flat.readIds ?? [] } } }
        }
        return persisted as { byCompany: Record<string, CompanyAlertsRead> }
      },
      onRehydrateStorage: () => (state) => {
        state?.setCompany(useAuth.getState().company?.id ?? null)
      },
    },
  ),
)

useAuth.subscribe((s, prev) => {
  if (s.company?.id !== prev.company?.id) useAlertsRead.getState().setCompany(s.company?.id ?? null)
})
