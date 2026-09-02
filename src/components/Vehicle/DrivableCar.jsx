import { useEffect, useMemo, useRef } from 'react'
import { Sparkles, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import meta from '../../content/worldMeta.json'
import { getPlayerBody } from '../../stores/playerRef.js'
import { useVehicle } from '../../stores/vehicleStore.js'
import { enterCarMusic, exitCarMusic } from '../../stores/ambientMusic.js'
import { playSfx, setEngine, startEngine, stopEngine } from '../../utils/sfx.js'
import { buildCarVisual, hideCarInstance, pickDrivableCar } from './carSource.js'

// --- Tuning knobs (feel) ---
const MARKER = '#36d6ff' // neon light blue, matches the car
const NEAR_RADIUS = 5 // how close to show the "Enter" hint
const MAX_SPEED = 14 // forward top speed (m/s) — player sprint is ~7
const MAX_REVERSE = 6 // reverse top speed
const ACCEL = 9 // throttle acceleration (m/s²) — ramps up like a real car
const BRAKE = 20 // harder deceleration when reversing the throttle
const COAST_DRAG = 6 // engine braking when you let off the gas
const BOOST_SPEED = 24 // top speed while holding Shift (turbo)
const BOOST_ACCEL = 18 // snappier acceleration during boost
const BOOST_FALLOFF = 10 // how fast you ease back to cruise speed after releasing Shift
const TURN_RATE = 2.3 // steering rate (rad/s) at speed
const FORWARD_SIGN = 1 // flip to -1 if W/Up drives the car backwards
const CAM_DIST = 7.5 // chase camera distance behind the car
const CAM_HEIGHT = 3.2 // chase camera height
const CAM_LERP = 6 // chase camera smoothing

// Crash SFX: read the contact force the solver already computed; gate it so
// gentle scrapes stay quiet and a single bump can't machine-gun the clip.
const CRASH_MIN_FORCE = 80 // ignore contacts below this (nudges, curb scrapes)
const CRASH_MAX_FORCE = 1400 // force mapped to a full-volume hit
// Contact force fires every frame while pressed against a wall, so debounce on the
// *leading edge*: a hit only counts if contact was quiet for CRASH_REARM first, and
// never two within CRASH_MIN_GAP (so a single bouncy crash is one sound, not eight).
const CRASH_REARM = 0.12 // seconds of no contact before a new impact can register
const CRASH_MIN_GAP = 0.45 // hard floor between crash sounds

// Tyre marks: one pooled InstancedMesh (single draw call). Matrices are written
// only while sliding, every MARK_SPACING metres, so density is fps/speed-proof.
const SKID_POOL = 200 // total marks in the ring buffer (~2 trails)
const MARK_SPACING = 0.4 // metres travelled between marks
const MARK_W = 0.18 // tyre-mark width (m)
const MARK_L = 0.5 // tyre-mark length along travel (m)

// Headlights: two shadowless spotlights, on only while driving.
const HEADLIGHT_INTENSITY = 16
const HEADLIGHT_DISTANCE = 26
const HEADLIGHT_ANGLE = 0.52

// Reused scratch objects — there's only one car, so allocating per frame would
// just feed the GC and cause hitches (that exit-lag). Mutate these instead.
const _q = new THREE.Quaternion()
const _fwd = new THREE.Vector3()
const _look = new THREE.Vector3()
const _want = new THREE.Vector3()
const _right = new THREE.Vector3()
// Scratch for tyre-mark placement
const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _scl = new THREE.Vector3()
const _mtx = new THREE.Matrix4()
const _markQ = new THREE.Quaternion()
// Lays a unit plane flat on the ground (its +Y becomes world +Z = travel dir)
const FLAT_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)

const BEAM_H = 5.5 // height of the light pillar rising from the car

