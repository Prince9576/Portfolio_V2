import { create } from 'zustand'

export const DRUNK_SECONDS = 30

export const useTransform = create((set, get) => ({
  phase: 'human',
  near: false,
  timer: 0,

  setNear: (near) => set((s) => (s.near === near ? s : { near })),

  startDrink: () => {
    if (get().phase !== 'human') return false
    set({ phase: 'drinking' })
    return true
  },
  toDrunk: () => set((s) => (s.phase === 'drinking' ? { phase: 'drunk' } : s)),
  toMonster: () => set((s) => (s.phase === 'drunk' ? { phase: 'monster', timer: DRUNK_SECONDS } : s)),
  setTimer: (timer) => set({ timer }),
  revert: () => set((s) => (s.phase === 'monster' ? { phase: 'human', timer: 0 } : s)),
}))

export const getTransformPhase = () => useTransform.getState().phase

export const drinkPose = { x: 0, y: 1.2, z: 0, yaw: 0 }

export const drinkTune = {
  enabled: false,
  mugHover: 0.15,
  mugScale: 1,
  standBack: 1.0,
  standSide: 0,
  yawDeg: 0,
  standY: 1.2,
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__transform = useTransform
}
