import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Sparkles, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { getPlayerBody, playerRef } from '../../stores/playerRef.js'
import { PROJECTS } from '../../content/projects.js'
import { exitTheatre, ROOM_CEIL, THEATRE_CENTER, useTheatre } from '../../stores/theatreStore.js'
import { drawFloorText, makeFloorTextTexture, makePlaceholderTexture, makeRadialTexture } from './textures.js'

const C = THEATRE_CENTER
const FLOOR_HALF = 16 // visual floor + its collider
const WALL_HALF = 11 // confining walls — kept inside the visible
const EXIT = { x: C.x, y: C.y, z: C.z + 9 } // glowing way-out by the +Z wall
const EXIT_RADIUS = 2.8
const PANEL_RADIUS = 9
const PANEL_SPREAD_DEG = 35 // gap between neighbouring frames
// Fan the frames symmetrically across the front (the −Z arc the player faces on
// arrival), derived from however many projects are listed.
const ARC = PROJECTS.map((_, i) => {
  const mid = (PROJECTS.length - 1) / 2
  return Math.PI + ((i - mid) * PANEL_SPREAD_DEG * Math.PI) / 180
})
// Only the filled slots have artwork; the rest get a drawn "COMING SOON" plate.
const PANEL_IMAGES = PROJECTS.filter((p) => p.image).map((p) => p.image)

// Arrival faces the frames: they sit on the -Z arc, the player lands on +Z.
// This is the camera's forward vector, not the pivot's yaw.
const FACE_TARGET = { x: 0, z: -1 }
const ALIGN_MAX_FRAMES = 150 // ~2.5s ceiling, long enough to outlast the fly-in
const CAM_SETTLE_EPS = 0.05 // per-frame camera travel that counts as "parked"
const ALIGN_TOLERANCE = 0.01 // radians
const _camDir = new THREE.Vector3()
const PANEL_W = 4.2
const PANEL_H = 2.6

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
    const target = hover.current ? 1.06 : 1
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
        <planeGeometry args={[PANEL_W + 0.32, PANEL_H + 0.32]} />
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
        <planeGeometry args={[PANEL_W, PANEL_H]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  )
}

