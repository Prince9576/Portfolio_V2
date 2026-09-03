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
    <group visible={!driving}>
      {/* Spirit-lantern glow: keeps the character readable in the night city */}
      <pointLight position={[0, 0.3, 0.4]} color="#ffc37a" intensity={2.4} distance={7} decay={2} />
      {monster ? (
        <Suspense fallback={null}>
          <OrcRig />
        </Suspense>
      ) : (
        <HumanRig />
      )}
    </group>
  )
}
