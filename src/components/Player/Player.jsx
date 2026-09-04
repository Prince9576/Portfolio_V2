import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import Ecctrl from 'ecctrl'
import meta from '../../content/worldMeta.json'
import { getPlayerBody, playerRef } from '../../stores/playerRef.js'
import { useVehicle } from '../../stores/vehicleStore.js'
import { drinkPose, useTransform } from '../../stores/transformStore.js'
import { BOOM_RADIUS, boomDistance, boomEnabled, findEcctrlRig } from '../../utils/cameraBoom.js'
import CharacterModel from './CharacterModel.jsx'

const SPAWN = [meta.spawn.x, meta.spawnGroundY + 2, meta.spawn.z]
const ZERO = { x: 0, y: 0, z: 0 }
// Reused each frame so the pin allocates nothing
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()

const CAPSULE_HALF = 0.58
const CAPSULE_R = 0.3
// Kept in step with camMinDis/camMaxDis on <Ecctrl> below: the arm may fold all
// the way in, and these also identify ecctrl's arm in the scene graph.
const CAM_MIN_DIST = 1.4
const CAM_MAX_DIST = 7
const _desired = new THREE.Vector3()
const _dir = new THREE.Vector3()

export default function Player() {
  const driving = useVehicle((s) => s.phase === 'driving')
  // Freeze input while mid-drink so the transformation plays out in place
  const sipping = useTransform((s) => s.phase === 'drinking' || s.phase === 'drunk')

  // Follow-camera occlusion. ecctrl's own camCollision is left off: it runs a
  // THREE.Raycaster against a flat array of every mesh in the scene, snapshotted
  // once at mount (so it never even sees the city GLB). This casts a small
  // sphere through the physics colliders instead — see cameraBoom.js.
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const rig = useRef(null)
  const { rapier, world } = useRapier()
  const boomShape = useMemo(() => new rapier.Ball(BOOM_RADIUS), [rapier])
  const boomState = useRef({})
  // Only the player's own capsule is ignored; the parked car and the props are
  // exactly the things you don't want the camera to end up inside.
  const boomFilter = useMemo(
    () => (collider) => {
      const body = collider.parent()
      return !body || body.handle !== getPlayerBody()?.handle
    },
    []
  )

  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__teleport = (x, z) => {
      const body = getPlayerBody()
      if (!body) return
      body.setTranslation({ x, y: meta.groundY + 1.4, z }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }
  }, [])

  useFrame((state, dt) => {
    const body = getPlayerBody()
    if (!body) return

    // While sipping, ecctrl bails out early (disableControl) and stops holding the capsule up
    const phase = useTransform.getState().phase
    if (phase === 'drinking' || phase === 'drunk') {
      body.setTranslation({ x: drinkPose.x, y: drinkPose.y, z: drinkPose.z }, true)
      _q.setFromEuler(_e.set(0, drinkPose.yaw, 0))
      body.setRotation(_q, true)
      body.setLinvel(ZERO, true)
      body.setAngvel(ZERO, true)
      return
    }

    if (import.meta.env.DEV) window.__playerPos = body.translation()
    // Safety net: teleport back to spawn if the player ever leaves the world
    if (body.translation().y < meta.surface.min - 10) {
      body.setTranslation({ x: SPAWN[0], y: SPAWN[1], z: SPAWN[2] }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }

    // The car owns the camera while driving, and runs its own boom.
    if (useVehicle.getState().phase === 'driving') {
      boomState.current.dist = undefined // don't carry a stale arm out of the car
      return
    }

    // This callback subscribes after <Ecctrl>'s (children subscribe first at the
    // same priority), so the camera has already been placed for this frame and
    // the arm can be shortened in place. Left alone entirely when nothing is in
    // the way, so the default feel is untouched.
    if (!boomEnabled.value) return
    if (!rig.current) {
      rig.current = findEcctrlRig(scene, CAM_MIN_DIST, CAM_MAX_DIST)
      if (!rig.current) return
    }
    const { pivot, followCam } = rig.current

    // The arm, read from ecctrl's own rig rather than off the camera: `pivot` is
    // the look target it already smooths, and `followCam` sits at the arm's
    // unoccluded length. Deriving either from camera.position instead feeds this
    // boom's output back into its input, and the smoothing lag alone then looks
    // like an occluder — the camera ends up "corrected" in open street, aimed at
    // the raw capsule position, which the float spring wobbles after a jump.
    followCam.getWorldPosition(_desired)
    _dir.copy(_desired).sub(pivot.position)
    const free = _dir.length()
    if (free < 1e-4) return
    _dir.divideScalar(free)
    const arm = boomDistance({
      world,
      shape: boomShape,
      origin: pivot.position,
      dir: _dir,
      dist: free,
      minDist: CAM_MIN_DIST,
      exclude: boomFilter,
      state: boomState.current,
      dt,
    })
    if (import.meta.env.DEV) window.__arm = { arm, free, raw: boomState.current.raw }
    // Nothing in the way (and nothing left to ease back out) means the camera is
    // not touched at all — ecctrl's feel is then bit-for-bit what it always was.
    if (arm < free - 0.01) {
      camera.position.copy(pivot.position).addScaledVector(_dir, arm)
      camera.lookAt(pivot.position)
    }
  })

  return (
    <Ecctrl
      ref={playerRef}
      animated
      // While driving, hand the camera + input to the car
      disableControl={driving || sipping}
      disableFollowCam={driving}
      position={SPAWN}
      ccd
      capsuleHalfHeight={CAPSULE_HALF}
      capsuleRadius={CAPSULE_R}
      floatHeight={0.25}
      maxVelLimit={4}
      sprintMult={1.8}
      jumpVel={4}
      camInitDis={-4.2}
      camMaxDis={-7}
      camMinDis={-1.4}
      camInitDir={{ x: -0.12, y: meta.spawn.face }}
      characterInitDir={meta.spawn.face}
      // Clamp the upward tilt so looking at the sky can't swing the camera arm below the ground
      camLowLimit={-0.6}
      // Replaced by the rapier-based boom above
      camCollision={false}
      camTargetPos={{ x: 0, y: 0.6, z: 0 }}
      camMoveSpeed={1.4}
      camZoomSpeed={1.2}
      turnSpeed={18}
    >
      <CharacterModel />
    </Ecctrl>
  )
}
