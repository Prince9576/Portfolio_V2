import { useVehicle } from '../../stores/vehicleStore.js'
import ActionKey from './ActionKey.jsx'

// Proximity prompt for the drivable car, reusing the shared hint chip
export default function CarUI() {
  const near = useVehicle((s) => s.phase === 'near')
  return (
    <div className={`shrine-hint ${near ? 'show' : ''}`}>
      <span className="diamond">◈</span>
      <span>
        <ActionKey /> to drive
      </span>
    </div>
  )
}