// Beacon shaders lifted from the work-experience shrines so the car reads as
// "interactable" the same way — a rising additive light pillar + a ground glow,
// recoloured to the car's neon blue.
function makeBeamMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vNormalW; varying vec3 vViewW;
      void main() {
        vUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vViewW = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor;
      varying vec2 vUv; varying vec3 vNormalW; varying vec3 vViewW;
      void main() {
        float facing = abs(dot(normalize(vNormalW), normalize(vViewW)));
        float vertical = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 2.1);
        float rise = 0.5 + 0.5 * sin(vUv.y * 9.0 - uTime * 2.3);
        float breathe = 0.78 + 0.22 * sin(uTime * 1.6);
        float a = facing * vertical * (0.52 + 0.18 * rise) * breathe;
        a = a == a ? clamp(a, 0.0, 1.0) : 0.0;
        vec3 col = mix(uColor, vec3(0.8, 0.95, 1.0), vertical * 0.55);
        gl_FragColor = vec4(col, a);
      }`,
  })
}

function makeGroundMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(clamp(smoothstep(1.0, 0.0, d), 0.0, 1.0), 1.7);
        float breathe = 0.75 + 0.25 * sin(uTime * 1.6);
        vec3 col = mix(uColor, vec3(0.85, 0.97, 1.0), smoothstep(0.5, 1.0, a));
        float o = a * breathe;
        o = o == o ? clamp(o, 0.0, 1.0) : 0.0;
        gl_FragColor = vec4(col, o);
      }`,
  })
}

