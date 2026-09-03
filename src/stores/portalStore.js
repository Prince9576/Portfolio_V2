import { create } from 'zustand'

// Black-hole portal state machine
export const usePortal = create((set) => ({
  phase: 'idle',
  // last ground position, so the roof portal returns the player exactly home
  returnPos: null,
  // bumped on each teleport so the UI can flash a fade without prop drilling
  flash: 0,
  setPhase: (phase) => set({ phase }),
  setReturn: (returnPos) => set({ returnPos }),
  pulse: () => set((s) => ({ flash: s.flash + 1 })),
}))

// Solar-panel building = the Eco_Building_Grid cluster (the "grid" IS the solar array)
const ROOF_TOP = 50.2

// The actual solar-panel DECK (Eco_Building_Grid_3 mesh) is narrower than the building's full
const DECK = { cx: 35.9, cz: -6.8 }

// Ground vortex in the plaza out front; roof vortex on the deck
export const GROUND_PORTAL = { x: 18, y: 0.1, z: -6.8 }
export const ROOF_PORTAL = { x: DECK.cx, y: ROOF_TOP + 0.1, z: 2 }
export const ROOF_LANDING = { x: DECK.cx, y: ROOF_TOP + 1.4, z: -10 }

// Terrace fence: a ring of invisible walls just inside the solar-deck edge so the player stays
export const ROOF_BOUNDS = {
  cx: DECK.cx,
  cz: DECK.cz,
  halfX: 4.0, // deck x∈[31.5,40.3] -> ~4.4 each side
  halfZ: 11.7, // deck z∈[-19.0,5.4] -> ~12.2 each side
  top: ROOF_TOP,
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__portal = usePortal
}
