import { Suspense, useEffect, useState } from 'react'
import { KeyboardControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
// Dev FPS/draw-call overlay. Uncomment this and the <Perf /> below to bring it back.
// import { Perf } from 'r3f-perf'
import Experience from './components/Experience.jsx'
import CarUI from './components/UI/CarUI.jsx'
import Minimap from './components/UI/Minimap.jsx'
import PortalUI from './components/UI/PortalUI.jsx'
import ShrineUI from './components/UI/ShrineUI.jsx'
import TheatreUI from './components/UI/TheatreUI.jsx'
import TransformUI from './components/UI/TransformUI.jsx'
import StartScreen from './components/UI/StartScreen.jsx'
import TouchControls from './components/UI/TouchControls.jsx'
import TouchGestures from './components/UI/TouchGestures.jsx'
import Warmup from './components/World/Warmup.jsx'
import { startAmbient } from './stores/ambientMusic.js'
import { initSfx } from './utils/sfx.js'
import { useWeather } from './stores/weatherStore.js'
import { useIsTouch } from './utils/device.js'

const keyMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'leftward', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'rightward', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'run', keys: ['ShiftLeft', 'ShiftRight'] },
]

export default function App() {
  // 'loading' -> 'compiling' -> 'warming' -> 'ready'
  const [stage, setStage] = useState('loading')
  const [entered, setEntered] = useState(false)
  const touch = useIsTouch()
  // The cover stays mounted for the length of its fade, then unmounts.
  const [coverGone, setCoverGone] = useState(false)

  // Fetch + decode all the WebAudio samples during the loading screen rather than on the click
  useEffect(() => {
    initSfx()
  }, [])

  // The EXPLORE click is the user gesture browsers require before audio can play.
  const onStart = () => {
    if (stage !== 'ready') return
    initSfx() // no-op if the effect above already ran
    startAmbient()
    // By now the world has been rendering behind the cover for a while: shaders are linked
    setEntered(true)
    setTimeout(() => setCoverGone(true), 420)
  }

  // R toggles the thunderstorm
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'KeyR' && !e.repeat) useWeather.getState().toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <KeyboardControls map={keyMap}>
        <Canvas
          shadows="soft"
          dpr={[1, 1.5]}
          camera={{ position: [0, 3, 8], fov: 45, near: 0.1, far: 300 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          // The loop runs from the very first frame
        >
          {/* {import.meta.env.DEV && <Perf position="top-left" />} */}
          <Suspense fallback={null}>
            <Physics timeStep="vary">
              <Experience />
            </Physics>
            {/* Inside the boundary, so it mounts only once the world's assets
                have resolved — then it precompiles and settles the scene. */}
            {stage !== 'ready' && <Warmup onStage={setStage} />}
            {touch && entered && <TouchGestures />}
          </Suspense>
        </Canvas>
      </KeyboardControls>
      {!coverGone && <StartScreen onStart={onStart} stage={stage} leaving={entered} />}
      {touch && entered && <TouchControls />}
      <Minimap />
      <ShrineUI />
      <TheatreUI />
      <PortalUI />
      <CarUI />
      <TransformUI />
      {/* Keyboard legend only. On touch the stick and button are self-evident,
          and the proximity hints carry the rest. */}
      {!touch && (
        <div className="controls-hint">
          <span><b>WASD</b> move</span>
          <span><b>Shift</b> sprint</span>
          <span><b>Space</b> jump</span>
          <span><b>R</b> rain</span>
          <span><b>Drag</b> camera</span>
        </div>
      )}
    </>
  )
}
