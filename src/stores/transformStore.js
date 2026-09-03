import { create } from 'zustand'

// Weekend beer easter egg
export const DRUNK_SECONDS = 30

export const useTransform = create((set, get) => ({
  phase: 'human', // 'human' | 'drinking' | 'drunk' | 'monster'
  near: false, // player within the mug's reach
  timer: 0, // seconds of buzz remaining while monster

  setNear: (near) => set((s) => (s.near === near ? s : { near })),

  // Enter at the mug: only the sober, on-foot character can start drinking.
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

// Where (and which way) the character stands to drink
export const drinkPose = { x: 0, y: 1.2, z: 0, yaw: 0 }

// Drink-alignment knobs
export const drinkTune = {
  enabled: false,
  mugHover: 0.2,
  mugScale: 1.2,
  standBack: 1.57,
  standSide: 0,
  yawDeg: 11.2,
  standY: 1.2,
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__transform = useTransform
  // Headless alignment tuning (tools/tune_drink.mjs) drives the stance + mug knobs through these
  window.__drinkTune = drinkTune
  window.__drinkPose = drinkPose
}
