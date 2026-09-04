import { useEffect, useRef } from 'react'
import { useJoystickControls } from 'ecctrl'
import { resetTouchStick, touchInput } from '../../stores/touchInput.js'
import { useVehicle } from '../../stores/vehicleStore.js'

// Push past this fraction of the knob's travel to sprint.
const RUN_AT = 0.72

// On-screen controls for touch devices: a thumbstick bottom-left (push to walk,
// push further to sprint) and a jump button bottom-right.
//
// Built as plain DOM on Pointer Events rather than ecctrl's own EcctrlJoystick,
// for two reasons. EcctrlJoystick reads its geometry through a per-render `let`
// that its memoized touchmove handler closes over, so after React re-renders it
// clamps every push to zero and the stick goes dead. It also only listens for
// Touch Events, so it can't be driven by a mouse in a desktop responsive view.
// Ecctrl itself just reads the joystick store each frame — it only needs a
// distance above zero, an angle and a run flag — so we feed that directly.
//
// The same push is also published to `touchInput` as plain -1..1 axes. Ecctrl's
// store is in pixels and is ignored entirely while `disableControl` is set, so
// the car — which is driven by raw key state, not by ecctrl — reads that
// instead. Without it the stick does nothing at all once you're behind a wheel.
export default function TouchControls() {
  const driving = useVehicle((s) => s.phase === 'driving')
  const zoneRef = useRef(null)
  const knobRef = useRef(null)
  const setJoystick = useJoystickControls((s) => s.setJoystick)
  const resetJoystick = useJoystickControls((s) => s.resetJoystick)
  const pressButton1 = useJoystickControls((s) => s.pressButton1)
  const releaseAllButtons = useJoystickControls((s) => s.releaseAllButtons)

  useEffect(() => {
    if (import.meta.env.DEV) window.__joy = useJoystickControls
  }, [])

  useEffect(() => {
    const zone = zoneRef.current
    const knob = knobRef.current
    if (!zone || !knob) return
    let id = null

    const drive = (e) => {
      const r = zone.getBoundingClientRect()
      const cx = r.x + r.width / 2
      const cy = r.y + r.height / 2
      // Travel is measured fresh from the live rect, so an orientation change or
      // a resize can never leave us working from stale geometry.
      const maxDis = (r.width - knob.offsetWidth) / 2
      const dx = e.clientX - cx
      const dy = cy - e.clientY // screen Y grows downward; ecctrl wants Y up
      const dis = Math.min(Math.hypot(dx, dy), maxDis)
      if (dis < 1) {
        knob.style.transform = 'translate(-50%, -50%)'
        resetJoystick()
        resetTouchStick()
        return
      }
      // Vector2.angle() semantics: counter-clockwise from +X, normalised to 0..2pi
      let ang = Math.atan2(dy, dx)
      if (ang < 0) ang += Math.PI * 2
      const kx = Math.cos(ang) * dis
      const ky = Math.sin(ang) * dis
      knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% - ${ky}px))`
      setJoystick(dis, ang, dis > maxDis * RUN_AT)
      touchInput.x = kx / maxDis
      touchInput.y = ky / maxDis
    }

    const onDown = (e) => {
      if (id !== null) return
      id = e.pointerId
      zone.setPointerCapture(e.pointerId) // keep tracking if the thumb slides off
      zone.classList.add('active')
      drive(e)
    }
    const onMove = (e) => {
      if (e.pointerId !== id) return
      drive(e)
    }
    const onUp = (e) => {
      if (e.pointerId !== id) return
      id = null
      zone.classList.remove('active')
      knob.style.transform = 'translate(-50%, -50%)'
      resetJoystick()
      resetTouchStick()
    }

    zone.addEventListener('pointerdown', onDown)
    zone.addEventListener('pointermove', onMove)
    zone.addEventListener('pointerup', onUp)
    zone.addEventListener('pointercancel', onUp)
    return () => {
      zone.removeEventListener('pointerdown', onDown)
      zone.removeEventListener('pointermove', onMove)
      zone.removeEventListener('pointerup', onUp)
      zone.removeEventListener('pointercancel', onUp)
      resetJoystick()
      resetTouchStick()
    }
  }, [setJoystick, resetJoystick])

  return (
    <>
      <div className="tc-stick" ref={zoneRef}>
        <span className="tc-knob" ref={knobRef} />
      </div>
      {/* Jump on foot, turbo behind the wheel — Shift does double duty on a
          keyboard for the same reason, and one button is all the thumb has. */}
      <button
        className="tc-jump"
        aria-label={driving ? 'Turbo' : 'Jump'}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pressButton1()
          touchInput.boost = true
        }}
        onPointerUp={() => {
          releaseAllButtons()
          touchInput.boost = false
        }}
        onPointerCancel={() => {
          releaseAllButtons()
          touchInput.boost = false
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {driving ? (
            <path d="M13 2L5 13h4l-1 9 8-11h-4z" fill="currentColor" />
          ) : (
            <path d="M12 5l6 7h-4v7h-4v-7H6z" fill="currentColor" />
          )}
        </svg>
      </button>
    </>
  )
}
