import { create } from 'zustand'

// R-key thunderstorm toggle.
export const useWeather = create((set) => ({
  storm: false,
  toggle: () => set((s) => ({ storm: !s.storm })),
}))

// Transient 0..1 storm intensity, advanced each frame by SkyAndLight and read
// by Rain — a mutable ref so per-frame updates never re-render React.
export const stormLevel = { value: 0 }
