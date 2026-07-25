import { create } from 'zustand'

type Toast = { message: string | null; show(message: string): void }
let timer: ReturnType<typeof setTimeout> | null = null

export const useToast = create<Toast>((set) => ({
  message: null,
  show(message) {
    if (timer) clearTimeout(timer)
    set({ message })
    timer = setTimeout(() => set({ message: null }), 4200)
  },
}))
