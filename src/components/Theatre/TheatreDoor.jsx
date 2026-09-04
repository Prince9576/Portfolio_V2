import { useEffect, useMemo, useRef } from 'react'
import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getPlayerBody } from '../../stores/playerRef.js'
import { doorTune, enterTheatre, useTheatre } from '../../stores/theatreStore.js'

// Marks the building's existing entrance as enterable — no fabricated door, just a loud
const HINT_RADIUS = 5
const EXIT_RADIUS = 6.5

const NEON = '#ff4d0a'
const NEON_BRIGHT = '#ffc9ae'
const NEON_SPARK = '#ffddc4'
const RING_COUNT = 3

// Soft-edged aura that washes over the door (radial alpha, gently breathing).
function makeGlowMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(NEON) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        vec2 p = vUv - 0.5;
        float d = length(vec2(p.x * 1.2, p.y));
        float glow = smoothstep(0.5, 0.02, d);
        float breathe = 0.72 + 0.28 * sin(uTime * 2.2);
        float a = glow * 0.85 * breathe;
        a = a == a ? clamp(a, 0.0, 1.0) : 0.0;
        gl_FragColor = vec4(uColor + glow * 0.35, a);
      }
    `,
  })
}

export default function TheatreDoor() {
  const inside = useTheatre((s) => s.phase === 'inside')

  const glowMat = useMemo(() => makeGlowMaterial(), [])
  const lightRef = useRef()
  const ringsRef = useRef()

  // Baked placement from doorTune.
  const yaw = (doorTune.yawDeg * Math.PI) / 180
  const pos = [doorTune.x + Math.sin(yaw) * 0.06, doorTune.y, doorTune.z + Math.cos(yaw) * 0.06]
  // Trigger sits triggerDist out in front of the door, along its facing.
  const trigX = doorTune.x + Math.sin(yaw) * doorTune.triggerDist
  const trigZ = doorTune.z + Math.cos(yaw) * doorTune.triggerDist

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const hidden = useTheatre.getState().phase === 'inside'
    glowMat.uniforms.uTime.value = t
    // Dark, not unmounted, while you're inside — see the light below
    if (lightRef.current) lightRef.current.intensity = hidden ? 0 : 3.4 + Math.sin(t * 2.4) * 1.4

    // Expanding pulse rings on the ground — staggered ripples that read as "go here".
    if (ringsRef.current) {
      const kids = ringsRef.current.children
      for (let i = 0; i < kids.length; i++) {
        const phase = (t * 0.5 + i / kids.length) % 1
        const s = 0.5 + phase * 2.6
        kids[i].scale.set(s, s, s)
        kids[i].material.opacity = (1 - phase) * 0.85
      }
    }

    const st = useTheatre.getState()
    if (st.phase === 'inside') return
    const body = getPlayerBody()
    if (!body) return
    const p = body.translation()
    const d = Math.hypot(p.x - trigX, p.z - trigZ)
    if (st.phase === 'idle' && d <= HINT_RADIUS) st.setPhase('hint')
    else if (st.phase === 'hint' && d > EXIT_RADIUS) st.setPhase('idle')
  })

  useEffect(() => {
    const onKey = (e) => {
      if ((e.code === 'Enter' || e.code === 'NumpadEnter') && useTheatre.getState().phase === 'hint') {
        enterTheatre()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <group position={pos} rotation-y={yaw} scale={doorTune.glowScale}>
      {/* Mounted at all times, dark while you're inside. three.js bakes the
          scene's light counts into every material's program cache key, so
          unmounting a light re-links every shader in the city — a multi-second
          freeze on iOS, which has no parallel shader compile. */}
      <pointLight ref={lightRef} position={[0, 1.9, 1.0]} color={NEON} intensity={0} distance={13} decay={2} />
      {/* Visuals hidden while inside, but never unmounted: drei's Sparkles
          builds its own ShaderMaterial per instance, so remounting it would
          re-link that program too. */}
      <group visible={!inside}>
        {/* soft aura washing over the door */}
        <mesh material={glowMat} position={[0, 1.9, 0.05]}>
          <planeGeometry args={[2.8, 3.9]} />
        </mesh>

        {/* bright threshold pool */}
        <mesh position={[0, 0.05, 0.55]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[1.9, 40]} />
          <meshBasicMaterial color={NEON} transparent opacity={0.42} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>

        {/* expanding pulse rings on the ground */}
        <group ref={ringsRef} position={[0, 0.06, 0.55]} rotation-x={-Math.PI / 2}>
          {Array.from({ length: RING_COUNT }, (_, i) => (
            <mesh key={i}>
              <ringGeometry args={[0.86, 1.0, 48]} />
              <meshBasicMaterial color={NEON_BRIGHT} transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>

        {/* energetic rising sparkles around the doorway */}
        <Sparkles count={80} scale={[2.8, 4.4, 1.6]} position={[0, 2.1, 0.4]} size={4.6} speed={0.9} opacity={1} color={NEON_SPARK} />
      </group>
    </group>
  )
}
