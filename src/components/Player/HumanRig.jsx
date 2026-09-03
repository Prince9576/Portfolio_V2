import { useEffect, useRef } from 'react'
import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from 'ecctrl'
import timings from '../../content/animTimings.json'
import { getPlayerBody } from '../../stores/playerRef.js'
import { initSfx, playSfx, playStep } from '../../utils/sfx.js'
import { drinkTune, useTransform } from '../../stores/transformStore.js'

// Run clip travels 1.717m over 0.833s -> sync timeScale to actual velocity so feet never slide
const RUN_CLIP_SPEED = 2.06

// Audio trigger points measured from the rig itself (tools/extract_anim_timings.py): toe ground
const FOOTFALL_PHASES = timings.run.footfallPhases

// True when the loop phase passed a trigger between two frames (wrap-aware)
const crossed = (trigger, from, to) =>
  from <= to ? trigger > from && trigger <= to : trigger > from || trigger <= to

const ONE_SHOT = { Jump: 1.25 }

// Fade-in time per target clip: relaxed into idle.
const FADE = { Jump: 0.12, Run: 0.22, Idle: 0.3 }

// Overture pacing
const DRINK_SECONDS = 4.5
const DRUNK_DWELL_MS = 2200

export default function HumanRig() {
  const group = useRef()
  const { scene, animations } = useGLTF('/models/character.glb')
  const { actions, mixer } = useAnimations(animations, group)

  const curAnimation = useGame((s) => s.curAnimation)
  const initializeAnimationSet = useGame((s) => s.initializeAnimationSet)
  const phase = useTransform((s) => s.phase)
  const toDrunk = useTransform((s) => s.toDrunk)
  const toMonster = useTransform((s) => s.toMonster)
  const curRef = useRef(null)
  const runPhaseRef = useRef(0)
  const lastVyRef = useRef(0)

  useEffect(() => {
    initSfx()
  }, [])

  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        // Skinned bounds don't follow the rig; never cull the player
        o.frustumCulled = false
      }
    })
    // Headless drink-alignment tuning reads bone world positions off this.
    if (import.meta.env.DEV) window.__charScene = scene
  }, [scene])

  // DEV: let the headless tuner freeze the Drink clip on a chosen pose.
  useEffect(() => {
    if (import.meta.env.DEV) { window.__charMixer = mixer; window.__charActions = actions }
  }, [mixer, actions])

  useEffect(() => {
    initializeAnimationSet({
      idle: 'Idle',
      walk: 'Run',
      run: 'Run',
      jump: 'Jump',
      jumpIdle: 'Jump',
      jumpLand: 'Idle',
      fall: 'Jump',
    })
  }, [initializeAnimationSet])

  // Locomotion FSM: crossfade on every curAnimation change — but only while sober & on foot
  useEffect(() => {
    if (phase !== 'human') return
    const name = curAnimation ?? 'Idle'
    const next = actions[name]
    if (!next) return
    const prevName = curRef.current
    curRef.current = name
    if (prevName === name) return

    const fade = FADE[name] ?? 0.2
    if (prevName && actions[prevName]) actions[prevName].fadeOut(fade)
    if (ONE_SHOT[name]) {
      next.setLoop(THREE.LoopOnce, 1)
      next.clampWhenFinished = true
      next.timeScale = ONE_SHOT[name]
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity)
      next.timeScale = 1
    }
    next.reset().fadeIn(fade).play()

    if (name === 'Run') runPhaseRef.current = 0
    if (import.meta.env.DEV) window.__anim = name
  }, [curAnimation, actions, phase])

  // The transformation overture: a paced Drink, then a brief drunk sway
  useEffect(() => {
    if (phase !== 'drinking' && phase !== 'drunk') return
    const isDrink = phase === 'drinking'
    const advance = isDrink ? toDrunk : toMonster
    const name = isDrink ? 'Drink' : 'Drunk'
    const action = actions[name]

    // drinkTune.enabled loops Drink forever, for aligning the mug by eye.
    const tuning = drinkTune.enabled && isDrink

    let timer
    let onFinished
    if (action) {
      const prevName = curRef.current
      if (prevName && actions[prevName]) actions[prevName].fadeOut(0.2)
      curRef.current = name
      action.reset()
      action.clampWhenFinished = true
      if (isDrink && !tuning) {
        // Pace the gulp to ~DRINK_SECONDS no matter the clip's native length
        action.setLoop(THREE.LoopOnce, 1)
        action.timeScale = Math.max(0.6, action.getClip().duration / DRINK_SECONDS)
        onFinished = (e) => {
          if (e.action === action) advance()
        }
        mixer.addEventListener('finished', onFinished)
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.timeScale = 1
      }
      action.fadeIn(0.25).play()
    }

    if (!tuning) {
      // Backstop (and the whole timer for the drunk dwell / missing clips)
      timer = setTimeout(advance, isDrink ? DRINK_SECONDS * 1000 + 600 : DRUNK_DWELL_MS)
    }
    return () => {
      clearTimeout(timer)
      if (onFinished) mixer.removeEventListener('finished', onFinished)
    }
  }, [phase, actions, mixer, toDrunk, toMonster])

  // Foot-slide elimination + frame-accurate footsteps. Idle only.
  useFrame(() => {
    if (phase !== 'human') return
    const cur = curRef.current
    const body = getPlayerBody()

    // Heal a stranded bind/T pose: drei's useAnimations cleanup can stopAllAction on (re)mount
    if (cur === 'Run' && actions.Run && !actions.Run.isRunning()) {
      actions.Run.reset().fadeIn(0.2).play()
    } else if ((cur === null || cur === 'Idle') && actions.Idle && !actions.Idle.isRunning()) {
      curRef.current = 'Idle'
      actions.Idle.reset().fadeIn(0.25).play()
    }

    // Jump sound on the physics takeoff impulse itself
    if (body) {
      const vy = body.linvel().y
      if (vy > 2.5 && lastVyRef.current <= 2.5) playSfx('jump', { gain: 0.5, rateJitter: 0.04 })
      lastVyRef.current = vy
    }

    if (cur === 'Run') {
      const run = actions.Run
      if (!body || !run) return
      const v = body.linvel()
      const speed = Math.hypot(v.x, v.z)
      run.timeScale = THREE.MathUtils.clamp(speed / RUN_CLIP_SPEED, 0.7, 4.0)

      const clipDur = run.getClip().duration
      const phaseT = (run.time % clipDur) / clipDur
      const last = runPhaseRef.current
      runPhaseRef.current = phaseT
      if (speed < 0.6) return
      for (const p of FOOTFALL_PHASES) {
        if (crossed(p, last, phaseT)) playStep({ gain: 0.55 })
      }
    }
  })

  // Model root sits at capsule center; drop it past the capsule bottom plus the 0.25 float gap
  return (
    <group ref={group} position={[0, -1.13, 0]}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/models/character.glb')
