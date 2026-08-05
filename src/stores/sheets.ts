import { create } from 'zustand'

export type SheetState =
  | { kind: 'more' }
  | { kind: 'copilot' }
  | { kind: 'ship'; campaignId: string }
  | { kind: 'storeSwitcher' }
  | null

type Sheets = {
  sheet: SheetState
  openMore(): void
  openCopilot(): void
  openShip(campaignId: string): void
  openStoreSwitcher(): void
  close(): void
}

export const useSheets = create<Sheets>((set) => ({
  sheet: null,
  openMore: () => set({ sheet: { kind: 'more' } }),
  openCopilot: () => set({ sheet: { kind: 'copilot' } }),
  openShip: (campaignId) => set({ sheet: { kind: 'ship', campaignId } }),
  openStoreSwitcher: () => set({ sheet: { kind: 'storeSwitcher' } }),
  close: () => set({ sheet: null }),
}))
