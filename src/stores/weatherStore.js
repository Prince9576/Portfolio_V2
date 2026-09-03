import { create } from 'zustand'

// Thunderstorm toggle: R on desktop, press-and-hold on touch.
export const useWeather = create((set) => ({
  storm: false,
  toggle: () => set((s) => ({ storm: !s.storm })),
}))

// Transient 0..1 storm intensity, advanced each frame by SkyAndLight and read by Rain
export const stormLevel = { value: 0 }

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__weather = useWeather
}
