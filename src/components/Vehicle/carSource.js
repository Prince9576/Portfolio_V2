import * as THREE from 'three'
import meta from '../../content/worldMeta.json'

// Shared source-of-truth for the one drivable car
const PART_RE = /^Futuristic_Car_1(_|$)/
const isWheel = (o) => /wheel/i.test(o.name)

// Toggle the whole feature with ?nocar — kept here so City and the car agree.
export const DRIVABLE_CAR_ENABLED = true

// The car "body" is any non-wheel part; prefer an instanced one
function findBody(parts) {
  return (
    parts.find((o) => !isWheel(o) && o.isInstancedMesh) ||
    parts.find((o) => !isWheel(o)) ||
    parts[0] ||
    null
  )
}

const worldMatrixOf = (mesh, index) => {
  const m = mesh.matrixWorld.clone()
  if (mesh.isInstancedMesh && mesh.count > index) {
    const im = new THREE.Matrix4()
    mesh.getMatrixAt(index, im)
    m.multiply(im)
  }
  return m
}

// Find the Futuristic_Car_1 instance closest to spawn. Pure — no mutation.
export function pickDrivableCar(scene) {
  scene.updateMatrixWorld(true)
  const parts = []
  scene.traverse((o) => {
    if (o.isMesh && PART_RE.test(o.name)) parts.push(o)
  })
  const body = findBody(parts)
  if (!body) return null

  const count = body.isInstancedMesh ? body.count : 1
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const scl = new THREE.Vector3()
  let index = 0
  let bestD = Infinity
  const position = new THREE.Vector3()
  let yaw = 0
  for (let i = 0; i < count; i++) {
    worldMatrixOf(body, i).decompose(pos, quat, scl)
    const d = (pos.x - meta.spawn.x) ** 2 + (pos.z - meta.spawn.z) ** 2
    if (d < bestD) {
      bestD = d
      index = i
      position.copy(pos)
      yaw = new THREE.Euler().setFromQuaternion(quat, 'YXZ').y
    }
  }

  if (import.meta.env.DEV) {
    console.info(
      '[car] parts:', parts.map((p) => p.name),
      '| instances:', count,
      '| chosen #' + index, 'at', position.toArray().map((n) => +n.toFixed(1)),
      '| dist-to-spawn', Math.sqrt(bestD).toFixed(1) + 'm',
    )
  }
  return { parts, index, position, yaw }
}

// Rebuild the chosen instance as a standalone, centred group
export function buildCarVisual(parts, index) {
  const body = findBody(parts)
  const bodyInv = worldMatrixOf(body, index).invert()

  const group = new THREE.Group()
  for (const o of parts) {
    const rel = bodyInv.clone().multiply(worldMatrixOf(o, index))
    const mesh = new THREE.Mesh(o.geometry, o.material.clone())
    mesh.applyMatrix4(rel)
    // No shadows on the clone: soft shadows are costly and it sits low
    mesh.castShadow = false
    mesh.receiveShadow = false
    group.add(mesh)
  }

  const bbox = new THREE.Box3().setFromObject(group)
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  bbox.getSize(size)
  bbox.getCenter(center)
  group.position.sub(center) // centre on the rigid body's origin

  const wrap = new THREE.Group()
  wrap.add(group)
  return { object: wrap, half: [size.x / 2, size.y / 2, size.z / 2] }
}

// Make the original parked instance vanish (scale it to zero)
export function hideCarInstance(parts, index) {
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
  const saved = []
  for (const o of parts) {
    if (!o.isInstancedMesh || o.count <= index) continue
    const orig = new THREE.Matrix4()
    o.getMatrixAt(index, orig)
    saved.push({ o, orig })
    o.setMatrixAt(index, ZERO)
    o.instanceMatrix.needsUpdate = true
  }
  return () => {
    for (const { o, orig } of saved) {
      o.setMatrixAt(index, orig)
      o.instanceMatrix.needsUpdate = true
    }
  }
}
