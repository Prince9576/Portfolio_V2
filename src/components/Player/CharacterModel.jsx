import { Suspense } from 'react'
import { useVehicle } from '../../stores/vehicleStore.js'
import { useTransform } from '../../stores/transformStore.js'
import HumanRig from './HumanRig.jsx'
import OrcRig from './OrcRig.jsx'

// One physics capsule, two skins
export default function CharacterModel() {
  const driving = useVehicle((s) => s.phase === 'driving')
  const monster = useTransform((s) => s.phase === 'monster')

  return (
    <>
      {/* Spirit-lantern glow: keeps the character readable in the night city.
          Mounted and visible even while driving, only dimmed to zero — three.js
          bakes the scene's light counts into every material's program cache key,
          so a light going invisible re-links every shader in the city. On iOS
          that reads as a multi-second freeze on the way into the car. */}
      <pointLight position={[0, 0.3, 0.4]} color="#ffc37a" intensity={driving ? 0 : 2.4} distance={7} decay={2} />
      <group visible={!driving}>
        {monster ? (
          <Suspense fallback={null}>
            <OrcRig />
          </Suspense>
        ) : (
          <HumanRig />
        )}
      </group>
    </>
  )
}
