import { useEffect, useLayoutEffect, useRef } from 'react'
import { useAnimations, useGLTF, useKeyboardControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getPlayerBody } from '../../stores/playerRef.js'
import { playStep } from '../../utils/sfx.js'

const TARGET_H = 3.3
const FEET_Y = -1.13
const WALK_NATURAL = 2.6
const RUN_NATURAL = 6.6
const FADE = { Jumping: 0.12, Run: 0.2, Walking: 0.22, Idle: 0.3 }
const FOOTFALL_PHASES = [0.3, 0.78]

const crossed = (trigger, from, to) =>
  from <= to ? trigger > from && trigger <= to : trigger > from || trigger <= to

function setClip(actions, name, curRef) {
  if (curRef.current === name) return
  const next = actions[name]
  if (!next) return
  const prev = curRef.current
  if (prev && actions[prev]) actions[prev].fadeOut(FADE[name] ?? 0.2)
  next.reset()
  if (name === 'Jumping') {
    next.setLoop(THREE.LoopOnce, 1)
    next.clampWhenFinished = true
  } else {
    next.setLoop(THREE.LoopRepeat, Infinity)
  }
  next.timeScale = 1
  next.fadeIn(FADE[name] ?? 0.2).play()
  curRef.current = name
}

export default function OrcRig() {
  const group = useRef()
  const fit = useRef()
  const { scene, animations } = useGLTF('/models/orc.glb')
  const { actions } = useAnimations(animations, group)

  const [, getKeys] = useKeyboardControls()
  const curRef = useRef(null)
  const runPhaseRef = useRef(0)
  const airborneRef = useRef(0)

  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.frustumCulled = false
      }
    })
  }, [scene])

  // Measure in the rig's own frame (skeleton bones span foot→head; union the
  // mesh bounds for the true sole), then scale to TARGET_H and ground the feet.
  useLayoutEffect(() => {
    const f = fit.current
    if (!f) return
    f.scale.setScalar(1)
    f.position.set(0, 0, 0)
    f.updateWorldMatrix(true, true)
    const inv = new THREE.Matrix4().copy(f.matrixWorld).invert()
    const box = new THREE.Box3()
    const v = new THREE.Vector3()
    const m = new THREE.Matrix4()
    f.traverse((o) => {
      if (o.isBone) {
        o.getWorldPosition(v).applyMatrix4(inv)
        box.expandByPoint(v)
      } else if (o.isMesh && o.geometry) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
        m.multiplyMatrices(inv, o.matrixWorld)
        box.union(o.geometry.boundingBox.clone().applyMatrix4(m))
      }
    })
    const h = box.max.y - box.min.y
    if (!Number.isFinite(h) || h <= 1e-6) return
    const s = TARGET_H / h
    f.scale.setScalar(s)
    f.position.y = FEET_Y - box.min.y * s
    if (import.meta.env.DEV) console.info('[orc] measured h', h.toFixed(4), '→ scale', s.toFixed(2))
  }, [scene])

  useFrame(() => {
    const body = getPlayerBody()
    if (!body) return
    const k = getKeys ? getKeys() : {}
    const moving = !!(k.forward || k.backward || k.leftward || k.rightward)
    const vy = body.linvel().y
    const onGround = body.userData?.canJump !== false
    if (onGround) airborneRef.current = 0
    else airborneRef.current += 1
    // Only a *real* jump shows the jump pose: a clear takeoff velocity, or being
    // airborne for several frames. This ignores the brief not-quite-grounded
    // transient right when the transform hands control back (which otherwise
    // popped the jump pose instead of idle).
    const jumping = vy > 1.5 || airborneRef.current > 6

    let target
    if (jumping) target = 'Jumping'
    else if (moving) target = k.run ? 'Run' : 'Walking'
    else target = 'Idle'

    // Heal a stranded bind/T pose (StrictMode double-mount can stop Idle)
    if (target === 'Idle' && actions.Idle && !actions.Idle.isRunning()) curRef.current = null
    setClip(actions, target, curRef)
    if (import.meta.env.DEV) window.__orcClip = curRef.current

    if (target === 'Run' || target === 'Walking') {
      const act = actions[target]
      if (!act) return
      const v = body.linvel()
      const speed = Math.hypot(v.x, v.z)
      const ref = target === 'Run' ? RUN_NATURAL : WALK_NATURAL
      act.timeScale = THREE.MathUtils.clamp(speed / ref, 0.9, 1.35)
      const clipDur = act.getClip().duration
      const phaseT = (act.time % clipDur) / clipDur
      const last = runPhaseRef.current
      runPhaseRef.current = phaseT
      if (speed < 0.6) return
      // Heavier, lower footfalls for the brute
      for (const p of FOOTFALL_PHASES) {
        if (crossed(p, last, phaseT)) playStep({ gain: 0.7, rate: 0.78 })
      }
    }
  })

  return (
    <group ref={group}>
      <group ref={fit}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

// No module-level preload — the orc stays unfetched until the first transform.
