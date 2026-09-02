import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { ConvexHullCollider, CuboidCollider, CylinderCollider, RigidBody, TrimeshCollider } from '@react-three/rapier'
import * as THREE from 'three'
import meta from '../../content/worldMeta.json'
import { landmarks } from '../../stores/shrineStore.js'
import { useTheatre } from '../../stores/theatreStore.js'
import { useWeather } from '../../stores/weatherStore.js'
import { DRIVABLE_CAR_ENABLED, pickDrivableCar } from '../Vehicle/carSource.js'

const WALK = /^road|Set_B_Tiles|Graffiti|Bus_Stop|_Line$/i
const BUILDING = /Building/i
const TRUNK = /^Palm/i
const POLE = /traffic_light|Spotlight/i
const ROUND = /^Fountain/i
const NO_SHADOW_CAST = /^road|Set_B_Tiles|Graffiti/i

function classify(o) {
  for (let n = o; n && !n.isScene; n = n.parent) {
    const nm = n.name
    if (!nm) continue
    if (WALK.test(nm)) return 'walk'
    if (BUILDING.test(nm)) return 'building'
    if (TRUNK.test(nm)) return 'trunk'
    if (POLE.test(nm)) return 'pole'
    if (ROUND.test(nm)) return 'round'
  }
  return 'solid'
}

const MAX_HULL_PTS = 256
function hullPoints(geometry, world) {
  const pos = geometry.attributes.position
  const stride = Math.max(1, Math.ceil(pos.count / MAX_HULL_PTS))
  const v = new THREE.Vector3()
  const out = []
  for (let i = 0; i < pos.count; i += stride) {
    v.fromBufferAttribute(pos, i).applyMatrix4(world)
    out.push(v.x, v.y, v.z)
  }
  return new Float32Array(out)
}

function trimeshData(geometry, world) {
  const pos = geometry.attributes.position
  const verts = new Float32Array(pos.count * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(world)
    verts[i * 3] = v.x
    verts[i * 3 + 1] = v.y
    verts[i * 3 + 2] = v.z
  }
  let indices
  if (geometry.index) {
    const src = geometry.index.array
    indices = src instanceof Uint32Array ? src : Uint32Array.from(src)
  } else {
    indices = new Uint32Array(pos.count)
    for (let i = 0; i < pos.count; i++) indices[i] = i
  }
  return { vertices: verts, indices }
}

