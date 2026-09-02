import { useEffect, useLayoutEffect, useRef } from 'react'
import { Sparkles, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import meta from '../../content/worldMeta.json'
import { getPlayerBody } from '../../stores/playerRef.js'
import { drinkPose, drinkTune, useTransform } from '../../stores/transformStore.js'
import { playSfx } from '../../utils/sfx.js'

const BUS_STAND = { x: 46.94, z: -23.46 }
const MUG_BASE_H = 0.9
const HINT_RADIUS = 3.6
const EXIT_RADIUS = 4.8

const GOLD = '#ffb347'
const GOLD_BRIGHT = '#ffd98c'

export default function BeerMug() {
  const fit = useRef()
  const lightRef = useRef()
  const mats = useRef([])
  const measured = useRef({ h: 0, minY: 0 })
  const { scene } = useGLTF('/models/beer.glb')
  const phase = useTransform((s) => s.phase)
  const lit = phase === 'human'

  useEffect(() => {
    const found = []
    scene.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      const m = o.material
      if (m) {
        m.emissive = new THREE.Color(GOLD)
        if (m.map) m.emissiveMap = m.map
        m.emissiveIntensity = 0.7
        m.needsUpdate = true
        found.push(m)
      }
    })
    mats.current = found
  }, [scene])

  useEffect(() => {
    for (const m of mats.current) m.emissiveIntensity = lit ? 0.7 : 0.05
  }, [lit])

  useLayoutEffect(() => {
    const f = fit.current
    if (!f) return
    f.scale.setScalar(1)
    f.position.set(0, 0, 0)
    f.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(f)
    const h = box.max.y - box.min.y
    if (Number.isFinite(h) && h > 1e-6) measured.current = { h, minY: box.min.y }
  }, [scene])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Enter' && e.code !== 'NumpadEnter') return
      const st = useTransform.getState()
      if (!st.near || st.phase !== 'human') return

      const body = getPlayerBody()
      if (body) {
        const p = body.translation()
        let dx = p.x - BUS_STAND.x
        let dz = p.z - BUS_STAND.z
        let len = Math.hypot(dx, dz)
        if (len < 0.01) {
          dx = 0
          dz = 1
          len = 1
        }
        dx /= len
        dz /= len
        const px = -dz
        const pz = dx
        drinkPose.x = BUS_STAND.x + dx * drinkTune.standBack + px * drinkTune.standSide
        drinkPose.z = BUS_STAND.z + dz * drinkTune.standBack + pz * drinkTune.standSide
        drinkPose.y = drinkTune.standY
        const faceMug = Math.atan2(BUS_STAND.x - drinkPose.x, BUS_STAND.z - drinkPose.z)
        drinkPose.yaw = faceMug + (drinkTune.yawDeg * Math.PI) / 180
      }

      if (st.startDrink()) {
        playSfx('drinking', { gain: 0.85, rateJitter: 0.02 })
        useGLTF.preload('/models/orc.glb')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const f = fit.current
    const me = measured.current
    if (f && me.h) {
      const s = (MUG_BASE_H * drinkTune.mugScale) / me.h
      f.scale.setScalar(s)
      const baseY = drinkTune.mugHover - me.minY * s
      f.rotation.y = t * 0.7
      f.position.y = baseY + Math.sin(t * 1.8) * 0.07
    }
    if (lightRef.current) lightRef.current.intensity = lit ? 2.6 + Math.sin(t * 2.2) * 0.8 : 0

    if (drinkTune.enabled) return

    const body = getPlayerBody()
    if (!body) return
    const { near, phase: ph, setNear } = useTransform.getState()
    if (ph !== 'human') {
      if (near) setNear(false)
      return
    }
    const p = body.translation()
    const d = Math.hypot(p.x - BUS_STAND.x, p.z - BUS_STAND.z)
    if (!near && d <= HINT_RADIUS) setNear(true)
    else if (near && d > EXIT_RADIUS) setNear(false)
  })

  return (
    <group position={[BUS_STAND.x, meta.groundY, BUS_STAND.z]}>
      <group ref={fit}>
        <primitive object={scene} />
      </group>
      <pointLight ref={lightRef} position={[0, 0.7, 0]} color={GOLD} intensity={2.6} distance={9} decay={2} />
      {lit && (
        <>
          <Sparkles count={28} scale={[1.5, 1.8, 1.5]} position={[0, 0.75, 0]} size={4} speed={0.5} opacity={0.9} color={GOLD_BRIGHT} />
          <Sparkles count={14} scale={[2.4, 0.5, 2.4]} position={[0, 0.2, 0]} size={5} speed={0.7} opacity={1} color={GOLD} />
        </>
      )}
    </group>
  )
}

useGLTF.preload('/models/beer.glb')
