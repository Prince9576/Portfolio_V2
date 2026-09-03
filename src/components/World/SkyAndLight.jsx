import { useEffect, useMemo, useRef } from 'react'
import { Environment } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getPlayerBody } from '../../stores/playerRef.js'
import { isInside } from '../../stores/theatreStore.js'
import { stormLevel, useWeather } from '../../stores/weatherStore.js'
import { QUALITY } from '../../utils/quality.js'
import { playSfx, startLoop, stopLoop } from '../../utils/sfx.js'
import GradientSky from './GradientSky.jsx'

// The HDRI is a moonlit night (Kloppenheim 02): full moon, starfield, dark horizon
export const FOG_COLOR = '#141f26'

// Moonlight from high in the east, long soft shadows
export const MOON_OFFSET = new THREE.Vector3(14, 18, 9)

const CLEAR = {
  light: 1.35,
  environment: 0.4,
  fogNear: 20,
  fogFar: 130,
}
const STORM = {
  light: 0.8,
  environment: 0.24,
  fogNear: 12,
  fogFar: 72,
}

// Inside the Project Theatre: a dense, dark warm fog that swallows the far walls and hands
const THEATRE_FOG = new THREE.Color('#140c08')
const THEATRE_FOG_NEAR = 5
const THEATRE_FOG_FAR = 42

const FOG_CLEAR = new THREE.Color(FOG_COLOR)
const FOG_STORM = new THREE.Color('#0c1118')
const FOG_FLASH = new THREE.Color('#9db1d4')
const LIGHT_CLEAR = new THREE.Color('#a9c0ec')
const LIGHT_STORM = new THREE.Color('#8fa6d6')

export default function SkyAndLight() {
  const lightRef = useRef()
  const target = useMemo(() => new THREE.Object3D(), [])
  const storm = useWeather((s) => s.storm)

  // Rain ambience follows the toggle with soft fades
  useEffect(() => {
    if (storm) startLoop('rain', { gain: 0.5, fadeSeconds: 2 })
    else stopLoop('rain', { fadeSeconds: 1.5 })
  }, [storm])

  // Lightning strike scheduler state (plain refs — no re-renders)
  const strike = useRef({ nextAt: 0, startedAt: -1, bursts: [] })
  const thunderTimer = useRef(0)
  useEffect(() => () => clearTimeout(thunderTimer.current), [])

  const fogColor = useMemo(() => new THREE.Color(), [])

  useFrame((state, delta) => {
    const scene = state.scene
    const light = lightRef.current
    if (!light) return

    // Inside the theatre, override the sky/fog: dark purple fog
    if (isInside()) {
      if (scene.fog) {
        scene.fog.color.copy(THEATRE_FOG)
        scene.fog.near = THEATRE_FOG_NEAR
        scene.fog.far = THEATRE_FOG_FAR
      }
      scene.environmentIntensity = 0.05
      light.intensity = 0
      return
    }

    // Shadow rig follows the player so 1024px covers only ±26m
    const body = getPlayerBody()
    if (body) {
      const p = body.translation()
      light.position.set(p.x + MOON_OFFSET.x, p.y + MOON_OFFSET.y, p.z + MOON_OFFSET.z)
      target.position.set(p.x, p.y, p.z)
      target.updateMatrixWorld()
    }

    // Storm intensity eases toward the toggle over ~1.5s
    const k = (stormLevel.value +=
      (Number(storm) - stormLevel.value) * Math.min(1, delta * 1.6))

    // ---- Lightning: random multi-burst flashes while the storm is up ----
    let flash = 0
    const t = state.clock.elapsedTime
    const s = strike.current
    if (k > 0.5) {
      if (s.nextAt === 0) s.nextAt = t + 1.5 + Math.random() * 3
      if (t >= s.nextAt) {
        s.startedAt = t
        const n = 2 + (Math.random() < 0.4 ? 1 : 0)
        s.bursts = Array.from({ length: n }, () => ({
          t0: Math.random() * 0.3,
          dur: 0.05 + Math.random() * 0.09,
          amp: 0.5 + Math.random() * 0.6,
        }))
        s.nextAt = t + 4 + Math.random() * 8
        // Thunder arrives late, like a strike some blocks away
        const delaySeconds = 0.25 + Math.random() * 1.2
        thunderTimer.current = setTimeout(
          () => playSfx('thunder', { gain: Math.max(0.4, 0.95 - delaySeconds * 0.4), rateJitter: 0.12 }),
          delaySeconds * 1000
        )
      }
      if (s.startedAt >= 0) {
        const e = t - s.startedAt
        if (e < 0.7) {
          for (const b of s.bursts) {
            const x = (e - b.t0) / b.dur
            flash += b.amp * Math.exp(-x * x)
          }
        } else {
          s.startedAt = -1
        }
      }
    } else {
      s.nextAt = 0
    }
    flash = Math.min(flash, 1.6)

    // ---- Apply the graded sky/light values imperatively ----
    light.intensity = THREE.MathUtils.lerp(CLEAR.light, STORM.light, k) + flash * 3.2
    light.color.lerpColors(LIGHT_CLEAR, LIGHT_STORM, k)
    scene.environmentIntensity = THREE.MathUtils.lerp(CLEAR.environment, STORM.environment, k)
    if (scene.fog) {
      scene.fog.near = THREE.MathUtils.lerp(CLEAR.fogNear, STORM.fogNear, k)
      scene.fog.far = THREE.MathUtils.lerp(CLEAR.fogFar, STORM.fogFar, k)
      fogColor.lerpColors(FOG_CLEAR, FOG_STORM, k)
      // Sheet lightning glows through the rain haze
      scene.fog.color.copy(fogColor.lerp(FOG_FLASH, Math.min(flash * 0.45, 1)))
    }
  })

  return (
    <>
      {/* HDRI is lighting/reflections only now — the visible sky is GradientSky. */}
      <Environment files="/hdri/sky.exr" environmentIntensity={0.4} />
      <GradientSky />
      <fog attach="fog" args={[FOG_COLOR, CLEAR.fogNear, CLEAR.fogFar]} />

      <primitive object={target} />
      <directionalLight
        ref={lightRef}
        target={target}
        color="#a9c0ec"
        intensity={1.35}
        castShadow
        shadow-mapSize={[QUALITY.shadowMap, QUALITY.shadowMap]}
        shadow-camera-near={2}
        shadow-camera-far={60}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-bias={-0.0003}
        shadow-normalBias={0.04}
      />
      {/* Night ambience: starlit sky from above, asphalt bounce from below */}
      <hemisphereLight args={['#46598a', '#1f2a1c', 0.3]} />
    </>
  )
}