export default function DrivableCar() {
  const { scene } = useGLTF('/models/city.glb')
  const pick = useMemo(() => pickDrivableCar(scene), [scene])
  const built = useMemo(() => (pick ? buildCarVisual(pick.parts, pick.index) : null), [pick])

  const phase = useVehicle((s) => s.phase)
  const setPhase = useVehicle((s) => s.setPhase)
  const carBody = useRef(null)
  const keys = useRef({ f: false, b: false, l: false, r: false, boost: false })
  const speedRef = useRef(0)
  const camera = useThree((s) => s.camera)
  const lightRef = useRef(null)

  // Tyre marks (pooled, world-space) + crash-sound cooldown + headlight aim.
  const skidRef = useRef(null)
  const skidWrite = useRef(0) // monotonic counter; index = write % SKID_POOL
  const skidDist = useRef(0) // metres travelled since the last mark
  const lastPos = useRef(new THREE.Vector3())
  const crashAt = useRef(0) // last time a crash sound played
  const contactAt = useRef(0) // last time any qualifying contact fired
  const hlL = useRef(null)
  const hlR = useRef(null)
  const hlTarget = useRef(null)

  const beamMat = useMemo(() => makeBeamMaterial(MARKER), [])
  const groundMat = useMemo(() => makeGroundMaterial(MARKER), [])
  useEffect(() => () => {
    beamMat.dispose()
    groundMat.dispose()
  }, [beamMat, groundMat])

  // Hide the original parked instance so the clone replaces it in place. In an
  // effect (not render) so City's collider pass + our visual build both read the
  // car's real transform first; restored on unmount/HMR.
  useEffect(() => {
    if (!pick) return undefined
    return hideCarInstance(pick.parts, pick.index)
  }, [pick])

  // Driving input — raw window keys. Ecctrl's control is off while driving, so
  // these never fight the character.
  useEffect(() => {
    const set = (e, down) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': keys.current.f = down; break
        case 'KeyS': case 'ArrowDown': keys.current.b = down; break
        case 'KeyA': case 'ArrowLeft': keys.current.l = down; break
        case 'KeyD': case 'ArrowRight': keys.current.r = down; break
        case 'ShiftLeft': case 'ShiftRight': keys.current.boost = down; break
        default: return
      }
    }
    const onDown = (e) => set(e, true)
    const onUp = (e) => set(e, false)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  const enter = () => {
    const pb = getPlayerBody()
    if (!pb || !carBody.current) return
    keys.current = { f: false, b: false, l: false, r: false, boost: false }
    speedRef.current = 0
    skidDist.current = 0
    const t = carBody.current.translation()
    lastPos.current.set(t.x, t.y, t.z) // avoid a huge first-frame delta
    pb.setEnabled(false) // freeze + decollide the character while driving
    setPhase('driving')
    enterCarMusic()
    startEngine() // engine idles immediately, revs with speed (see useFrame)
  }

  const exit = () => {
    const pb = getPlayerBody()
    const cb = carBody.current
    if (!pb || !cb) return
    speedRef.current = 0
    cb.setLinvel({ x: 0, y: 0, z: 0 }, true)
    cb.setAngvel({ x: 0, y: 0, z: 0 }, true)
    // Step out beside the car, wherever it currently is (no teleport-back).
    const q = cb.rotation()
    _right.set(1, 0, 0).applyQuaternion(_q.set(q.x, q.y, q.z, q.w))
    _right.y = 0
    _right.normalize()
    const c = cb.translation()
    pb.setEnabled(true)
    pb.setTranslation({ x: c.x + _right.x * 2.4, y: meta.groundY + 1.4, z: c.z + _right.z * 2.4 }, true)
    pb.setLinvel({ x: 0, y: 0, z: 0 }, true)
    setPhase('idle')
    exitCarMusic()
    stopEngine()
  }

  // Crash sound scaled by impact force. Rapier already computed the contact, so
  // this is just a read + a gated one-shot. Throttled so one bump won't retrigger.
  const onCrash = (payload) => {
    if (useVehicle.getState().phase !== 'driving') return
    // Horizontal force only: resting on the ground is a constant *vertical* normal
    // force — ignoring Y means gravity/road contact never fires, only side impacts.
    const f = payload.totalForce
    const mag = Math.hypot(f.x, f.z)
    if (mag < CRASH_MIN_FORCE) return
    const now = performance.now() / 1000
    const fresh = now - contactAt.current > CRASH_REARM // contact had ended → new impact
    contactAt.current = now
    // Only the leading edge of a contact, and never inside the min-gap window.
    if (!fresh || now - crashAt.current < CRASH_MIN_GAP) return
    crashAt.current = now
    const i = THREE.MathUtils.clamp((mag - CRASH_MIN_FORCE) / (CRASH_MAX_FORCE - CRASH_MIN_FORCE), 0, 1)
    // Louder + lower-pitched the harder you hit.
    playSfx('car_crash', { gain: 0.3 + 0.7 * i, rate: 1.1 - 0.25 * i, rateJitter: 0.05 })
    if (import.meta.env.DEV) window.__lastCrashForce = Math.round(mag)
  }

  // Pooled tyre-mark batch starts empty; aim both headlights at one point ahead.
  useEffect(() => {
    if (skidRef.current) skidRef.current.count = 0
  }, [])
  useEffect(() => {
    const tgt = hlTarget.current
    if (!tgt) return
    if (hlL.current) hlL.current.target = tgt
    if (hlR.current) hlR.current.target = tgt
  }, [phase])

  // Enter to get in/out (same key as shrines/portal); Esc also exits.
  useEffect(() => {
    const onKey = (e) => {
      const cur = useVehicle.getState().phase
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (cur === 'near') enter()
        else if (cur === 'driving') exit()
      } else if (e.code === 'Escape' && cur === 'driving') {
        exit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // enter/exit close over only stable refs + getState, so this binds once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((state, dt) => {
    const cb = carBody.current
    if (!cb) return
    const cur = useVehicle.getState().phase

    if (cur === 'driving') {
      const q = cb.rotation()
      _fwd.set(0, 0, FORWARD_SIGN).applyQuaternion(_q.set(q.x, q.y, q.z, q.w))
      _fwd.y = 0
      _fwd.normalize()

      // Ramped acceleration: hold to build speed, ease off to coast, reverse to brake.
      // Hold Shift to turbo — more accel and a higher cap (forward only).
      const throttle = (keys.current.f ? 1 : 0) - (keys.current.b ? 1 : 0)
      const boosting = keys.current.boost && throttle > 0
      const accel = boosting ? BOOST_ACCEL : ACCEL
      const cap = boosting ? BOOST_SPEED : MAX_SPEED
      let s = speedRef.current
      if (throttle !== 0) {
        const opposing = s !== 0 && Math.sign(throttle) !== Math.sign(s)
        s += throttle * (opposing ? BRAKE : accel) * dt
      } else {
        const drag = COAST_DRAG * dt
        s = Math.abs(s) <= drag ? 0 : s - Math.sign(s) * drag
      }
      // Ease back down to cruise speed after releasing Shift instead of snapping.
      if (s > cap) s = Math.max(cap, s - BOOST_FALLOFF * dt)
      s = THREE.MathUtils.clamp(s, -MAX_REVERSE, BOOST_SPEED)
      speedRef.current = s

      // Engine pitch/volume follow speed (forward or reverse). Audio-thread
      // smoothed, so this per-frame call is essentially free.
      setEngine(Math.abs(s) / MAX_SPEED)

      const v = cb.linvel()
      cb.setLinvel({ x: _fwd.x * s, y: v.y, z: _fwd.z * s }, true)

      // Steer only while rolling; reverse the sense when backing up.
      const steer = (keys.current.l ? 1 : 0) - (keys.current.r ? 1 : 0)
      const grip = THREE.MathUtils.clamp(Math.abs(s) / 2, 0, 1)
      cb.setAngvel({ x: 0, y: steer * TURN_RATE * grip * Math.sign(s), z: 0 }, true)

      const c = cb.translation()

      // Tyre marks while sliding: turbo at speed, hard cornering, or braking.
      const skidding =
        (boosting && Math.abs(s) > 8) ||
        (steer !== 0 && Math.abs(s) > 6) ||
        (throttle < 0 && s > 3)
      const lp = lastPos.current
      const moved = Math.hypot(c.x - lp.x, c.z - lp.z)
      lp.set(c.x, c.y, c.z)
      const skid = skidRef.current
      if (skidding && skid && moved < 5) {
        skidDist.current += moved
        if (skidDist.current >= MARK_SPACING) {
          _markQ.multiplyQuaternions(_q, FLAT_Q) // yaw + lie-flat
          const hx = built.half[0]
          const rearZ = -FORWARD_SIGN * built.half[2] * 0.82
          while (skidDist.current >= MARK_SPACING) {
            skidDist.current -= MARK_SPACING
            for (const sx of [-hx * 0.62, hx * 0.62]) {
              _v.set(sx, 0, rearZ).applyQuaternion(_q)
              _scl.set(MARK_W, MARK_L, 1)
              _mtx.compose(_v2.set(c.x + _v.x, meta.groundY + 0.02, c.z + _v.z), _markQ, _scl)
              skid.setMatrixAt(skidWrite.current % SKID_POOL, _mtx)
              skidWrite.current++
            }
          }
          skid.count = Math.min(skidWrite.current, SKID_POOL)
          skid.instanceMatrix.needsUpdate = true
        }
      } else {
        skidDist.current = MARK_SPACING // first mark of the next slide lands instantly
      }

      // Chase camera locked behind the car.
      _look.set(c.x, c.y + 1, c.z)
      _want.copy(_look).addScaledVector(_fwd, -CAM_DIST)
      _want.y += CAM_HEIGHT
      camera.position.lerp(_want, 1 - Math.exp(-CAM_LERP * dt))
      camera.lookAt(_look)
      return
    }

    // Parked: animate the beacon (pillar + ground glow + breathing light).
    const t = state.clock.elapsedTime
    beamMat.uniforms.uTime.value = t
    groundMat.uniforms.uTime.value = t
    if (lightRef.current) lightRef.current.intensity = 1.8 + Math.sin(t * 1.6) * 0.5

    // Proximity check for the prompt (hysteresis so it never flickers).
    const pb = getPlayerBody()
    if (!pb) return
    const p = pb.translation()
    const c = cb.translation()
    const d = Math.hypot(p.x - c.x, p.z - c.z)
    if (cur === 'idle' && d <= NEAR_RADIUS) setPhase('near')
    else if (cur === 'near' && d > NEAR_RADIUS + 1) setPhase('idle')
  })

  if (!pick || !built) return null
  const { object, half } = built
  const driving = phase === 'driving'

  return (
    <>
      {/* Tyre marks: a single pooled batch in world space (stays put as the car
          drives on). One draw call; instances written only while sliding. */}
      <instancedMesh ref={skidRef} args={[undefined, undefined, SKID_POOL]} frustumCulled={false} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#0a0a0a"
          transparent
          opacity={0.5}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </instancedMesh>

      <RigidBody
        ref={carBody}
        // Solid + immovable while parked (walk around it freely); dynamic to drive.
        type={driving ? 'dynamic' : 'fixed'}
        colliders={false}
        onContactForce={onCrash}
        position={[pick.position.x, meta.groundY + half[1] + 0.04, pick.position.z]}
        rotation={[0, pick.yaw, 0]}
        enabledRotations={[false, true, false]}
        linearDamping={0.8}
        angularDamping={5}
        canSleep={false}
      >
        <CuboidCollider args={[half[0], half[1], half[2]]} />
        <primitive object={object} />

        {/* Headlights: two shadowless spotlights + lamp glints. Kept mounted always
            (intensity 0 when parked) so the lights enter the scene at load — adding
            a new light type later forces a full material recompile, which was the
            hitch on first entry. Glints only show while driving. */}
        <object3D ref={hlTarget} position={[0, -half[1] - 0.4, (half[2] + 9) * FORWARD_SIGN]} />
        <spotLight
          ref={hlL}
          position={[-half[0] * 0.55, -half[1] + 0.55, half[2] * FORWARD_SIGN]}
          angle={HEADLIGHT_ANGLE}
          penumbra={0.5}
          intensity={driving ? HEADLIGHT_INTENSITY : 0}
          distance={HEADLIGHT_DISTANCE}
          decay={2}
          color="#fff3d6"
          castShadow={false}
        />
        <spotLight
          ref={hlR}
          position={[half[0] * 0.55, -half[1] + 0.55, half[2] * FORWARD_SIGN]}
          angle={HEADLIGHT_ANGLE}
          penumbra={0.5}
          intensity={driving ? HEADLIGHT_INTENSITY : 0}
          distance={HEADLIGHT_DISTANCE}
          decay={2}
          color="#fff3d6"
          castShadow={false}
        />
        <mesh visible={driving} position={[-half[0] * 0.55, -half[1] + 0.45, half[2] * FORWARD_SIGN]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#fff6da" toneMapped={false} />
        </mesh>
        <mesh visible={driving} position={[half[0] * 0.55, -half[1] + 0.45, half[2] * FORWARD_SIGN]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#fff6da" toneMapped={false} />
        </mesh>

      {/* Always-on "this car is special" beacon — same shrine vocabulary: a
          rising neon-blue light pillar + ground glow + drifting sparkles +
          breathing light. Hidden the moment you get in; kept mounted so it never
          re-compiles. Slim pillar / tight glow to keep additive overdraw low. */}
      <group visible={!driving}>
        <mesh
          position={[0, -half[1] + 0.06, 0]}
          rotation-x={-Math.PI / 2}
          material={groundMat}
          renderOrder={-1}
        >
          <circleGeometry args={[Math.max(half[0], half[2]) * 1.7, 40]} />
        </mesh>
        <mesh position={[0, -half[1] + BEAM_H / 2, 0]} material={beamMat}>
          <cylinderGeometry args={[half[0] * 0.45, half[0] * 0.95, BEAM_H, 24, 1, true]} />
        </mesh>
        <Sparkles
          count={18}
          scale={[half[0] * 2, BEAM_H * 0.9, half[2] * 1.8]}
          position={[0, half[1] * 1.6, 0]}
          size={2.2}
          speed={0.5}
          opacity={0.85}
          color={MARKER}
        />
        <pointLight ref={lightRef} position={[0, half[1] + 0.8, 0]} color={MARKER} intensity={1.8} distance={9} decay={2} />
      </group>
      </RigidBody>
    </>
  )
}

useGLTF.preload('/models/city.glb')
