import { useMemo, useRef } from 'react'
import { Stars } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { stormLevel } from '../../stores/weatherStore.js'
import { FOG_COLOR, MOON_OFFSET } from './SkyAndLight.jsx'

// A themed night sky that replaces the old HDRI background

// Zenith stays themed; horizon is wired to FOG_COLOR at runtime.
const SKY_TOP = '#0a1730' // deep, faintly violet night blue
const SKY_TOP_STORM = '#05080f' // near-black storm zenith
const SKY_BOTTOM_STORM = '#0c1118' // matches FOG_STORM in SkyAndLight
const MOON_TINT = '#cfd9f2' // cool moonlight, just bright enough to halo

// Gradient is tone-mapped by the composer's ACES (same as the fog)
const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform float uOffset;
  uniform float uExponent;
  uniform float uIntensity;
  varying vec3 vDir;
  void main() {
    float t = pow(clamp(vDir.y + uOffset, 0.0, 1.0), uExponent);
    gl_FragColor = vec4(mix(uBottom, uTop, t) * uIntensity, 1.0);
  }
`

// Soft disc: solid core, gentle halo, transparent edge.
const moonVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const moonFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float d = distance(vUv, vec2(0.5)) * 2.0;
    float disc = smoothstep(0.5, 0.42, d);
    float glow = smoothstep(1.0, 0.0, d) * 0.35;
    float a = clamp(disc + glow, 0.0, 1.0);
    gl_FragColor = vec4(uColor * uIntensity, a);
  }
`

export default function GradientSky({ radius = 150, moonDistance = 120, moonSize = 9 }) {
  const groupRef = useRef()
  const skyMatRef = useRef()
  const moonRef = useRef()

  const skyUniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(SKY_TOP) },
      uBottom: { value: new THREE.Color(FOG_COLOR) },
      uOffset: { value: 0.0 },
      uExponent: { value: 0.9 },
      uIntensity: { value: 1.0 },
    }),
    []
  )
  const moonUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(MOON_TINT) },
      uIntensity: { value: 1.0 },
    }),
    []
  )

  // Pre-allocated scratch so the per-frame storm lerp never allocates.
  const topClear = useMemo(() => new THREE.Color(SKY_TOP), [])
  const topStorm = useMemo(() => new THREE.Color(SKY_TOP_STORM), [])
  const botClear = useMemo(() => new THREE.Color(FOG_COLOR), [])
  const botStorm = useMemo(() => new THREE.Color(SKY_BOTTOM_STORM), [])

  // Direction the moon sits in — the same vector the moonlight comes from.
  const moonDir = useMemo(() => MOON_OFFSET.clone().normalize(), [])

  useFrame((state) => {
    const cam = state.camera
    // Keep the dome + stars wrapped around the camera.
    if (groupRef.current) groupRef.current.position.copy(cam.position)

    // Moon hangs at a fixed direction/distance from the camera and faces it.
    if (moonRef.current) {
      moonRef.current.position.copy(cam.position).addScaledVector(moonDir, moonDistance)
      moonRef.current.lookAt(cam.position)
    }

    // Storm mood — driven by the already-eased signal SkyAndLight writes.
    const k = stormLevel.value
    if (skyMatRef.current) {
      const u = skyMatRef.current.uniforms
      u.uTop.value.lerpColors(topClear, topStorm, k)
      u.uBottom.value.lerpColors(botClear, botStorm, k)
      u.uIntensity.value = THREE.MathUtils.lerp(1.0, 0.65, k)
    }
    if (moonRef.current) {
      moonRef.current.material.uniforms.uIntensity.value = THREE.MathUtils.lerp(1.0, 0.55, k)
    }
  })

  return (
    <>
      <group ref={groupRef}>
        <mesh renderOrder={-1000} frustumCulled={false}>
          <sphereGeometry args={[radius, 32, 16]} />
          <shaderMaterial
            ref={skyMatRef}
            side={THREE.BackSide}
            depthWrite={false}
            fog={false}
            uniforms={skyUniforms}
            vertexShader={skyVertex}
            fragmentShader={skyFragment}
          />
        </mesh>

        {/* Calm starfield. radius + depth = 140 < dome (150) < camera far (300).
            drei <Stars> material has fog disabled, so the fog never eats them. */}
        <Stars radius={100} depth={40} count={1400} factor={3} saturation={0} fade speed={0.6} />
      </group>

      <mesh ref={moonRef} frustumCulled={false}>
        <circleGeometry args={[moonSize, 48]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          fog={false}
          side={THREE.DoubleSide}
          uniforms={moonUniforms}
          vertexShader={moonVertex}
          fragmentShader={moonFragment}
        />
      </mesh>
    </>
  )
}
