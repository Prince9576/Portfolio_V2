import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

// Frames to render once the shaders are linked
const SETTLE_FRAMES = 30

// Never strand the player on a disabled button
const COMPILE_TIMEOUT_MS = 15000

// Sits INSIDE the Suspense boundary that wraps the world
export default function Warmup({ onStage }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  const [compiled, setCompiled] = useState(false)
  const frames = useRef(0)
  const done = useRef(false)
  // Latched so the precompile runs once, not twice under StrictMode
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    onStage?.('compiling')

    // No cleanup flag here on purpose
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      setCompiled(true)
    }
    const watchdog = setTimeout(() => {
      console.warn('[warmup] shader precompile timed out — entering anyway')
      finish()
    }, COMPILE_TIMEOUT_MS)

    // compileAsync walks the whole scene graph and links every material's GPU program up front
    Promise.resolve(gl.compileAsync?.(scene, camera))
      .catch((e) => console.warn('[warmup] shader precompile failed:', e))
      .then(() => {
        clearTimeout(watchdog)
        finish()
      })
  }, [gl, scene, camera, onStage])

  useFrame(() => {
    if (done.current || !compiled) return
    frames.current += 1
    if (frames.current === 1) onStage?.('warming')
    if (frames.current >= SETTLE_FRAMES) {
      done.current = true
      onStage?.('ready')
    }
  })

  return null
}
