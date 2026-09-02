import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// A self-contained particle portrait for the start screen.
// Colours are pre-baked into /prince-tinted.png (see tools/bake_prince.cjs):
// a 5-shade blue→purple ramp mapped by face region — hair + goggles darkest
// violet, clothes dark indigo, beard medium blue, lips pink-violet, skin pale
// blue. We sample that image directly and render the points with NORMAL
// blending (additive would wash the dark shades out, the old bug) so the dark
// hair/goggles actually read as dark against the near-black background.
//
// Interaction (like the original prince.html): hover repels the field within a
// small radius — a little black-hole dimple — and clicking detonates it, after
// which it re-forms. Clicking here does NOT enter the site; only the EXPLORE
// button does.
export default function PrinceParticles() {
  const wrapRef = useRef(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    let raf = 0
    let renderer, points, ro, listeners = []
    let disposed = false

    const img = new Image()
    img.src = '/prince-tinted.png'

    const start = async () => {
      try { await img.decode() } catch { /* ignore */ }
      if (disposed) return

      // ---- sample the baked portrait: colour from rgb, weight from alpha ----
      const IW = img.naturalWidth, IH = img.naturalHeight
      const cv = document.createElement('canvas')
      cv.width = IW; cv.height = IH
      const cx = cv.getContext('2d', { willReadFrequently: true })
      cx.drawImage(img, 0, 0)
      const px = cx.getImageData(0, 0, IW, IH).data

      const NP = IW * IH
      const cdf = new Float64Array(NP)
      let total = 0
      for (let i = 0; i < NP; i++) {
        const a = px[i * 4 + 3]
        total += a > 20 ? a / 255 : 0
        cdf[i] = total
      }
      const pick = () => {
        const r = Math.random() * total
        let lo = 0, hi = NP - 1
        while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < r) lo = m + 1; else hi = m }
        return lo
      }

      const H_WORLD = 9
      const W_WORLD = H_WORLD * (IW / IH)
      const JIT = (W_WORLD / IW) * 0.55

      const small = wrap.clientWidth < 420
      const N = small ? 34000 : 62000 // fewer points so it reads as PARTICLES, not a solid image
      const target = new Float32Array(N * 3)
      const pos = new Float32Array(N * 3)
      const col = new Float32Array(N * 3)
      const rnd = new Float32Array(N)
      const vel = new Float32Array(N * 3)

      for (let k = 0; k < N; k++) {
        const i = pick()
        const x = i % IW, y = (i / IW) | 0
        const p = i * 4
        // a little depth so it reads as a cloud (not a flat sheet) but not so
        // much that the face scatters into noise
        target[k * 3] = (x / IW - 0.5) * W_WORLD + (Math.random() - 0.5) * JIT
        target[k * 3 + 1] = -(y / IH - 0.5) * H_WORLD + (Math.random() - 0.5) * JIT
        target[k * 3 + 2] = (Math.random() - 0.5) * 0.45
        col[k * 3] = px[p] / 255
        col[k * 3 + 1] = px[p + 1] / 255
        col[k * 3 + 2] = px[p + 2] / 255
        // scatter on a sphere shell so it visibly assembles into the portrait
        const u = Math.random(), v = Math.random()
        const th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1), rad = 8 + Math.random() * 5
        pos[k * 3] = rad * Math.sin(ph) * Math.cos(th)
        pos[k * 3 + 1] = rad * Math.cos(ph)
        pos[k * 3 + 2] = rad * Math.sin(ph) * Math.sin(th)
        rnd[k] = Math.random()
      }

      // ---- renderer (transparent so the start-screen gradient shows through) ----
      const W = wrap.clientWidth, Hp = wrap.clientHeight
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
      renderer.setSize(W, Hp)
      const canvas = renderer.domElement
      canvas.style.cssText = 'width:100%;height:100%;display:block;cursor:crosshair'
      wrap.appendChild(canvas)

      const scene = new THREE.Scene()
      const FOV = 40
      const camera = new THREE.PerspectiveCamera(FOV, W / Hp, 0.1, 100)
      const tanHalf = Math.tan(FOV * Math.PI / 360)
      // The canvas is fullscreen; size the portrait to a sensible fraction of the
      // viewport and keep it centred regardless of screen aspect.
      const fitCamera = () => {
        const w = wrap.clientWidth, h = wrap.clientHeight
        if (!w || !h) return
        const aspect = w / h
        camera.aspect = aspect
        const dH = (H_WORLD / 0.74) / (2 * tanHalf)          // portrait ≈ 74% of view height
        const dW = (W_WORLD / 0.80) / (2 * tanHalf * aspect) // …but fit the width on narrow screens
        camera.position.set(0, 0, Math.max(dH, dW))
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
      geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1))

      const uniforms = { uTime: { value: 0 }, uSize: { value: small ? 1.8 : 2.0 } }
      const mat = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.NormalBlending, // keep the dark shades dark — do NOT use additive
        vertexShader: `
          attribute float aRand;
          attribute vec3 aColor;
          uniform float uTime, uSize;
          varying vec3 vColor;
          void main(){
            vColor = aColor;
            vec3 p = position;
            p.x += sin(uTime*0.5 + aRand*20.0)*0.04;
            p.y += cos(uTime*0.42 + aRand*24.0)*0.04;
            vec4 mv = modelViewMatrix * vec4(p,1.0);
            gl_PointSize = uSize * (0.55 + aRand) * (34.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          varying vec3 vColor;
          void main(){
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.06, d);
            if (a < 0.02) discard;
            gl_FragColor = vec4(vColor, a*0.85);
          }`,
      })
      points = new THREE.Points(geo, mat)
      points.position.y = 1.1 // nudge the portrait up so the EXPLORE button sits below it
      scene.add(points)
      fitCamera()

      // ---- interaction: hover-repel (small radius) + click detonate + reform ----
      const raycaster = new THREE.Raycaster()
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
      const ndc = new THREE.Vector2(), worldPt = new THREE.Vector3()
      const attractor = new THREE.Vector3(999, 999, 999)
      let hovering = false, blastT = 0, mx = 0, my = 0
      const updateAttractor = (e) => {
        const r = canvas.getBoundingClientRect()
        const cxp = (e.clientX - r.left) / r.width
        const cyp = (e.clientY - r.top) / r.height
        mx = cxp - 0.5; my = cyp - 0.5
        ndc.set(cxp * 2 - 1, -(cyp * 2 - 1))
        raycaster.setFromCamera(ndc, camera)
        if (raycaster.ray.intersectPlane(plane, worldPt)) attractor.copy(points.worldToLocal(worldPt.clone()))
      }
      const on = (el, ev, fn) => { el.addEventListener(ev, fn); listeners.push([el, ev, fn]) }
      on(canvas, 'pointermove', (e) => { hovering = true; updateAttractor(e) })
      on(canvas, 'pointerleave', () => { hovering = false; attractor.set(999, 999, 999) })
      on(canvas, 'pointerdown', (e) => {
        updateAttractor(e)
        blastT = 1.0
        const arr = geo.attributes.position.array
        for (let i = 0; i < N; i++) {
          const ix = i * 3
          let dx = arr[ix] - attractor.x, dy = arr[ix + 1] - attractor.y, dz = arr[ix + 2] - attractor.z
          const len = Math.hypot(dx, dy, dz) || 0.001
          const s = 9 + rnd[i] * 14
          vel[ix] = dx / len * s + (rnd[i] - 0.5) * 5
          vel[ix + 1] = dy / len * s + (Math.random() - 0.5) * 5
          vel[ix + 2] = dz / len * s * 0.6
        }
      })

      const clock = new THREE.Clock()
      let last = 0, intro = 0
      const arr = geo.attributes.position.array
      const R = 0.48, R2 = R * R // hover black-hole radius (half of the old 0.95)
      const tick = () => {
        const t = clock.getElapsedTime()
        const dt = Math.min(t - last, 0.05); last = t
        uniforms.uTime.value = t
        intro = Math.min(1, intro + dt * 0.55)

        if (blastT > 0) {
          blastT -= dt
          const drag = Math.pow(0.05, dt)
          for (let i = 0; i < N; i++) {
            const ix = i * 3
            arr[ix] += vel[ix] * dt; vel[ix] *= drag
            arr[ix + 1] += vel[ix + 1] * dt; vel[ix + 1] *= drag
            arr[ix + 2] += vel[ix + 2] * dt; vel[ix + 2] *= drag
            const pull = 0.012 + (1 - blastT) * 0.06
            arr[ix] += (target[ix] - arr[ix]) * pull
            arr[ix + 1] += (target[ix + 1] - arr[ix + 1]) * pull
            arr[ix + 2] += (target[ix + 2] - arr[ix + 2]) * pull
          }
        } else {
          const k = 0.02 + intro * 0.05
          for (let i = 0; i < N; i++) {
            const ix = i * 3
            arr[ix] += (target[ix] - arr[ix]) * k
            arr[ix + 1] += (target[ix + 1] - arr[ix + 1]) * k
            arr[ix + 2] += (target[ix + 2] - arr[ix + 2]) * k
            if (hovering && intro >= 1) {
              const dx = arr[ix] - attractor.x, dy = arr[ix + 1] - attractor.y
              const d2 = dx * dx + dy * dy
              if (d2 < R2) {
                const f = (1 - d2 / R2) * 0.55
                const inv = 1 / Math.sqrt(d2 + 0.0001)
                arr[ix] += dx * inv * f
                arr[ix + 1] += dy * inv * f
              }
            }
          }
        }
        geo.attributes.position.needsUpdate = true

        const wantY = Math.sin(t * 0.4) * 0.05 + mx * 0.22
        const wantX = Math.sin(t * 0.28) * 0.03 + my * 0.12
        points.rotation.y += (wantY - points.rotation.y) * 0.05
        points.rotation.x += (wantX - points.rotation.x) * 0.05

        renderer.render(scene, camera)
        raf = requestAnimationFrame(tick)
      }
      tick()

      ro = new ResizeObserver(() => fitCamera())
      ro.observe(wrap)
    }

    start()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      listeners.forEach(([el, ev, fn]) => el.removeEventListener(ev, fn))
      if (ro) ro.disconnect()
      if (points) { points.geometry.dispose(); points.material.dispose() }
      if (renderer) { renderer.dispose(); renderer.domElement.remove() }
    }
  }, [])

  return <div ref={wrapRef} className="prince-portrait" />
}
