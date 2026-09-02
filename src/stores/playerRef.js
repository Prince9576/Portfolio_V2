import { createRef } from 'react'

// Ecctrl forwarded ref ({ group, rotateCamera, rotateCharacterOnY }), shared
// so the sun/shadow rig and world systems can follow the player without
// prop-drilling through the scene graph.
export const playerRef = createRef()

// The rapier RigidBody lives behind the ref's `group` getter.
export const getPlayerBody = () => playerRef.current?.group ?? null
