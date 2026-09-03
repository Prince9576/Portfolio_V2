import { useEffect, useRef } from 'react'
import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { getPlayerBody } from '../../stores/playerRef.js'
import BlackHoleOrb from './BlackHoleOrb.jsx'
import {
  GROUND_PORTAL,
  ROOF_BOUNDS,
  ROOF_LANDING,
  ROOF_PORTAL,
  usePortal,
} from '../../stores/portalStore.js'
import { playSfx } from '../../utils/sfx.js'

// Proximity hysteresis (matches the shrine's 5.5 / +1 feel, a touch tighter).
const HINT_RADIUS = 4.5
const EXIT_RADIUS = 6.5

// Cosmic palette — indigo singularity with a hot lilac event horizon.
const PORTAL_GLOW = '#ff4d0a'
const PORTAL_SPARK = '#ffc9ae'

const ORB_LIFT = 1.0 // float the orb to chest height above
const ORB_SIZE = 3.2 // on-screen footprint of the raymarched orb

// A single black-hole orb, reused for the ground and roof portals
function Vortex({ at }) {
  const orb = { x: at.x, y: at.y + ORB_LIFT, z: at.z }
  return (
    <>
      <BlackHoleOrb worldPos={orb} size={ORB_SIZE} glow={PORTAL_GLOW} />
      <group position={[orb.x, orb.y, orb.z]}>
        <Sparkles count={40} scale={[2.4, 2.4, 2.4]} size={4} speed={0.6} opacity={0.9} color={PORTAL_SPARK} />
        <pointLight color={PORTAL_GLOW} intensity={3} distance={9} decay={2} />
      </group>
    </>
  )
}

export default function BlackHolePortal() {
  const phase = usePortal((s) => s.phase)
  const onRoof = phase === 'roof' || phase === 'roofHint'

  // Lift the player to the rooftop, remembering exactly where they stood.
  const ascend = useRef(() => {})
  const descend = useRef(() => {})
  ascend.current = () => {
    const body = getPlayerBody()
    if (!body) return
    const p = body.translation()
    usePortal.getState().setReturn({ x: p.x, y: p.y, z: p.z })
    body.setTranslation(ROOF_LANDING, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    playSfx('teleport', { gain: 0.8 })
    usePortal.getState().pulse()
    usePortal.getState().setPhase('roof')
  }
  descend.current = () => {
    const body = getPlayerBody()
    if (!body) return
    const rp = usePortal.getState().returnPos ?? { x: GROUND_PORTAL.x, y: 1.4, z: GROUND_PORTAL.z }
    body.setTranslation(rp, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    playSfx('teleport', { gain: 0.8 })
    usePortal.getState().pulse()
    usePortal.getState().setPhase('idle')
  }

  // Run the proximity state machine each frame (orb shaders self-animate).
  useFrame(() => {
    const body = getPlayerBody()
    if (!body) return
    const p = body.translation()
    const cur = usePortal.getState().phase
    const target = cur === 'roof' || cur === 'roofHint' ? ROOF_PORTAL : GROUND_PORTAL
    const d = Math.hypot(p.x - target.x, p.z - target.z)

    if (cur === 'idle' && d <= HINT_RADIUS) usePortal.getState().setPhase('hint')
    else if (cur === 'hint' && d > EXIT_RADIUS) usePortal.getState().setPhase('idle')
    else if (cur === 'roof' && d <= HINT_RADIUS) usePortal.getState().setPhase('roofHint')
    else if (cur === 'roofHint' && d > EXIT_RADIUS) usePortal.getState().setPhase('roof')
  })

  // Enter ascends/descends; Esc is a safety descent while on the roof.
  useEffect(() => {
    const onKey = (e) => {
      const cur = usePortal.getState().phase
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (cur === 'hint') ascend.current()
        else if (cur === 'roofHint') descend.current()
      } else if (e.code === 'Escape' && (cur === 'roof' || cur === 'roofHint')) {
        descend.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const b = ROOF_BOUNDS
  const WALL_H = 2 // half-height -> 4 m tall walls
  const WALL_T = 0.25 // half-thickness

  return (
    <group>
      <Vortex at={GROUND_PORTAL} />
      <Vortex at={ROOF_PORTAL} />

      {/* Invisible fence around the terrace edge: only the roof portal gets you
          off the roof. 24 m up and inert while the player is on the ground. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[WALL_T, WALL_H, b.halfZ]} position={[b.cx + b.halfX, b.top + WALL_H, b.cz]} />
        <CuboidCollider args={[WALL_T, WALL_H, b.halfZ]} position={[b.cx - b.halfX, b.top + WALL_H, b.cz]} />
        <CuboidCollider args={[b.halfX, WALL_H, WALL_T]} position={[b.cx, b.top + WALL_H, b.cz + b.halfZ]} />
        <CuboidCollider args={[b.halfX, WALL_H, WALL_T]} position={[b.cx, b.top + WALL_H, b.cz - b.halfZ]} />
      </RigidBody>

      {/* Materialize sparkles at the landing spot while on the roof. */}
      {onRoof && (
        <Sparkles
          count={70}
          scale={[3.5, 3, 3.5]}
          position={[ROOF_LANDING.x, ROOF_BOUNDS.top + 1.6, ROOF_LANDING.z]}
          size={5}
          speed={0.7}
          opacity={1}
          color={PORTAL_SPARK}
        />
      )}
    </group>
  )
}
