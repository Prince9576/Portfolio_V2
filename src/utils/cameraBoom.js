// Occlusion for the two third-person cameras (the walking follow-cam and the
// car's chase cam). Both used to push straight through whatever happened to sit
// behind the player — parked cars, palm trunks, building walls — leaving you
// looking at the inside of a mesh.
//
// ecctrl ships its own `camCollision`, but it walks a flat array of every mesh
// in the scene with a THREE.Raycaster (collected once, at mount, before the city
// GLB is even attached), which this scene can't afford per frame. The physics
// world already holds tight colliders for all of it — trimeshes for buildings,
// convex hulls for props — behind a BVH, so one shape cast answers the same
// question for almost nothing.
//
// A small sphere rather than a ray, so the frustum's corners can't clip through
// a wall edge that a single ray happens to miss.

// DEV: `window.__boom.value = false` hands the camera straight back to ecctrl,
// so any camera problem can be A/B'd against the untouched controller.
export const boomEnabled = { value: true }
if (import.meta.env.DEV && typeof window !== 'undefined') window.__boom = boomEnabled

export const BOOM_RADIUS = 0.3 // the camera's "head", ~3x its near plane
const SKIN = 0.14 // gap kept behind the hit so it never rests flush on geometry
const PULL_IN = 30 // 1/s — an occluder appearing must never be seen through
const PUSH_OUT = 4 // 1/s — slow, or brushing past a lamppost pumps the camera
// The distance to the nearest occluder is genuinely discontinuous: swing the arm
// past a building corner and it steps from "clear" to 2m with nothing in
// between. An exponential ease alone therefore launches at whatever speed the
// step demands — measured at 0.6m in a single frame, which reads as a jolt, not
// as a camera. So the ease sets the *shape* (a soft landing) and these cap the
// *speed* (m/s). 9 m/s is where the two costs cross: measured over a 180° drag
// along a wall it gives both the smallest single-frame step (0.17m, down from
// 0.61m uncapped) and the only zero-occluded-frame result — 6 m/s clips for 3
// frames, 4 m/s for 12, and neither is any smoother.
const MAX_PULL = 9
const MAX_PUSH = 3.5
const EPS = 1e-4

// Rapier wants plain objects; there is one boom per camera, so these are shared
const _pos = { x: 0, y: 0, z: 0 }
const _vel = { x: 0, y: 0, z: 0 }
const _rot = { x: 0, y: 0, z: 0, w: 1 }

/**
 * How far the camera arm may actually extend, smoothed asymmetrically.
 *
 * @param origin  the look target (player head / car roof) — Vector3-like
 * @param dir     unit vector from origin toward where the camera wants to sit
 * @param dist    the unobstructed arm length
 * @param exclude rapier filterPredicate: return true to let a collider block
 * `dist` MUST be the arm's unoccluded length, from a source independent of
 * where the camera currently is. Measuring it off the live camera feeds this
 * function's own smoothed output back into it, and the lag alone then reads as
 * an occluder — the camera gets "corrected" with nothing in its way.
 *
 * @param state caller-owned holder, one per camera. `state.raw` is left holding
 *              the hard limit straight from the cast (no smoothing), for
 *              callers that lerp toward the arm and need a floor to clamp at.
 * @returns the smoothed arm length; equal to `dist` when nothing is in the way
 */
export function boomDistance({ world, shape, origin, dir, dist, minDist = 1.2, exclude, state, dt }) {
  let allowed = dist
  if (dist > minDist) {
    _pos.x = origin.x
    _pos.y = origin.y
    _pos.z = origin.z
    _vel.x = dir.x
    _vel.y = dir.y
    _vel.z = dir.z
    // stopAtPenetration false: ignore anything already overlapping the target,
    // otherwise standing inside a doorway collapses the arm to zero.
    const hit = world.castShape(
      _pos, _rot, _vel, shape,
      0, // targetDistance
      dist, // maxToi — dir is unit length, so this is metres
      false,
      undefined, undefined, undefined, undefined,
      exclude
    )
    if (hit) allowed = Math.max(hit.time_of_impact - SKIN, minDist)
  }
  state.raw = allowed

  const cur = state.dist
  if (cur === undefined) {
    state.dist = allowed
    return allowed
  }
  if (Math.abs(allowed - cur) < EPS) return cur
  const pulling = allowed < cur
  const k = pulling ? PULL_IN : PUSH_OUT
  let step = (allowed - cur) * (1 - Math.exp(-k * dt))
  const cap = (pulling ? MAX_PULL : MAX_PUSH) * dt
  if (step > cap) step = cap
  else if (step < -cap) step = -cap
  const next = cur + step
  state.dist = next
  return next
}

// ecctrl builds its camera arm from two bare Object3Ds that it adds to the scene
// itself — `pivot` (the smoothed look target, parented to the scene) with
// `followCam` as its only child (the arm, at the user's current zoom) — and
// never exposes either. They are the only honest source for the arm's
// unoccluded length, so the boom finds them by their shape in the graph: a
// childless Object3D sitting directly on x = 0 of a scene-level Object3D, at a
// distance inside the controller's own zoom limits.
//
// Verified at runtime rather than assumed: a null return means the boom stays
// out of the way entirely and ecctrl's camera behaves exactly as shipped.
export function findEcctrlRig(scene, minDis, maxDis) {
  for (const o of scene.children) {
    if (o.type !== 'Object3D' || o.children.length !== 1) continue
    const followCam = o.children[0]
    if (followCam.type !== 'Object3D' || followCam.children.length !== 0) continue
    if (followCam.position.x !== 0) continue
    const len = followCam.position.length()
    if (len < minDis - 0.01 || len > maxDis + 0.01) continue
    return { pivot: o, followCam }
  }
  return null
}
