import { create } from 'zustand'
import { getPlayerBody } from './playerRef.js'
import { playSfx } from '../utils/sfx.js'

export const THEATRE_CENTER = { x: 400, y: 0.1, z: 400 }
export const RING_RADIUS = 9
export const ROOM_HALF = 14
export const ROOM_CEIL = 8

export const doorTune = {
  x: -17.0,
  y: 0.7,
  z: -37.0,
  yawDeg: 90,
  glowScale: 0.7,
  triggerDist: 3.0,
}

export const useTheatre = create((set) => ({
  phase: 'idle',
  project: null,
  returnPos: null,
  setPhase: (phase) => set({ phase }),
  openProject: (project) => set({ project }),
  closeProject: () => set({ project: null }),
}))

export const getTheatrePhase = () => useTheatre.getState().phase
export const isInside = () => useTheatre.getState().phase === 'inside'

export function enterTheatre() {
  const body = getPlayerBody()
  if (!body) return
  const p = body.translation()
  body.setTranslation(
    { x: THEATRE_CENTER.x, y: THEATRE_CENTER.y + 1.4, z: THEATRE_CENTER.z + RING_RADIUS - 1.5 },
    true,
  )
  body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  playSfx('teleport', { gain: 0.85 })
  useTheatre.setState({ phase: 'inside', project: null, returnPos: { x: p.x, y: p.y, z: p.z } })
}

export function exitTheatre() {
  const body = getPlayerBody()
  const yaw = (doorTune.yawDeg * Math.PI) / 180
  const fallback = { x: doorTune.x + Math.sin(yaw) * doorTune.triggerDist, y: 1.4, z: doorTune.z + Math.cos(yaw) * doorTune.triggerDist }
  const rp = useTheatre.getState().returnPos ?? fallback
  if (body) {
    body.setTranslation(rp, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }
  playSfx('teleport', { gain: 0.85 })
  useTheatre.setState({ phase: 'idle', project: null })
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__theatre = useTheatre
}
