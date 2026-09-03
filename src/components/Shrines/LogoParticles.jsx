import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { suspend } from 'suspend-react'
import * as THREE from 'three'
import { QUALITY } from '../../utils/quality.js'
import { playSfx, playStoppable } from '../../utils/sfx.js'

// The Joveo mark as ~4200 additive glow particles
const N = QUALITY.logoParticles
const LOGO_WIDTH = 3.4 // 0.75× the previous 5.2
// Height of the logo center above the fountain base
const LOGO_HOVER = 3.4
// A dark radial scrim sits just behind the mark
const BACKDROP_R = LOGO_WIDTH * 0.8

// Sample a logo image into particle targets + colors
async function sampleLogo(url, mode = 'alpha', shade = 0.5, sat = 1.35, gain = 1, lumaMax = 0.82) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = url
  })
  const S = 200
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const cx = cv.getContext('2d', { willReadFrequently: true })
  cx.drawImage(img, 0, 0, S, S)
  const px = cx.getImageData(0, 0, S, S).data
  const samples = []
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4
      const r = px[i] / 255
      const g = px[i + 1] / 255
      const b = px[i + 2] / 255
      const luma = 0.299 * r + 0.587 * g + 0.114 * b
      const isInk = mode === 'ink' ? px[i + 3] > 140 && luma < lumaMax : px[i + 3] > 140
      if (isInk) samples.push([x, y, r, g, b])
    }
  }
  const jitterAmt = (LOGO_WIDTH / S) * 0.55
  const targets = new Float32Array(N * 3)
  const colors = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const s = samples[(Math.random() * samples.length) | 0]
    targets[i * 3] = (s[0] / S - 0.5) * LOGO_WIDTH + (Math.random() - 0.5) * jitterAmt
    targets[i * 3 + 1] = -(s[1] / S - 0.5) * LOGO_WIDTH + (Math.random() - 0.5) * jitterAmt
    targets[i * 3 + 2] = (Math.random() - 0.5) * 0.6
    // Push each pixel away from its own luma to deepen + saturate the brand colors
    const luma = 0.299 * s[2] + 0.587 * s[3] + 0.114 * s[4]
    colors[i * 3] = Math.max(0, Math.min(1, (luma + (s[2] - luma) * sat) * shade * gain))
    colors[i * 3 + 1] = Math.max(0, Math.min(1, (luma + (s[3] - luma) * sat) * shade * gain))
    colors[i * 3 + 2] = Math.max(0, Math.min(1, (luma + (s[4] - luma) * sat) * shade * gain))
  }
  return { targets, colors }
}

