import { useEffect, useMemo, useRef } from 'react'
import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { getPlayerBody } from '../../stores/playerRef.js'
import { PROJECTS } from '../../content/projects.js'
import {
  exitTheatre,
  RING_RADIUS,
  ROOM_CEIL,
  ROOM_HALF,
  THEATRE_CENTER,
  useTheatre,
} from '../../stores/theatreStore.js'
import { makeFloorTextTexture, makePlaceholderTexture } from './textures.js'

const C = THEATRE_CENTER
const EXIT = { x: C.x, y: C.y, z: C.z + 12.5 } // glowing way-out by the +Z wall
const EXIT_RADIUS = 2.8
const START_ANGLE = Math.PI / 5 // 36° — keeps the +Z arrival/exit corridor clear

// One framed project image, gently bobbing, hover-scaling, clickable.
function Panel({ project, tex, position, rotationY, bobPhase, onOpen }) {
  const group = useRef()
  const board = useRef()
  const hover = useRef(false)

  useFrame((s) => {
    const g = group.current
    if (!g) return
    const t = s.clock.elapsedTime
    g.position.y = position[1] + Math.sin(t * 1.2 + bobPhase) * 0.07
    const target = hover.current ? 1.07 : 1
    const k = g.scale.x + (target - g.scale.x) * 0.15
    g.scale.set(k, k, k)
    if (board.current) {
      const m = board.current.material
      m.emissiveIntensity += ((hover.current ? 2.6 : 1.35) - m.emissiveIntensity) * 0.15
    }
  })

  return (
    <group ref={group} position={position} rotation-y={rotationY}>
      {/* neon backboard halo */}
      <mesh ref={board} position={[0, 0, -0.05]}>
        <planeGeometry args={[3.7, 2.42]} />
        <meshStandardMaterial color="#05030c" emissive={project.accent} emissiveIntensity={1.35} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* the placeholder image — clickable */}
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          hover.current = true
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          hover.current = false
          document.body.style.cursor = 'auto'
        }}
      >
        <planeGeometry args={[3.4, 2.12]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  )
}

