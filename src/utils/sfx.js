// Game SFX engine on WebAudio: sample-accurate, polyphonic, per-shot pitch and gain variation

const FILES = {
  jump: '/audio/jump.mp3',
  steps: '/audio/steps.mp3',
  rain: '/audio/rain.wav',
  thunder: '/audio/thunder.wav',
  enter: '/audio/enter.mp3',
  absorb: '/audio/absorb.mp3',
  drinking: '/audio/drinking.mp3',
  blast: '/audio/blast.mp3',
  teleport: '/audio/teleport.mp3',
  car: '/audio/car.mp3',
  car_crash: '/audio/car_crash.mp3',
}

const STEP_SLICE_SECONDS = 0.34
const STEP_MIN_GAP_SECONDS = 0.22

let ctx = null
let buffers = {}
let stepSlices = []
let initStarted = false

// Skip leading silence so impacts land exactly on the trigger frame
function leadingSilence(buffer, threshold = 0.02) {
  const data = buffer.getChannelData(0)
  const limit = Math.min(data.length, buffer.sampleRate * 0.6)
  for (let i = 0; i < limit; i++) {
    if (Math.abs(data[i]) > threshold) return Math.max(0, i / buffer.sampleRate - 0.005)
  }
  return 0
}

// Energy-peak onset detection over the long footsteps recording
function detectStepOnsets(buffer) {
  const data = buffer.getChannelData(0)
  const hop = 512
  const win = 1024
  const rms = []
  for (let i = 0; i + win < data.length; i += hop) {
    let sum = 0
    for (let j = i; j < i + win; j += 4) sum += data[j] * data[j]
    rms.push(Math.sqrt(sum / (win / 4)))
  }
  const sorted = [...rms].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const threshold = Math.max(median * 1.9, sorted[Math.floor(sorted.length * 0.97)] * 0.45)

  const minGapHops = Math.ceil((STEP_MIN_GAP_SECONDS * buffer.sampleRate) / hop)
  const onsets = []
  let last = -minGapHops
  for (let i = 2; i < rms.length - 2; i++) {
    const isPeakStart = rms[i] > threshold && rms[i - 1] <= threshold
    if (isPeakStart && i - last >= minGapHops) {
      onsets.push(Math.max(0, (i * hop) / buffer.sampleRate - 0.012))
      last = i
    }
  }
  return onsets
}

export function initSfx() {
  if (initStarted) return
  initStarted = true
  ctx = new (window.AudioContext || window.webkitAudioContext)()

  const resume = () => {
    ctx.resume().catch(() => {})
    if (ctx.state === 'running') {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
  }
  window.addEventListener('pointerdown', resume)
  window.addEventListener('keydown', resume)

  for (const [name, url] of Object.entries(FILES)) {
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((ab) => ctx.decodeAudioData(ab))
      .then((buffer) => {
        buffers[name] = { buffer, offset: leadingSilence(buffer) }
        if (name === 'steps') {
          const onsets = detectStepOnsets(buffer)
          stepSlices = onsets.slice(0, 24).map((t) => ({ buffer, offset: t }))
          if (import.meta.env.DEV) console.info(`[sfx] steps: ${onsets.length} onsets detected`)
        }
      })
      .catch((e) => console.warn(`[sfx] failed to load ${name}:`, e))
  }

  if (import.meta.env.DEV) window.__sfxLog = { step: 0, jump: 0 }
}

function shoot(entry, { gain = 1, rate = 1, duration = null }) {
  if (!ctx || ctx.state !== 'running' || !entry) return
  const src = ctx.createBufferSource()
  src.buffer = entry.buffer
  src.playbackRate.value = rate

  const g = ctx.createGain()
  g.gain.value = gain
  src.connect(g)
  g.connect(ctx.destination)

  const t0 = ctx.currentTime
  if (duration) {
    // short slice: fade the tail out so cuts never click
    g.gain.setValueAtTime(gain, t0 + duration * 0.7)
    g.gain.linearRampToValueAtTime(0, t0 + duration)
    src.start(t0, entry.offset, duration + 0.05)
  } else {
    src.start(t0, entry.offset)
  }
}

const jitter = (range) => 1 + (Math.random() * 2 - 1) * range

export function playSfx(name, { gain = 1, rate = 1, rateJitter = 0.05 } = {}) {
  shoot(buffers[name], { gain: gain * jitter(0.12), rate: rate * jitter(rateJitter) })
  if (import.meta.env.DEV && window.__sfxLog && name in window.__sfxLog) window.__sfxLog[name]++
}

// One-shot you can cut short — used for the absorb "charge" so the blast can cleanly take over
export function playStoppable(name, { gain = 1, rate = 1, rateJitter = 0.05 } = {}) {
  const entry = buffers[name]
  if (!ctx || ctx.state !== 'running' || !entry) return { stop() {} }
  const src = ctx.createBufferSource()
  src.buffer = entry.buffer
  src.playbackRate.value = rate * jitter(rateJitter)
  const g = ctx.createGain()
  g.gain.value = gain * jitter(0.12)
  src.connect(g)
  g.connect(ctx.destination)
  src.start(ctx.currentTime, entry.offset)
  let stopped = false
  return {
    stop(fade = 0.08) {
      if (stopped) return
      stopped = true
      try {
        const t = ctx.currentTime
        g.gain.setValueAtTime(g.gain.value, t)
        g.gain.linearRampToValueAtTime(0, t + fade)
        src.stop(t + fade + 0.02)
      } catch {
        // source already finished — nothing to stop
      }
    },
  }
}

// ---- Looping ambiences (rain etc.) with gain-ramp fades ----
const loops = new Map()

export function startLoop(name, { gain = 0.5, fadeSeconds = 1.5 } = {}) {
  if (!ctx || loops.has(name)) return
  const begin = () => {
    const entry = buffers[name]
    if (!entry || loops.has(name)) return
    const src = ctx.createBufferSource()
    src.buffer = entry.buffer
    src.loop = true
    const g = ctx.createGain()
    g.gain.value = 0
    src.connect(g)
    g.connect(ctx.destination)
    src.start()
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + fadeSeconds)
    loops.set(name, { src, g })
  }
  // The toggle keypress doubles as the unlock gesture; resume may settle async
  if (ctx.state === 'running') begin()
  else ctx.resume().then(begin).catch(() => {})
}

