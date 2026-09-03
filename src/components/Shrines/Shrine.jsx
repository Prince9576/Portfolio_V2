import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getPlayerBody } from '../../stores/playerRef.js'
import { getPhase, useShrine } from '../../stores/shrineStore.js'
import { playSfx } from '../../utils/sfx.js'
import LogoParticles from './LogoParticles.jsx'

// A work-experience shrine bound to one fountain + one company
const HINT_RADIUS = 5.5
const CLOSE_RADIUS = 9.5

// Beacon palette — deep burnt orange welling up out of the ground
const MYTHIC_DEEP = '#8f260b'
const MYTHIC_GLOW = '#ff4d0a'
const MYTHIC_SPARK = '#ffc9ae'

function makeBeamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(MYTHIC_DEEP) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      void main() {
        vUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vViewW = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      void main() {
        vec3 nrm = normalize(vNormalW);
        vec3 viewW = normalize(vViewW);
        float facing = abs(dot(nrm, viewW));
        float vertical = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 2.1);
        float rise = 0.5 + 0.5 * sin(vUv.y * 9.0 - uTime * 2.3);
        float breathe = 0.78 + 0.22 * sin(uTime * 1.6);
        float a = facing * vertical * (0.52 + 0.18 * rise) * breathe;
        a = a == a ? clamp(a, 0.0, 1.0) : 0.0;
        vec3 col = mix(uColor, vec3(0.77, 0.62, 1.0), vertical * 0.55);
        gl_FragColor = vec4(col, a);
      }
    `,
  })
}

function makeGroundMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(MYTHIC_DEEP) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(clamp(smoothstep(1.0, 0.0, d), 0.0, 1.0), 1.7);
        float breathe = 0.75 + 0.25 * sin(uTime * 1.6);
        vec3 col = mix(uColor, vec3(0.8, 0.66, 1.0), smoothstep(0.5, 1.0, a));
        float o = a * 1.05 * breathe;
        o = o == o ? clamp(o, 0.0, 1.0) : 0.0;
        gl_FragColor = vec4(col, o);
      }
    `,
  })
}

export default function Shrine({ company, fountain }) {
  const id = company.id
  const phase = useShrine((s) => s.phases[id] ?? 'idle')
  const setPhase = useShrine((s) => s.setPhase)

  const beamMat = useMemo(() => makeBeamMaterial(), [])
  const groundMat = useMemo(() => makeGroundMaterial(), [])
  const glowRef = useRef()

  // Proximity state machine (with hysteresis so it never flickers)
  useFrame((state) => {
    beamMat.uniforms.uTime.value = state.clock.elapsedTime
    groundMat.uniforms.uTime.value = state.clock.elapsedTime
    if (glowRef.current) {
      glowRef.current.intensity = 2.0 + Math.sin(state.clock.elapsedTime * 1.6) * 0.6
    }
    const body = getPlayerBody()
    if (!body) return
    const p = body.translation()
    const d = Math.hypot(p.x - fountain.x, p.z - fountain.z)
    const cur = getPhase(id)
    if (cur === 'idle' && d <= HINT_RADIUS) setPhase(id, 'hint')
    else if (cur === 'hint' && d > HINT_RADIUS + 1) setPhase(id, 'idle')
    else if (cur === 'open' && d > CLOSE_RADIUS) setPhase(id, 'closing')
  })

  // Enter opens this shrine while its hint is up; Esc closes it
  useEffect(() => {
    const onKey = (e) => {
      const cur = getPhase(id)
      if ((e.code === 'Enter' || e.code === 'NumpadEnter') && cur === 'hint') {
        playSfx('enter', { gain: 0.7 })
        setPhase(id, 'open')
      } else if (e.code === 'Escape' && cur === 'open') {
        setPhase(id, 'closing')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id, setPhase])

  if (!fountain) return null

  const baseY = fountain.y
  const H = Math.max(2, fountain.top - fountain.y)
  const beamH = H + 4.5

  return (
    <group>
      {/* --- the mystical beacon, always alive --- */}
      <mesh
        position={[fountain.x, baseY + 0.14, fountain.z]}
        rotation-x={-Math.PI / 2}
        material={groundMat}
        renderOrder={-1}
      >
        <circleGeometry args={[fountain.r * 1.7, 48]} />
      </mesh>
      <mesh position={[fountain.x, baseY + beamH / 2, fountain.z]} material={beamMat}>
        <cylinderGeometry args={[fountain.r * 0.42, fountain.r * 0.92, beamH, 28, 1, true]} />
      </mesh>
      <Sparkles
        count={80}
        scale={[fountain.r * 2.2, beamH * 0.92, fountain.r * 2.2]}
        position={[fountain.x, baseY + beamH * 0.46, fountain.z]}
        size={3.6}
        speed={0.5}
        opacity={0.95}
        color={MYTHIC_GLOW}
      />
      <Sparkles
        count={46}
        scale={[fountain.r * 2.4, 1.8, fountain.r * 2.4]}
        position={[fountain.x, baseY + 0.7, fountain.z]}
        size={5.2}
        speed={0.75}
        opacity={1}
        color={MYTHIC_SPARK}
      />
      <pointLight
        ref={glowRef}
        position={[fountain.x, baseY + 1.2, fountain.z]}
        color={MYTHIC_GLOW}
        intensity={2}
        distance={12}
        decay={2.1}
      />

      {/* --- the mark itself, summoned on Enter --- */}
      {(phase === 'open' || phase === 'closing') && (
        <Suspense fallback={null}>
          <LogoParticles
            fountain={fountain}
            logo={company.logo}
            closing={phase === 'closing'}
            onClosed={() => setPhase(id, 'idle')}
          />
        </Suspense>
      )}
    </group>
  )
}
