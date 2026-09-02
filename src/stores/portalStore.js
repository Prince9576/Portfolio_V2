import { create } from 'zustand'

export const usePortal = create((set) => ({
  phase: 'idle',
  returnPos: null,
  flash: 0,
  setPhase: (phase) => set({ phase }),
  setReturn: (returnPos) => set({ returnPos }),
  pulse: () => set((s) => ({ flash: s.flash + 1 })),
}))

const ROOF_TOP = 51.7
const DECK = { cx: 35.9, cz: -6.8 }

export const GROUND_PORTAL = { x: 18, y: 0.1, z: -6.8 }
export const ROOF_PORTAL = { x: DECK.cx, y: ROOF_TOP + 0.1, z: 2 }
export const ROOF_LANDING = { x: DECK.cx, y: ROOF_TOP + 1.4, z: -10 }

export const ROOF_BOUNDS = {
  cx: DECK.cx,
  cz: DECK.cz,
  halfX: 4.0,
  halfZ: 11.7,
  top: ROOF_TOP,
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__portal = usePortal
}
