import { create } from 'zustand'

// Shrine interaction state machine, keyed per company id: idle -> (near) hint -> (Enter) open ->
export const useShrine = create((set) => ({
  phases: {}, // { [companyId]: 'idle' | 'hint' | 'open' |
  setPhase: (id, phase) => set((s) => ({ phases: { ...s.phases, [id]: phase } })),
}))

// Read a single shrine's phase outside React (defaults to idle).
export const getPhase = (id) => useShrine.getState().phases[id] ?? 'idle'

// World landmarks harvested from the city scene at load by City.jsx
export const landmarks = { fountains: [] }

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__shrine = useShrine
  window.__landmarks = landmarks
}
