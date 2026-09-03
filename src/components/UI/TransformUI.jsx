import { useEffect, useState } from 'react'
import { DRUNK_SECONDS, useTransform } from '../../stores/transformStore.js'
import ActionKey from './ActionKey.jsx'

// DOM overlay for the beer easter egg: the "have a sip" prompt, the morning-after message
const R = 26
const C = 2 * Math.PI * R

export default function TransformUI() {
  const phase = useTransform((s) => s.phase)
  const near = useTransform((s) => s.near)
  const revert = useTransform((s) => s.revert)
  const [secs, setSecs] = useState(DRUNK_SECONDS)
  const [showMsg, setShowMsg] = useState(false)

  const showSip = near && phase === 'human'
  const monster = phase === 'monster'

  // Drive the countdown off a wall clock (rAF) and sober up at zero
  useEffect(() => {
    if (phase !== 'monster') return
    const start = performance.now()
    let raf = 0
    let reset = false
    const tick = () => {
      const left = Math.max(0, DRUNK_SECONDS - (performance.now() - start) / 1000)
      if (!reset) {
        reset = true
        setShowMsg(true)
      }
      setSecs(left)
      useTransform.getState().setTimer(left)
      if (left <= 0) {
        revert()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const msgT = setTimeout(() => setShowMsg(false), 4800)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(msgT)
    }
  }, [phase, revert])

  const progress = secs / DRUNK_SECONDS

  return (
    <>
      <div className={`beer-hint ${showSip ? 'show' : ''}`}>
        <span className="beer-ico">🍺</span>
        <span>
          It&apos;s the weekend — <ActionKey /> to have a sip
        </span>
      </div>

      <div className={`drunk-msg ${showMsg ? 'show' : ''}`}>
        Oops… drinking&apos;s bad for your health.
        <br />
        <b>Look what you&apos;ve done to yourself!</b>
      </div>

      {monster && <div className="drunk-overlay" />}

      <div className={`alco-meter ${monster ? 'show' : ''}`}>
        <div className="alco-ring">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle className="alco-track" cx="32" cy="32" r={R} />
            <circle
              className="alco-fill"
              cx="32"
              cy="32"
              r={R}
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
            />
          </svg>
          <div className="alco-center">
            <span className="alco-ico">🍺</span>
            <span className="alco-secs">{Math.ceil(secs)}</span>
          </div>
        </div>
        <span className="alco-label">Under the influence</span>
      </div>
    </>
  )
}
