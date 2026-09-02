import { useEffect, useRef } from 'react'
import { getPlayerBody } from '../../stores/playerRef.js'
import { useTheatre } from '../../stores/theatreStore.js'

// map.png is a true top-down screenshot of the city, framed exactly to the
// world footprint. The shot is rotated relative to the axes: world Z runs
// horizontally (+Z → right) and world X runs vertically (+X → top). Verified
// against the twisted tower (x30,z46 → top-right) and the two plaza fountains
// (x-12.6, z-15.3 / z30.2 → the orange & cyan rings mid-band). No insets.
const MIN_X = -60
const MAX_X = 60
const MIN_Z = -75
const MAX_Z = 75

function project(x, z) {
  const left = ((z - MIN_Z) / (MAX_Z - MIN_Z)) * 100
  const top = ((MAX_X - x) / (MAX_X - MIN_X)) * 100
  return {
    left: Math.min(100, Math.max(0, left)),
    top: Math.min(100, Math.max(0, top)),
  }
}

// Top-right 2D minimap with a live dot tracking the player. Lives outside the
// Canvas, so we poll the shared rapier body via rAF and mutate the dot's
// transform directly — no per-frame React render.
export default function Minimap() {
  const dotRef = useRef(null)
  // The city map is meaningless inside the theatre — and the player is off-map.
  const inside = useTheatre((s) => s.phase === 'inside')

  useEffect(() => {
    let raf
    const tick = () => {
      const body = getPlayerBody()
      const dot = dotRef.current
      if (body && dot) {
        const { x, z } = body.translation()
        const { left, top } = project(x, z)
        dot.style.left = `${left}%`
        dot.style.top = `${top}%`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  if (inside) return null

  return (
    <div className="minimap" aria-hidden="true">
      <img src="/images/map.png" alt="" draggable="false" />
      <span ref={dotRef} className="minimap-dot" />
    </div>
  )
}
