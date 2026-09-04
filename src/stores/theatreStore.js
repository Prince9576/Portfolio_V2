import { create } from 'zustand'
import { getPlayerBody } from './playerRef.js'
import { playSfx } from '../utils/sfx.js'

// "Project Theatre" — an enterable interior reached through a marked door on the 2nd building
export const THEATRE_CENTER = { x: 400, y: 0.1, z: 400 }
export const ROOM_CEIL = 8 // ceiling height; footprint lives in TheatreRoom
export const ARRIVAL_Z = 4.5 // player lands this far onto the +Z side

// The building's existing entrance we glow, placed by eye
export const doorTune = {
  x: -17.0, // world X of the door
  y: 0.7, // lifted to centre the glow on the door
  z: -37.0, // along the frontage
  yawDeg: 90, // faces +X, toward the street
  glowScale: 0.7, // overall size of the glow/sparkles to fit
  triggerDist: 3.0, // how far out in front the player triggers
}

export const useTheatre = create((set) => ({
  phase: 'idle', // 'idle' | 'hint' | 'inside'
  project: null, // index 0..4 of the open popup, or null
  returnPos: null, // where to drop the player back on exit
  // Latched the first time the player comes anywhere near the door, and never
  // cleared: it mounts the room's interior early so walking in is free. Lives
  // here rather than as component state so it is derived where the phase is
  // set, instead of by an effect reacting to it.
  warm: false,
  setPhase: (phase) => set((s) => ({ phase, warm: s.warm || phase !== 'idle' })),
  openProject: (project) => set({ project }),
  closeProject: () => set({ project: null }),
}))

export const getTheatrePhase = () => useTheatre.getState().phase
export const isInside = () => useTheatre.getState().phase === 'inside'

// Teleport into the theatre, remembering exactly where the player stood so the exit drops them
export function enterTheatre() {
  const body = getPlayerBody()
  if (!body) return
  const p = body.translation()
  body.setTranslation(
    { x: THEATRE_CENTER.x, y: THEATRE_CENTER.y + 1.4, z: THEATRE_CENTER.z + ARRIVAL_Z },
    true,
  )
  body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  playSfx('teleport', { gain: 0.85 })
  useTheatre.setState({ phase: 'inside', warm: true, project: null, returnPos: { x: p.x, y: p.y, z: p.z } })
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
  window.__enterTheatre = enterTheatre
}