export function stopLoop(name, { fadeSeconds = 1.5 } = {}) {
  const loop = loops.get(name)
  if (!loop) return
  loops.delete(name)
  const t = ctx.currentTime
  loop.g.gain.setValueAtTime(loop.g.gain.value, t)
  loop.g.gain.linearRampToValueAtTime(0, t + fadeSeconds)
  loop.src.stop(t + fadeSeconds + 0.1)
}

// ---- Car engine: a seamless looping buffer whose pitch + volume track speed
const ENGINE_IDLE_RATE = 0.8 // pitch multiplier at a standstill
const ENGINE_MAX_RATE = 1.7 // pitch multiplier at top speed
const ENGINE_IDLE_GAIN = 0.55 // fraction of base volume at a standstill
let engine = null

export function startEngine({ gain = 0.5 } = {}) {
  if (!ctx || ctx.state !== 'running' || engine) return
  const entry = buffers.car
  if (!entry) return // not decoded yet — skip rather than stutter
  const src = ctx.createBufferSource()
  src.buffer = entry.buffer
  src.loop = true
  src.loopStart = entry.offset || 0 // loop the body, skipping any lead-in silence
  src.loopEnd = entry.buffer.duration
  src.playbackRate.value = ENGINE_IDLE_RATE
  const g = ctx.createGain()
  g.gain.value = 0
  src.connect(g)
  g.connect(ctx.destination)
  src.onended = () => {
    try {
      g.disconnect()
    } catch {
      // already disconnected
    }
  }
  src.start(0, entry.offset || 0)
  g.gain.setTargetAtTime(gain * ENGINE_IDLE_GAIN, ctx.currentTime, 0.25) // fade in to idle
  engine = { src, g, base: gain }
}

// norm: 0 (stopped) → 1 (top speed)
export function setEngine(norm) {
  if (!engine || !ctx) return
  const n = norm < 0 ? 0 : norm > 1 ? 1 : norm
  const rate = ENGINE_IDLE_RATE + (ENGINE_MAX_RATE - ENGINE_IDLE_RATE) * n
  const gain = engine.base * (ENGINE_IDLE_GAIN + (1 - ENGINE_IDLE_GAIN) * n)
  const t = ctx.currentTime
  engine.src.playbackRate.setTargetAtTime(rate, t, 0.12)
  engine.g.gain.setTargetAtTime(gain, t, 0.12)
}

export function stopEngine({ fade = 0.35 } = {}) {
  if (!engine || !ctx) return
  const { src, g } = engine
  engine = null
  const t = ctx.currentTime
  g.gain.setTargetAtTime(0, t, fade)
  try {
    src.stop(t + fade * 5 + 0.1) // let the fade finish, then stop
  } catch {
    // already stopped
  }
}

// Vite HMR: close the AudioContext + stop loops/engine on hot-replace
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const loop of loops.values()) {
      try {
        loop.src.stop()
      } catch {
        // already stopped
      }
    }
    loops.clear()
    engine = null
    try {
      ctx?.close()
    } catch {
      // already closed
    }
    ctx = null
    initStarted = false
    buffers = {}
    stepSlices = []
  })
}

let lastStepIndex = -1
export function playStep({ gain = 0.55 } = {}) {
  let entry
  if (stepSlices.length > 1) {
    // random pick, never the same slice twice in a row
    let i
    do {
      i = Math.floor(Math.random() * stepSlices.length)
    } while (i === lastStepIndex)
    lastStepIndex = i
    entry = stepSlices[i]
  } else {
    entry = buffers.steps
  }
  shoot(entry, { gain: gain * jitter(0.18), rate: jitter(0.07), duration: STEP_SLICE_SECONDS })
  if (import.meta.env.DEV && window.__sfxLog) window.__sfxLog.step++
}
