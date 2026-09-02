import { useVehicle } from '../../stores/vehicleStore.js'

// Proximity prompt for the drivable car — reuses the shared shrine-hint HUD chip
// (same "Enter" styling the shrines and portals use).
export default function CarUI() {
  const near = useVehicle((s) => s.phase === 'near')
  return (
    <div className={`shrine-hint ${near ? 'show' : ''}`}>
      <span className="diamond">◈</span>
      <span>
        <span className="key">Enter</span> to drive
      </span>
    </div>
  )
}
