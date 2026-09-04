import { useEffect, useRef, useState } from 'react'
import { getPlayerBody } from '../../stores/playerRef.js'
import { useTheatre } from '../../stores/theatreStore.js'
import { useIsTouch } from '../../utils/device.js'

// map.png is a true top-down screenshot of the city, framed exactly to the world footprint
const MAP_URL = '/images/map.png'
const IDLE_TIMEOUT = 3000 // ms before we stop waiting for an idle gap
const FALLBACK_DELAY = 800 // ms, where requestIdleCallback isn't available

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

// Top-right 2D minimap with a live dot tracking the player.
//
// The map image is ~900KB and is the single largest file the page pulls, but
// nobody needs it until they're walking around — so it is not fetched until
// `ready` (the Explore click), and then only in an idle gap. Decoding is the
// part that could actually hurt: dropping a PNG that size straight into the DOM
// decodes it on the main thread during paint, which is a dropped frame while the
// player is moving. `img.decode()` does that work off-thread and resolves when
// the bitmap is ready, so by the time the <img> is rendered the browser has
// nothing left to do but composite it. Until then the frame sits there empty
// with the dot still tracking, and the map fades in when it arrives.
export default function Minimap({ ready = false }) {
  const dotRef = useRef(null)
  const [mapSrc, setMapSrc] = useState(null)
  // The city map is meaningless inside the theatre — and the player is off-map.
  const inside = useTheatre((s) => s.phase === 'inside')
  // On a phone the map starts as a small corner pip and expands on tap, so it
  // isn't eating a chunk of a screen that's already short on room.
  const touch = useIsTouch()
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!ready || mapSrc) return undefined
    let alive = true
    let idle = 0
    let timer = 0

    const fetchMap = () => {
      const img = new Image()
      img.decoding = 'async'
      const show = () => {
        if (alive) setMapSrc(MAP_URL)
      }
      img.src = MAP_URL
      if (img.decode) {
        // Either outcome means "stop waiting": on failure the browser will just
        // decode it the usual way when the element renders.
        img.decode().then(show, show)
      } else {
        img.onload = show
        img.onerror = show
      }
    }

    if (typeof requestIdleCallback === 'function') {
      idle = requestIdleCallback(fetchMap, { timeout: IDLE_TIMEOUT })
    } else {
      timer = setTimeout(fetchMap, FALLBACK_DELAY)
    }
    return () => {
      alive = false
      if (idle) cancelIdleCallback(idle)
      if (timer) clearTimeout(timer)
    }
  }, [ready, mapSrc])

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
      {mapSrc && <img src={mapSrc} alt="" draggable="false" decoding="async" />}
      <span ref={dotRef} className="minimap-dot" />
    </div>
  )
}