// Everything inside the room
function TheatreInterior({ openProject }) {
  const floorTex = useTexture('/textures/theatre-floor.jpg')
  useEffect(() => {
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping
    floorTex.repeat.set(4, 4)
    floorTex.anisotropy = 8
    floorTex.colorSpace = THREE.SRGBColorSpace
    floorTex.needsUpdate = true
  }, [floorTex])

  const floorText = useMemo(() => makeFloorTextTexture(), [])
  // soft glow under the text (white→transparent radial, no hard ring)
  const glowTex = useMemo(() => makeRadialTexture('#ffffff', '#000000', 0), [])
  // edge vignette: clear centre → opaque toward the rim
  const vignetteTex = useMemo(() => makeRadialTexture('#000000', '#ffffff', 0.55), [])
  // drei caches and owns these, so they are never disposed here — doing so would
  // break the next entry into the room.
  const loadedTex = useTexture(PANEL_IMAGES)
  useEffect(() => {
    for (const t of loadedTex) {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      t.needsUpdate = true
    }
  }, [loadedTex])

  // `plates` are the ones we drew ourselves, so they're ours to free — unlike
  // the drei-cached textures above.
  const { panels, plates } = useMemo(() => {
    const drawn = []
    const out = PROJECTS.map((p, i) => {
      let tex
      if (p.image) {
        tex = loadedTex[PANEL_IMAGES.indexOf(p.image)]
      } else {
        tex = makePlaceholderTexture(p.title.toUpperCase(), p.accent)
        drawn.push(tex)
      }
      return {
        project: p,
        tex,
        position: [C.x + PANEL_RADIUS * Math.sin(ARC[i]), 2.6, C.z + PANEL_RADIUS * Math.cos(ARC[i])],
        rotationY: ARC[i] + Math.PI, // face the centre
        bobPhase: i * 1.3,
      }
    })
    return { panels: out, plates: drawn }
  }, [loadedTex])

  // Redraw the floor caption once Orbitron has actually loaded.
  useEffect(() => {
    if (!document.fonts?.load) return
    let alive = true
    document.fonts.load("800 250px 'Orbitron'").then(() => {
      if (!alive) return
      drawFloorText(floorText.image)
      floorText.needsUpdate = true
    }).catch(() => {})
    return () => {
      alive = false
    }
  }, [floorText])

  useEffect(
    () => () => {
      floorText.dispose()
      glowTex.dispose()
      vignetteTex.dispose()
      plates.forEach((t) => t.dispose())
    },
    [floorText, glowTex, vignetteTex, plates],
  )

  const fillMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#ff4d0a') } },
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

  const floorSize = FLOOR_HALF * 2

  return (
    <group>
      {/* lighting: low neon ambience + a few coloured point lights (no shadows) */}
      <ambientLight intensity={0.42} color="#4a2f26" />
      <pointLight position={[C.x, 5.2, C.z]} color="#ff4d0a" intensity={6} distance={26} decay={2} />
      <pointLight position={[C.x - 7, 3.4, C.z - 4]} color="#ff7a29" intensity={4} distance={18} decay={2} />
      <pointLight position={[C.x + 7, 3.4, C.z + 4]} color="#8f260b" intensity={4} distance={18} decay={2} />

      {/* textured stone floor */}
      <mesh position={[C.x, C.y + 0.01, C.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[floorSize, floorSize]} />
        <meshStandardMaterial map={floorTex} color="#a8a29c" roughness={0.7} metalness={0.2} envMapIntensity={0.5} />
      </mesh>
      {/* edge vignette — dissolves the floor's square edge into the fog */}
      <mesh position={[C.x, C.y + 0.013, C.z]} rotation-x={-Math.PI / 2} renderOrder={1}>
        <planeGeometry args={[floorSize, floorSize]} />
        <meshBasicMaterial color="#0a0806" transparent alphaMap={vignetteTex} depthWrite={false} />
      </mesh>
      {/* soft faded glow pool under the centre text */}
      <mesh position={[C.x, C.y + 0.02, C.z]} rotation-x={-Math.PI / 2} renderOrder={2}>
        <planeGeometry args={[15, 15]} />
        <meshBasicMaterial color="#7a2f12" map={glowTex} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* neon "PROJECT THEATRE" on the ground (reads upright from the +Z entrance) */}
      <mesh position={[C.x, C.y + 0.03, C.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <planeGeometry args={[12, 4.5]} />
        <meshBasicMaterial map={floorText} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* ceiling + walls — dark, fogged, just enough to feel enclosed */}
      <mesh position={[C.x, C.y + ROOM_CEIL, C.z]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[floorSize, floorSize]} />
        <meshStandardMaterial color="#0d0b0a" side={THREE.DoubleSide} roughness={1} />
      </mesh>
      {[
        [C.x + WALL_HALF, [0, -Math.PI / 2, 0]],
        [C.x - WALL_HALF, [0, Math.PI / 2, 0]],
      ].map(([x, rot], i) => (
        <mesh key={`wx${i}`} position={[x, C.y + ROOM_CEIL / 2, C.z]} rotation={rot}>
          <planeGeometry args={[WALL_HALF * 2, ROOM_CEIL]} />
          <meshStandardMaterial color="#0d0b0a" side={THREE.DoubleSide} roughness={1} />
        </mesh>
      ))}
      {[
        [C.z + WALL_HALF, [0, Math.PI, 0]],
        [C.z - WALL_HALF, [0, 0, 0]],
      ].map(([z, rot], i) => (
        <mesh key={`wz${i}`} position={[C.x, C.y + ROOM_CEIL / 2, z]} rotation={rot}>
          <planeGeometry args={[WALL_HALF * 2, ROOM_CEIL]} />
          <meshStandardMaterial color="#0d0b0a" side={THREE.DoubleSide} roughness={1} />
        </mesh>
      ))}

      {/* the five framed projects, fanned across the front */}
      {panels.map((p, i) => (
        <Panel key={p.project.id} {...p} onOpen={() => openProject(i)} />
      ))}

      {/* drifting motes for atmosphere */}
      <Sparkles count={90} scale={[WALL_HALF * 1.8, ROOM_CEIL * 0.8, WALL_HALF * 1.8]} position={[C.x, C.y + ROOM_CEIL * 0.45, C.z]} size={3} speed={0.25} opacity={0.6} color="#ffc9ae" />

      {/* the way out — a glowing arch by the +Z wall */}
      <group position={[EXIT.x, C.y, EXIT.z]} rotation-y={Math.PI}>
        <mesh position={[-1.1, 1.7, 0]}>
          <boxGeometry args={[0.12, 3.4, 0.14]} />
          <meshStandardMaterial color="#ff4d0a" emissive="#ffc9ae" emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
        <mesh position={[1.1, 1.7, 0]}>
          <boxGeometry args={[0.12, 3.4, 0.14]} />
          <meshStandardMaterial color="#ff4d0a" emissive="#ffc9ae" emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
        <mesh position={[0, 3.4, 0]}>
          <boxGeometry args={[2.32, 0.12, 0.14]} />
          <meshStandardMaterial color="#ff4d0a" emissive="#ffc9ae" emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
        <mesh material={fillMat} position={[0, 1.7, 0.04]}>
          <planeGeometry args={[2.2, 3.4]} />
        </mesh>
        <mesh position={[0, 0.04, 0.5]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[1.6, 36]} />
          <meshBasicMaterial color="#ff4d0a" transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <pointLight position={[0, 1.7, 0.8]} color="#ff4d0a" intensity={2.2} distance={9} decay={2} />
      </group>
    </group>
  )
}

export default function TheatreRoom() {
  const inside = useTheatre((s) => s.phase === 'inside')
  const openProject = useTheatre((s) => s.openProject)
  const camera = useThree((s) => s.camera)

  const alignRef = useRef(null)

  // Aim the camera at the frames on arrival. Two passes, because the follow-cam
  // does not teleport with the body — it lerps across the world for ~700ms:
  //   1. immediately, off the still-parked city yaw, so there is no visible swing
  //   2. once the camera has actually parked in the room, correct any residual
  // Pass 2 is what makes this reliable; a yaw measured mid-flight is nonsense.
  const aimCamera = () => {
    const ctrl = playerRef.current
    if (!ctrl?.rotateCamera) return null
    camera.getWorldDirection(_camDir)
    _camDir.y = 0
    if (_camDir.lengthSq() < 1e-6) return null
    _camDir.normalize()
    // signed turn from where we look to where we want to look, about +Y
    const cross = _camDir.z * FACE_TARGET.x - _camDir.x * FACE_TARGET.z
    const dot = _camDir.x * FACE_TARGET.x + _camDir.z * FACE_TARGET.z
    const delta = Math.atan2(cross, dot)
    if (Math.abs(delta) > ALIGN_TOLERANCE) ctrl.rotateCamera(0, delta)
    return delta
  }

  useEffect(() => {
    if (!inside) {
      alignRef.current = null
      return
    }
    aimCamera()
    alignRef.current = { frames: ALIGN_MAX_FRAMES, settled: 0, x: null, z: null }
    // aimCamera closes over the live camera + player refs, so it needs no deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inside])

  useFrame(() => {
    const a = alignRef.current
    if (!a || a.frames <= 0) return
    a.frames -= 1
    const travel =
      a.x === null ? Infinity : Math.abs(camera.position.x - a.x) + Math.abs(camera.position.z - a.z)
    a.x = camera.position.x
    a.z = camera.position.z
    if (travel > CAM_SETTLE_EPS) return // still flying in; any yaw read now is noise
    const delta = aimCamera()
    if (delta !== null && Math.abs(delta) <= ALIGN_TOLERANCE) {
      a.settled += 1
      if (a.settled >= 3) a.frames = 0
    } else {
      a.settled = 0
    }
  })

  return (
    <group>
      {/* Room shell colliders — always present so the teleport always lands solid.
          Walls sit inside the visible floor so the player can never walk off it. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[FLOOR_HALF, 1, FLOOR_HALF]} position={[C.x, C.y - 1, C.z]} />
        <CuboidCollider args={[0.4, ROOM_CEIL, WALL_HALF]} position={[C.x + WALL_HALF, C.y + ROOM_CEIL, C.z]} />
        <CuboidCollider args={[0.4, ROOM_CEIL, WALL_HALF]} position={[C.x - WALL_HALF, C.y + ROOM_CEIL, C.z]} />
        <CuboidCollider args={[WALL_HALF, ROOM_CEIL, 0.4]} position={[C.x, C.y + ROOM_CEIL, C.z + WALL_HALF]} />
        <CuboidCollider args={[WALL_HALF, ROOM_CEIL, 0.4]} position={[C.x, C.y + ROOM_CEIL, C.z - WALL_HALF]} />
      </RigidBody>

      {inside && (
        <Suspense fallback={null}>
          <TheatreInterior openProject={openProject} />
        </Suspense>
      )}
    </group>
  )
}

// Pull the floor texture down with the rest of the world's assets
useTexture.preload('/textures/theatre-floor.jpg')
PANEL_IMAGES.forEach((src) => useTexture.preload(src))