export default function TheatreRoom() {
  const inside = useTheatre((s) => s.phase === 'inside')
  const openProject = useTheatre((s) => s.openProject)

  // Procedural textures — built once, freed on unmount. Tiny canvases, so doing
  // it at mount avoids any hitch when the player first steps inside.
  const floorText = useMemo(() => makeFloorTextTexture(), [])
  const panels = useMemo(
    () =>
      PROJECTS.map((p, i) => {
        const a = START_ANGLE + i * ((Math.PI * 2) / PROJECTS.length)
        return {
          project: p,
          tex: makePlaceholderTexture(p.title.toUpperCase(), p.accent),
          position: [C.x + RING_RADIUS * Math.sin(a), 2.55, C.z + RING_RADIUS * Math.cos(a)],
          rotationY: a + Math.PI, // face the centre
          bobPhase: i * 1.3,
        }
      }),
    [],
  )
  useEffect(
    () => () => {
      floorText.dispose()
      panels.forEach((p) => p.tex.dispose())
    },
    [floorText, panels],
  )

  const fillMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#5ad1ff') } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
          void main(){
            vec2 p = vUv - 0.5;
            float mask = smoothstep(0.52, 0.12, length(vec2(p.x*1.15, p.y*0.62)));
            float wave = 0.5 + 0.5*sin(vUv.y*15.0 - uTime*3.0);
            float a = mask*(0.32 + 0.16*wave);
            a = a==a ? clamp(a,0.0,1.0) : 0.0;
            gl_FragColor = vec4(uColor + wave*0.18, a);
          }
        `,
      }),
    [],
  )

  const nearExit = useRef(false)

  useFrame((s) => {
    if (!inside) return
    fillMat.uniforms.uTime.value = s.clock.elapsedTime
    const body = getPlayerBody()
    if (body) {
      const p = body.translation()
      nearExit.current = Math.hypot(p.x - EXIT.x, p.z - EXIT.z) <= EXIT_RADIUS
    }
  })

  // Esc leaves (or closes an open popup first). Enter near the exit also leaves.
  useEffect(() => {
    const onKey = (e) => {
      const st = useTheatre.getState()
      if (st.phase !== 'inside') return
      if (e.code === 'Escape') {
        if (st.project !== null) st.closeProject()
        else exitTheatre()
      } else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && st.project === null && nearExit.current) {
        exitTheatre()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <group>
      {/* Room shell colliders — always present so the teleport always lands solid. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[ROOM_HALF + 2, 1, ROOM_HALF + 2]} position={[C.x, C.y - 1, C.z]} />
        <CuboidCollider args={[0.5, ROOM_CEIL, ROOM_HALF + 2]} position={[C.x + ROOM_HALF, C.y + ROOM_CEIL, C.z]} />
        <CuboidCollider args={[0.5, ROOM_CEIL, ROOM_HALF + 2]} position={[C.x - ROOM_HALF, C.y + ROOM_CEIL, C.z]} />
        <CuboidCollider args={[ROOM_HALF + 2, ROOM_CEIL, 0.5]} position={[C.x, C.y + ROOM_CEIL, C.z + ROOM_HALF]} />
        <CuboidCollider args={[ROOM_HALF + 2, ROOM_CEIL, 0.5]} position={[C.x, C.y + ROOM_CEIL, C.z - ROOM_HALF]} />
      </RigidBody>

      {inside && (
        <group>
          {/* lighting: low neon ambience + a few coloured point lights (no shadows) */}
          <ambientLight intensity={0.38} color="#5247a0" />
          <pointLight position={[C.x, 5.2, C.z]} color="#7b6cff" intensity={6} distance={26} decay={2} />
          <pointLight position={[C.x - 7, 3.4, C.z - 4]} color="#4f9cff" intensity={4} distance={18} decay={2} />
          <pointLight position={[C.x + 7, 3.4, C.z + 4]} color="#ff7ad9" intensity={4} distance={18} decay={2} />

          {/* floor */}
          <mesh position={[C.x, C.y + 0.01, C.z]} rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[(ROOM_HALF + 2) * 2, (ROOM_HALF + 2) * 2]} />
            <meshStandardMaterial color="#0a0818" roughness={0.55} metalness={0.35} envMapIntensity={0.4} />
          </mesh>
          {/* soft glow pool under the centre text */}
          <mesh position={[C.x, C.y + 0.02, C.z]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[10, 48]} />
            <meshBasicMaterial color="#2a1d5e" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          {/* neon "PROJECT THEATRE" on the ground (reads upright from the +Z entrance) */}
          <mesh position={[C.x, C.y + 0.03, C.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[12, 4.5]} />
            <meshBasicMaterial map={floorText} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>

          {/* ceiling + walls — dark, fogged, just enough to feel enclosed */}
          <mesh position={[C.x, C.y + ROOM_CEIL, C.z]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[(ROOM_HALF + 2) * 2, (ROOM_HALF + 2) * 2]} />
            <meshStandardMaterial color="#0a0818" side={THREE.DoubleSide} roughness={1} />
          </mesh>
          {[
            [C.x + ROOM_HALF, [0, -Math.PI / 2, 0]],
            [C.x - ROOM_HALF, [0, Math.PI / 2, 0]],
          ].map(([x, rot], i) => (
            <mesh key={`wx${i}`} position={[x, C.y + ROOM_CEIL / 2, C.z]} rotation={rot}>
              <planeGeometry args={[(ROOM_HALF + 2) * 2, ROOM_CEIL]} />
              <meshStandardMaterial color="#0a0817" side={THREE.DoubleSide} roughness={1} />
            </mesh>
          ))}
          {[
            [C.z + ROOM_HALF, [0, Math.PI, 0]],
            [C.z - ROOM_HALF, [0, 0, 0]],
          ].map(([z, rot], i) => (
            <mesh key={`wz${i}`} position={[C.x, C.y + ROOM_CEIL / 2, z]} rotation={rot}>
              <planeGeometry args={[(ROOM_HALF + 2) * 2, ROOM_CEIL]} />
              <meshStandardMaterial color="#0a0817" side={THREE.DoubleSide} roughness={1} />
            </mesh>
          ))}

          {/* the five framed projects, ringed around the centre */}
          {panels.map((p, i) => (
            <Panel key={p.project.id} {...p} onOpen={() => openProject(i)} />
          ))}

          {/* drifting motes for atmosphere */}
          <Sparkles count={90} scale={[ROOM_HALF * 1.6, ROOM_CEIL * 0.8, ROOM_HALF * 1.6]} position={[C.x, C.y + ROOM_CEIL * 0.45, C.z]} size={3} speed={0.25} opacity={0.6} color="#b9a8ff" />

          {/* the way out — a glowing arch by the +Z wall */}
          <group position={[EXIT.x, C.y, EXIT.z]} rotation-y={Math.PI}>
            <mesh position={[-1.1, 1.7, 0]}>
              <boxGeometry args={[0.12, 3.4, 0.14]} />
              <meshStandardMaterial color="#5ad1ff" emissive="#aef0ff" emissiveIntensity={2.2} toneMapped={false} />
            </mesh>
            <mesh position={[1.1, 1.7, 0]}>
              <boxGeometry args={[0.12, 3.4, 0.14]} />
              <meshStandardMaterial color="#5ad1ff" emissive="#aef0ff" emissiveIntensity={2.2} toneMapped={false} />
            </mesh>
            <mesh position={[0, 3.4, 0]}>
              <boxGeometry args={[2.32, 0.12, 0.14]} />
              <meshStandardMaterial color="#5ad1ff" emissive="#aef0ff" emissiveIntensity={2.2} toneMapped={false} />
            </mesh>
            <mesh material={fillMat} position={[0, 1.7, 0.04]}>
              <planeGeometry args={[2.2, 3.4]} />
            </mesh>
            <mesh position={[0, 0.04, 0.5]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[1.6, 36]} />
              <meshBasicMaterial color="#5ad1ff" transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
            <pointLight position={[0, 1.7, 0.8]} color="#5ad1ff" intensity={2.2} distance={9} decay={2} />
          </group>
        </group>
      )}
    </group>
  )
}