export default function LogoParticles({ fountain, logo, closing, onClosed }) {
  const { targets, colors } = suspend(
    () => sampleLogo(logo.url, logo.mode, logo.shade, logo.sat, logo.gain, logo.lumaMax),
    [logo.url],
  )
  const groupRef = useRef()
  const stateRef = useRef({ holding: false, blastT: 0, openedAt: 0, closedAt: 0 })
  const camera = useThree((s) => s.camera)
  const pointer = useThree((s) => s.pointer)

  const { geometry, material, backdropMat, vel, rand, fountainPool } = useMemo(() => {
    // Deterministic PRNG keeps this render-pure (and StrictMode-stable)
    let seed = 1337
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    const pos = new Float32Array(N * 3)
    const rand = new Float32Array(N)
    const fountainPool = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      // birth/death pool: inside the fountain bowl (local space, logo center origin)
      const a = rnd() * Math.PI * 2
      const r = Math.sqrt(rnd()) * (fountain.r * 0.9)
      fountainPool[i * 3] = Math.cos(a) * r
      fountainPool[i * 3 + 1] = fountain.top - (fountain.y + LOGO_HOVER) + rnd() * 0.4
      fountainPool[i * 3 + 2] = Math.sin(a) * r
      pos[i * 3] = fountainPool[i * 3]
      pos[i * 3 + 1] = fountainPool[i * 3 + 1]
      pos[i * 3 + 2] = fountainPool[i * 3 + 2]
      rand[i] = rnd()
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 1))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 2.0 },
      },
      vertexShader: /* glsl */ `
        attribute float aRand;
        attribute vec3 aColor;
        uniform float uTime, uSize;
        varying float vRand;
        varying vec3 vColor;
        void main() {
          vRand = aRand;
          vColor = aColor;
          vec3 p = position;
          p.x += sin(uTime * 0.55 + aRand * 20.0) * 0.035;
          p.y += cos(uTime * 0.45 + aRand * 24.0) * 0.035;
          p.z += sin(p.x * 0.7 + uTime * 0.5) * cos(p.y * 0.6 + uTime * 0.4) * 0.10;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          // Clamp sprite size so close-up points never balloon
          // a huge additive splat, and thousands of those is a fill-rate wall.
          gl_PointSize = min(uSize * (0.6 + aRand) * (28.0 / -mv.z), 18.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vRand;
        varying vec3 vColor;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float alpha = smoothstep(0.5, 0.05, length(c));
          gl_FragColor = vec4(vColor, alpha * 0.82);
        }
      `,
    })

    // Dark radial scrim — a near-opaque indigo-black disc that gives the additive mark a stage
    const backdropMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float a = pow(clamp(smoothstep(1.0, 0.0, d), 0.0, 1.0), 1.3);
          vec3 col = mix(vec3(0.015, 0.012, 0.05), vec3(0.05, 0.035, 0.12), a);
          gl_FragColor = vec4(col, a * 0.94 * uOpacity);
        }
      `,
    })
    return { geometry, material, backdropMat, vel: new Float32Array(N * 3), rand, fountainPool }
  }, [colors, fountain])

  // Hold-to-absorb / release-to-blast — without stealing camera drags: a press that moves more
  useEffect(() => {
    const s = stateRef.current
    let downX = 0
    let downY = 0
    let moved = false
    let holdTimer = 0

    const onDown = (e) => {
      downX = e.clientX
      downY = e.clientY
      moved = false
      holdTimer = setTimeout(() => {
        if (!moved && !closing) {
          s.holding = true
          // absorb whoosh starts the instant the gather begins → stays in sync
          s.absorbSfx = playStoppable('absorb', { gain: 0.75, rateJitter: 0.03 })
        }
      }, 150)
    }
    const onMove = (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) {
        moved = true
        if (s.holding) {
          s.holding = false
          // dragged away mid-charge → fade the absorb back out
          if (s.absorbSfx) {
            s.absorbSfx.stop(0.12)
            s.absorbSfx = null
          }
        }
        clearTimeout(holdTimer)
      }
    }
    // Fling every particle outward from (s.ax, s.ay, s.az) in the mark's local space
    const detonate = () => {
      s.holding = false
      // cut the absorb charge so the blast lands clean on the same frame
      if (s.absorbSfx) {
        s.absorbSfx.stop()
        s.absorbSfx = null
      }
      s.blastT = 1.0
      playSfx('blast', { gain: 0.85, rateJitter: 0.06 })
      const arr = geometry.attributes.position.array
      for (let i = 0; i < N; i++) {
        const ix = i * 3
        const dx = arr[ix] - s.ax
        const dy = arr[ix + 1] - s.ay
        const dz = arr[ix + 2] - s.az
        const len = Math.hypot(dx, dy, dz) || 0.001
        const speed = 14 + rand[i] * 18
        vel[ix] = (dx / len) * speed + (rand[i] - 0.5) * 6
        vel[ix + 1] = (dy / len) * speed + (Math.random() - 0.5) * 6
        vel[ix + 2] = (dz / len) * speed * 0.5
      }
      if (window.navigator.vibrate) window.navigator.vibrate(30)
    }
    const onUp = () => {
      clearTimeout(holdTimer)
      if (s.holding) {
        // released a charged hold → burst from the gathered orb under the cursor
        detonate()
      } else if (!moved && !closing) {
        // a simple click pops the mark too → burst from its center
        s.ax = 0
        s.ay = 0
        s.az = 0
        detonate()
      }
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      clearTimeout(holdTimer)
      if (s.absorbSfx) {
        s.absorbSfx.stop(0.1)
        s.absorbSfx = null
      }
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [geometry, vel, rand, closing])

  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const plane = useMemo(() => new THREE.Plane(), [])
  const worldPt = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, deltaRaw) => {
    const dt = Math.min(deltaRaw, 0.05)
    const t = state.clock.elapsedTime
    const s = stateRef.current
    const group = groupRef.current
    if (!group) return
    if (!s.openedAt) s.openedAt = t
    if (closing && !s.closedAt) s.closedAt = t

    material.uniforms.uTime.value = t

    // Scrim fades in as the mark forms, out as it sinks home
    const targetO = closing ? 0 : 1
    backdropMat.uniforms.uOpacity.value +=
      (targetO - backdropMat.uniforms.uOpacity.value) * 0.06

    // Face the player camera (yaw only), gently
    const wantY = Math.atan2(camera.position.x - group.position.x, camera.position.z - group.position.z)
    group.rotation.y += (wantY - group.rotation.y) * 0.04

    const arr = geometry.attributes.position.array

    if (s.holding) {
      // vortex orb under the cursor, on the logo's plane
      camera.getWorldDirection(camDir)
      plane.setFromNormalAndCoplanarPoint(camDir, group.position)
      raycaster.setFromCamera(pointer, camera)
      if (raycaster.ray.intersectPlane(plane, worldPt)) {
        group.worldToLocal(worldPt)
        s.ax = worldPt.x
        s.ay = worldPt.y
        s.az = worldPt.z
      }
      for (let i = 0; i < N; i++) {
        const ix = i * 3
        const r = 0.12 + rand[i] * 0.9
        const a = t * 3.2 + rand[i] * 25.13
        arr[ix] += (s.ax + Math.cos(a) * r - arr[ix]) * 0.1
        arr[ix + 1] += (s.ay + Math.sin(a * 1.3) * r - arr[ix + 1]) * 0.1
        arr[ix + 2] += (s.az + Math.sin(a * 0.7) * r * 0.6 - arr[ix + 2]) * 0.1
      }
    } else if (s.blastT > 0) {
      s.blastT -= dt
      const drag = Math.pow(0.04, dt)
      for (let i = 0; i < N; i++) {
        const ix = i * 3
        arr[ix] += vel[ix] * dt
        arr[ix + 1] += vel[ix + 1] * dt
        arr[ix + 2] += vel[ix + 2] * dt
        vel[ix] *= drag
        vel[ix + 1] *= drag
        vel[ix + 2] *= drag
        const pull = 0.01 + (1 - s.blastT) * 0.05
        arr[ix] += (targets[ix] - arr[ix]) * pull
        arr[ix + 1] += (targets[ix + 1] - arr[ix + 1]) * pull
        arr[ix + 2] += (targets[ix + 2] - arr[ix + 2]) * pull
      }
    } else if (closing) {
      // sink home into the fountain, then unmount
      for (let i = 0; i < N * 3; i++) arr[i] += (fountainPool[i] - arr[i]) * 0.07
      if (t - s.closedAt > 1.1) onClosed()
    } else {
      // emergence + idle: particles leave the fountain in waves (stagger by aRand)
      const age = t - s.openedAt
      for (let i = 0; i < N; i++) {
        const ix = i * 3
        const wave = THREE.MathUtils.smoothstep(age, rand[i] * 0.9, rand[i] * 0.9 + 0.5)
        const pull = 0.055 * wave
        arr[ix] += (targets[ix] - arr[ix]) * pull
        arr[ix + 1] += (targets[ix + 1] - arr[ix + 1]) * pull
        arr[ix + 2] += (targets[ix + 2] - arr[ix + 2]) * pull
      }
    }
    geometry.attributes.position.needsUpdate = true
  })

  return (
    <group ref={groupRef} position={[fountain.x, fountain.y + LOGO_HOVER, fountain.z]}>
      {/* dark stage behind the mark so the additive glow reads vivid */}
      <mesh material={backdropMat} position={[0, 0, -0.7]} renderOrder={-1} frustumCulled={false}>
        <circleGeometry args={[BACKDROP_R, 56]} />
      </mesh>
      <points geometry={geometry} material={material} renderOrder={1} frustumCulled={false} />
    </group>
  )
}
