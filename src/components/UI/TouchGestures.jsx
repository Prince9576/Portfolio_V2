import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useWeather } from '../../stores/weatherStore.js'

const HOLD_MS = 620 // press and hold this long to flip the weather
const DRAG_SLOP = 14 // movement past this makes it a camera drag, not a tap
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_SLOP = 44

// Every touch gesture in the world shares one surface with ecctrl's camera
// drag, so they are classified in a single place instead of three listeners
// racing each other:
//   drag           -> left alone, ecctrl rotates the camera
//   double tap      -> replays Enter, so all the existing key handlers work
//   press and hold  -> toggles the storm (undocumented, for players to find)
// Listeners are passive and never preventDefault, so ecctrl's own handlers on
// the same canvas keep working untouched.
export default function TouchGestures() {
  const canvas = useThree((s) => s.gl.domElement)

  useEffect(() => {
    if (!canvas) return
    let active = null
    let holdTimer = 0
    let lastTap = null

    const clearHold = () => {
      clearTimeout(holdTimer)
      holdTimer = 0
    }

    const onDown = (e) => {
      // No pointerType filter: this only mounts on coarse-pointer devices, and
      // accepting mouse input keeps the gestures testable in a browser's
      // responsive view (and working on a touchscreen laptop).
      if (active) return // a second finger is a pinch/look, not a gesture
      active = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, held: false }
      clearHold()
      holdTimer = setTimeout(() => {
        if (!active || active.moved) return
        active.held = true // swallow the release so it can't also read as a tap
        useWeather.getState().toggle()
      }, HOLD_MS)
    }

    const onMove = (e) => {
      if (!active || e.pointerId !== active.id) return
      if (Math.hypot(e.clientX - active.x, e.clientY - active.y) > DRAG_SLOP) {
        active.moved = true
        clearHold()
      }
    }

    const onUp = (e) => {
      if (!active || e.pointerId !== active.id) return
      const { x, y, moved, held } = active
      active = null
      clearHold()
      if (moved || held) {
        lastTap = null
        return
      }
      const now = performance.now()
      const near =
        lastTap &&
        now - lastTap.t < DOUBLE_TAP_MS &&
        Math.hypot(x - lastTap.x, y - lastTap.y) < DOUBLE_TAP_SLOP
      if (near) {
        lastTap = null
        // Six components already listen for Enter on window (shrines, portal,
        // theatre door + exit, car, beer mug). Replaying the key reaches all of
        // them without duplicating a single handler.
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter' }))
      } else {
        lastTap = { x, y, t: now }
      }
    }

    const onCancel = () => {
      active = null
      clearHold()
    }

    canvas.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('pointercancel', onCancel, { passive: true })
    return () => {
      clearHold()
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [canvas])

  return null
}
