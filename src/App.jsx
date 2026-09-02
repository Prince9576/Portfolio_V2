import { Suspense, useEffect, useState } from 'react'
import { KeyboardControls, Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Perf } from 'r3f-perf'
import Experience from './components/Experience.jsx'
import CarUI from './components/UI/CarUI.jsx'
import Minimap from './components/UI/Minimap.jsx'
import PortalUI from './components/UI/PortalUI.jsx'
import ShrineUI from './components/UI/ShrineUI.jsx'
import TheatreUI from './components/UI/TheatreUI.jsx'
import TransformUI from './components/UI/TransformUI.jsx'
import StartScreen from './components/UI/StartScreen.jsx'
import { startAmbient } from './stores/ambientMusic.js'
import { initSfx } from './utils/sfx.js'
import { useWeather } from './stores/weatherStore.js'

const keyMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'leftward', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'rightward', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'run', keys: ['ShiftLeft', 'ShiftRight'] },
]

export default function App() {
  const [entered, setEntered] = useState(false)

  const onStart = () => {
    initSfx()
    startAmbient()
    setEntered(true)
  }

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
        >
          {import.meta.env.DEV && <Perf position="top-left" />}
          <Suspense fallback={null}>
            <Physics timeStep="vary" debug={new URLSearchParams(window.location.search).has('debugphysics')}>
              <Experience />
            </Physics>
          </Suspense>
        </Canvas>
      </KeyboardControls>
      <Loader />
      {!entered && <StartScreen onStart={onStart} />}
      <Minimap />
      <ShrineUI />
      <TheatreUI />
      <PortalUI />
      <CarUI />
      <TransformUI />
      <div className="controls-hint">
        <span><b>WASD</b> move</span>
        <span><b>Shift</b> sprint</span>
        <span><b>Space</b> jump</span>
        <span><b>R</b> rain</span>
        <span><b>Drag</b> camera</span>
      </div>
    </>
  )
}
