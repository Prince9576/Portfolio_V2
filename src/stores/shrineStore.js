import { create } from 'zustand'

export const useShrine = create((set) => ({
  phases: {},
  setPhase: (id, phase) => set((s) => ({ phases: { ...s.phases, [id]: phase } })),
}))

export const getPhase = (id) => useShrine.getState().phases[id] ?? 'idle'

export const landmarks = { fountains: [] }

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__shrine = useShrine
  window.__landmarks = landmarks
}
