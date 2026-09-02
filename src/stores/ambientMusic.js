const WIND_URL = '/audio/wind.mp3'
const WIND_VOL = 0.3
const WIND_DUCKED = 0.1
const FADE_MS = 800
const START_FADE_MS = 1200

let wind = null
let started = false

let ducked = false
let resumeWind = false

const fades = new WeakMap()

function fadeTo(el, target, ms = FADE_MS, onDone) {
  if (!el) return
  const prev = fades.get(el)
  if (prev) cancelAnimationFrame(prev)
  const from = el.volume
  if (ms <= 0 || Math.abs(from - target) < 0.001) {
    el.volume = target
    fades.delete(el)
    if (onDone) onDone()
    return
  }
  const start = performance.now()
  const step = (now) => {
    const k = Math.min((now - start) / ms, 1)
    const eased = k * k * (3 - 2 * k)
    el.volume = from + (target - from) * eased
    if (k < 1) {
      fades.set(el, requestAnimationFrame(step))
    } else {
      el.volume = target
      fades.delete(el)
      if (onDone) onDone()
    }
  }
  fades.set(el, requestAnimationFrame(step))
}

function ensure() {
  if (wind) return
  wind = new Audio(WIND_URL)
  wind.loop = true
  wind.volume = 0
  wind.preload = 'auto'
}

export function startAmbient() {
  ensure()
  started = true
  wind.play().catch(() => {})
  fadeTo(wind, WIND_VOL, START_FADE_MS)
}

export function enterCarMusic() {
  ensure()
  if (!started) return
  fadeTo(wind, WIND_DUCKED)
}

export function exitCarMusic() {
  ensure()
  fadeTo(wind, WIND_VOL)
}

export function duckAmbientMusic() {
  ensure()
  if (ducked) return
  ducked = true
  resumeWind = !wind.paused
  if (resumeWind) fadeTo(wind, 0, FADE_MS, () => wind.pause())
}

export function unduckAmbientMusic() {
  ensure()
  if (!ducked) return
  ducked = false
  if (resumeWind) {
    wind.play().catch(() => {})
    fadeTo(wind, WIND_VOL)
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (wind) {
      const f = fades.get(wind)
      if (f) cancelAnimationFrame(f)
      wind.pause()
      wind.src = ''
    }
    wind = null
    started = false
    ducked = false
  })
}
