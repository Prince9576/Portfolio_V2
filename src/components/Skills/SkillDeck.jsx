import { Suspense, useMemo, useRef } from 'react'
import { Text, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { levelFor, SKILLS } from '../../content/skills.js'
import { getPlayerBody } from '../../stores/playerRef.js'
import { ROOF_BOUNDS, usePortal } from '../../stores/portalStore.js'
import SkillNode from './SkillNode.jsx'

// Decode logos at app start so there's no pop-in when the deck mounts.
SKILLS.forEach((s) => useTexture.preload(s.logo))

// Two columns straddling the deck centre; rows march down z inside the fence
// and clear of the roof portal (z=2). Group 1 (Frontend) fills the left column.
const COL_DX = 2.05
const Z_TOP = -17.5
const Z_BOT = -1
const CELL_W = 3.7
const CELL_D = 2.4
const TILE_Y = ROOF_BOUNDS.top + 0.04 // sit on the walk surface, not the panels 1.5m below
const FOCUS_RANGE = 3.4

function buildLayout() {
  const perCol = Math.ceil(SKILLS.length / 2)
  const pitch = perCol > 1 ? (Z_BOT - Z_TOP) / (perCol - 1) : 0
  const nodes = SKILLS.map((skill, i) => {
    const col = i < perCol ? 0 : 1
    const row = i - col * perCol
    const x = ROOF_BOUNDS.cx + (col === 0 ? -COL_DX : COL_DX)
    const z = Z_TOP + row * pitch
    return { skill, index: i, position: [x, TILE_Y, z], level: levelFor(skill.group) }
  })
  // One header per contiguous group block, above its first cell.
  const headers = []
  let last = null
  for (const n of nodes) {
    if (n.skill.group !== last) {
      headers.push({ text: n.skill.group.toUpperCase(), color: n.skill.color, position: [n.position[0], TILE_Y + 2.7, n.position[2]] })
      last = n.skill.group
    }
  }
  return { nodes, headers }
}

// Billboarded group banner.
function Header({ text, position, color }) {
  const camera = useThree((s) => s.camera)
  const ref = useRef()
  useFrame(() => {
    if (ref.current) ref.current.rotation.y = Math.atan2(camera.position.x - position[0], camera.position.z - position[2])
  })
  return (
    <group ref={ref} position={position}>
      <Text fontSize={0.44} color={color} anchorX="center" anchorY="middle" outlineWidth={0.015} outlineColor="#05030f" letterSpacing={0.18}>
        {text}
      </Text>
    </group>
  )
}

export default function SkillDeck() {
  const phase = usePortal((s) => s.phase)
  const onRoof = phase === 'roof' || phase === 'roofHint'

  const { nodes, headers } = useMemo(buildLayout, [])
  const focusRef = useRef(-1)

  // Single O(N) sqrt-free nearest-node scan; drives every node's focus (no
  // React state in the hot path).
  useFrame(() => {
    if (!onRoof) return
    const body = getPlayerBody()
    if (!body) return
    const p = body.translation()
    let best = -1
    let bestD = FOCUS_RANGE * FOCUS_RANGE
    for (const n of nodes) {
      const dx = p.x - n.position[0]
      const dz = p.z - n.position[2]
      const d = dx * dx + dz * dz
      if (d < bestD) {
        bestD = d
        best = n.index
      }
    }
    focusRef.current = best
  })

  if (!onRoof) return null

  return (
    <Suspense fallback={null}>
      {headers.map((h) => (
        <Header key={h.text} {...h} />
      ))}
      {nodes.map((n) => (
        <Suspense key={n.skill.id} fallback={null}>
          <SkillNode skill={n.skill} position={n.position} cellW={CELL_W} cellD={CELL_D} level={n.level} index={n.index} focusRef={focusRef} />
        </Suspense>
      ))}
    </Suspense>
  )
}
