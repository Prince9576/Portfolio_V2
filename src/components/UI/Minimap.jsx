import { useEffect, useRef, useState } from 'react'
import { getPlayerBody } from '../../stores/playerRef.js'
import { useTheatre } from '../../stores/theatreStore.js'
import { useIsTouch } from '../../utils/device.js'

// map.png is a true top-down screenshot of the city, framed exactly to the world footprint
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

// Top-right 2D minimap with a live dot tracking the player
export default function Minimap() {
  const dotRef = useRef(null)
  // The city map is meaningless inside the theatre — and the player is off-map.
  const inside = useTheatre((s) => s.phase === 'inside')
  // On a phone the map starts as a small corner pip and expands on tap, so it
  // isn't eating a chunk of a screen that's already short on room.
  const touch = useIsTouch()
  const [expanded, setExpanded] = useState(false)

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

  const compact = touch && !expanded

  return (
    <div
      className={`minimap${compact ? ' compact' : ''}${touch ? ' tappable' : ''}`}
      aria-hidden={!touch}
      onClick={touch ? () => setExpanded((v) => !v) : undefined}
    >
      <img src="/images/map.png" alt="" draggable="false" />
      <span ref={dotRef} className="minimap-dot" />
    </div>
  )
}