export default function City() {
  const { scene } = useGLTF('/models/city.glb')

  const { trimeshes, hulls, boxes, poles } = useMemo(() => {
    const m = new THREE.Matrix4()
    const im = new THREE.Matrix4()
    const wb = new THREE.Box3()
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()

    scene.updateMatrixWorld(true)

    const carHome = DRIVABLE_CAR_ENABLED ? pickDrivableCar(scene) : null
    const carParts = carHome ? new Set(carHome.parts) : null

    const trimeshes = []
    const hulls = []
    const boxes = []
    const poles = []
    landmarks.fountains.length = 0

    scene.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = !NO_SHADOW_CAST.test(o.name)
      o.receiveShadow = true
      if (o.isInstancedMesh) o.computeBoundingSphere() // correct culling bounds

      const kind = classify(o)
      if (kind === 'walk') return

      o.geometry.computeBoundingBox()
      const localBB = o.geometry.boundingBox
      const instCount = o.isInstancedMesh ? o.count : 1

      for (let i = 0; i < instCount; i++) {
        if (carParts && carParts.has(o) && i === carHome.index) continue

        let world = o.matrixWorld
        if (o.isInstancedMesh) {
          o.getMatrixAt(i, im)
          world = m.multiplyMatrices(o.matrixWorld, im)
        }

        if (kind === 'building') {
          trimeshes.push(trimeshData(o.geometry, world))
          continue
        }

        wb.copy(localBB).applyMatrix4(world)
        wb.getSize(size)
        wb.getCenter(center)

        if (kind !== 'solid') {
          const r = kind === 'trunk' ? 0.4 : kind === 'round' ? Math.max(size.x, size.z) * 0.45 : 0.17
          poles.push({ pos: [center.x, center.y, center.z], args: [size.y / 2, r] })
          if (kind === 'round') {
            landmarks.fountains.push({ x: center.x, y: wb.min.y, z: center.z, top: wb.max.y, r })
          }
          continue
        }

        const minExtent = Math.min(size.x, size.y, size.z)
        if (o.geometry.attributes.position.count < 12 || minExtent < 0.06) {
          boxes.push({
            pos: [center.x, center.y, center.z],
            args: [Math.max(size.x / 2, 0.02), Math.max(size.y / 2, 0.02), Math.max(size.z / 2, 0.02)],
          })
        } else {
          hulls.push(hullPoints(o.geometry, world))
        }
      }
    })

    return { trimeshes, hulls, boxes, poles }
  }, [scene])

  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__colliders = { trimeshes: trimeshes.length, hulls: hulls.length, boxes: boxes.length, poles: poles.length }
    }
  }, [trimeshes, hulls, boxes, poles])

  const storm = useWeather((s) => s.storm)
  const wetRoads = useMemo(() => {
    const swaps = []
    const wetByMaterial = new Map()
    scene.traverse((o) => {
      if (!o.isMesh || !/^road|Set_B_Tiles/i.test(o.name)) return
      if (!wetByMaterial.has(o.material)) {
        const wet = o.material.clone()
        wet.roughness = 0.38
        wet.metalness = 0.05
        wet.envMapIntensity = 1.7
        wetByMaterial.set(o.material, wet)
      }
      swaps.push({ mesh: o, dry: o.material, wet: wetByMaterial.get(o.material) })
    })
    return swaps
  }, [scene])

  useEffect(() => {
    for (const { mesh, dry, wet } of wetRoads) mesh.material = storm ? wet : dry
  }, [storm, wetRoads])

  const inside = useTheatre((s) => s.phase === 'inside')
  useEffect(() => {
    scene.visible = !inside
  }, [inside, scene])

  const { minX, maxX, minZ, maxZ } = meta.bounds

  return (
    <>
      <primitive object={scene} />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[(maxX - minX) / 2 + 8, 1, (maxZ - minZ) / 2 + 8]}
          position={[(minX + maxX) / 2, meta.groundY - 1, (minZ + maxZ) / 2]}
        />
        {trimeshes.map((t, i) => (
          <TrimeshCollider key={`t${i}`} args={[t.vertices, t.indices]} />
        ))}
        {hulls.map((pts, i) => (
          <ConvexHullCollider key={`h${i}`} args={[pts]} />
        ))}
        {boxes.map((c, i) => (
          <CuboidCollider key={`b${i}`} args={c.args} position={c.pos} />
        ))}
        {poles.map((c, i) => (
          <CylinderCollider key={`p${i}`} args={c.args} position={c.pos} />
        ))}
        <CuboidCollider args={[(maxX - minX) / 2 + 8, 8, 0.5]} position={[(minX + maxX) / 2, meta.groundY + 4, minZ - 0.5]} />
        <CuboidCollider args={[(maxX - minX) / 2 + 8, 8, 0.5]} position={[(minX + maxX) / 2, meta.groundY + 4, maxZ + 0.5]} />
        <CuboidCollider args={[0.5, 8, (maxZ - minZ) / 2 + 8]} position={[minX - 0.5, meta.groundY + 4, (minZ + maxZ) / 2]} />
        <CuboidCollider args={[0.5, 8, (maxZ - minZ) / 2 + 8]} position={[maxX + 0.5, meta.groundY + 4, (minZ + maxZ) / 2]} />
      </RigidBody>
    </>
  )
}

useGLTF.preload('/models/city.glb')
