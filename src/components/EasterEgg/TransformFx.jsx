import { useEffect, useRef, useState } from 'react'
import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getPlayerBody } from '../../stores/playerRef.js'
import { useTransform } from '../../stores/transformStore.js'
import { playSfx } from '../../utils/sfx.js'

const PUFF_DUR = 0.75

export default function TransformFx() {
  const group = useRef()
  const mat = useRef()
  const age = useRef(-1)
  const pos = useRef(new THREE.Vector3())
  const prev = useRef('human')
  const [bursting, setBursting] = useState(false)
  const phase = useTransform((s) => s.phase)

  useEffect(() => {
    const was = prev.current
    prev.current = phase
    const swap =
      (phase === 'monster' && was === 'drunk') || (phase === 'human' && was === 'monster')
    if (!swap) return
    const body = getPlayerBody()
    if (body) {
      const p = body.translation()
      pos.current.set(p.x, p.y - 0.1, p.z)
    }
    age.current = 0
    setBursting(true)
    playSfx('absorb', { gain: 0.95 })
  }, [phase])

  useFrame((_, dt) => {
    if (age.current < 0) return
    age.current += dt
    const k = age.current / PUFF_DUR
    const g = group.current
    if (g) {
      g.position.copy(pos.current)
      g.scale.setScalar(0.3 + k * 2.3)
    }
    if (mat.current) mat.current.opacity = Math.max(0, 0.9 * (1 - k))
    if (k >= 1) {
      age.current = -1
      setBursting(false)
      if (mat.current) mat.current.opacity = 0
    }
  })

  return (
    <group ref={group} scale={0.001}>
      <mesh>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial
          ref={mat}
          color="#ffce6b"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {bursting && <Sparkles count={44} scale={2.6} size={6} speed={1.4} opacity={1} color="#ffd98c" />}
    </group>
  )
}
