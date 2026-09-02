import { create } from 'zustand'

export const useVehicle = create((set) => ({
  phase: 'idle',
  setPhase: (phase) => set({ phase }),
}))

export const isDriving = () => useVehicle.getState().phase === 'driving'
