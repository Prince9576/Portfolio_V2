import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Ecctrl from 'ecctrl'
import meta from '../../content/worldMeta.json'
import { getPlayerBody, playerRef } from '../../stores/playerRef.js'
import { useVehicle } from '../../stores/vehicleStore.js'
import { drinkPose, useTransform } from '../../stores/transformStore.js'
import CharacterModel from './CharacterModel.jsx'

const SPAWN = [meta.spawn.x, meta.spawnGroundY + 2, meta.spawn.z]
const ZERO = { x: 0, y: 0, z: 0 }
// Reused each frame so the pin allocates nothing
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()

export default function Player() {
  const driving = useVehicle((s) => s.phase === 'driving')
  // Freeze input while mid-drink so the transformation plays out in place
  const sipping = useTransform((s) => s.phase === 'drinking' || s.phase === 'drunk')

  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__teleport = (x, z) => {
      const body = getPlayerBody()
      if (!body) return
      body.setTranslation({ x, y: meta.groundY + 1.4, z }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }
  }, [])

  useFrame(() => {
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
      capsuleHalfHeight={0.58}
      capsuleRadius={0.3}
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
