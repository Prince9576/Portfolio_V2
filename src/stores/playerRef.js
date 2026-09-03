import { createRef } from 'react'

// Ecctrl forwarded ref ({ group, rotateCamera, rotateCharacterOnY })
export const playerRef = createRef()

// The rapier RigidBody lives behind the ref's `group` getter.
export const getPlayerBody = () => playerRef.current?.group ?? null

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__player = playerRef
}
