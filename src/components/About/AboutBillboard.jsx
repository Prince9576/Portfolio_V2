import { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ABOUT } from '../../content/about.js'
import { duckAmbientMusic, unduckAmbientMusic } from '../../stores/ambientMusic.js'

// The intro that replaces the portrait (browser-friendly .mp4 / H.264).
const INTRO_VIDEO = '/videos/intro_rollout.mp4'

// Baked placement (tuned in-app). Faces +z toward the spawn point.
const W = 6.1
const H = 3.3
const DEPTH = 0.65
const BORDER = 0.18
const POS = { x: 11.1, y: 6.5, z: 34.7 }
const YAW = 0

// Screen (inset) dimensions + a canvas whose aspect matches them exactly, so
// text never stretches.
const SW = W - BORDER * 2
const SH = H - BORDER * 2
const CW = 1024
const CH = Math.round((CW * SH) / SW)

// The video's slot on the panel. We shape it to the clip's own aspect (the intro
// is a portrait video) so it fills the slot edge-to-edge instead of letterboxing.
// It's pinned to the left margin and vertically centred (so its world Y = 0).
const SLOT_LEFT = 46
const SLOT_MAX_W = 300
const SLOT_MARGIN_Y = 40
const VIDEO_INSET = 0.96 // shrink the video a touch so the neon border stays visible

function slotRect(aspect) {
  const boxH = CH - SLOT_MARGIN_Y * 2
  let w, h
  if (aspect >= SLOT_MAX_W / boxH) {
    w = SLOT_MAX_W
    h = SLOT_MAX_W / aspect
  } else {
    h = boxH
    w = boxH * aspect
  }
  return { x: SLOT_LEFT, y: (CH - h) / 2, w, h }
}

const ICONS = {
  resume:
    'M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.42l2.3 2.3V4a1 1 0 0 1 1-1zM5 19a1 1 0 0 1 1-1h12a1 1 0 0 1 0 2H6a1 1 0 0 1-1-1z',
  instagram:
    'M7.03.084c-1.277.06-2.149.264-2.911.563-.789.308-1.458.72-2.123 1.388C1.33 2.703.92 3.372.614 4.162.32 4.926.118 5.799.064 7.076.008 8.354-.005 8.764.001 12.023c.006 3.259.02 3.667.083 4.947.061 1.277.264 2.149.563 2.911.308.789.72 1.457 1.388 2.123.668.666 1.337 1.074 2.129 1.38.763.295 1.636.496 2.913.552 1.278.056 1.688.069 4.947.063 3.258-.006 3.668-.021 4.948-.082 1.28-.06 2.147-.265 2.91-.563.789-.309 1.458-.72 2.123-1.388.666-.668 1.075-1.338 1.38-2.129.295-.763.496-1.636.552-2.912.056-1.281.069-1.69.063-4.948-.006-3.258-.021-3.667-.082-4.947-.06-1.28-.264-2.149-.563-2.912-.308-.789-.72-1.457-1.388-2.123C21.298 1.33 20.628.922 19.838.616 19.074.32 18.202.118 16.924.064 15.647.008 15.236-.005 11.977.001 8.718.008 8.31.022 7.03.084m.14 21.693c-1.17-.051-1.805-.245-2.228-.408-.56-.216-.96-.477-1.382-.895-.422-.418-.681-.819-.9-1.378-.164-.423-.362-1.058-.417-2.228-.06-1.265-.072-1.644-.079-4.848-.007-3.204.005-3.583.061-4.848.05-1.169.245-1.805.408-2.228.216-.561.476-.96.895-1.382.419-.422.818-.681 1.378-.9.423-.165 1.058-.361 2.227-.417 1.265-.06 1.645-.072 4.848-.079 3.203-.007 3.583.005 4.85.061 1.168.051 1.805.245 2.227.408.56.216.96.475 1.382.895.421.419.682.818.9 1.379.165.422.362 1.056.417 2.226.06 1.265.073 1.645.079 4.848.006 3.203-.006 3.583-.061 4.848-.051 1.17-.245 1.805-.408 2.229-.216.56-.476.96-.895 1.381-.419.422-.818.681-1.378.9-.422.165-1.058.362-2.226.417-1.266.06-1.645.072-4.849.079-3.204.007-3.583-.006-4.848-.061M16.953 5.586a1.44 1.44 0 1 0 2.881-.001 1.44 1.44 0 0 0-2.881.001M5.839 12.012a6.173 6.173 0 1 0 12.346-.025 6.173 6.173 0 0 0-12.346.025M8 12.008A4 4 0 1 1 12.008 16 4 4 0 0 1 8 12.008',
  github:
    'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  linkedin:
    'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
}
const LINKS = [
  { key: 'resume', color: '#5ad1ff', href: ABOUT.resume, download: true },
  { key: 'instagram', color: '#ff5ad1', href: ABOUT.links.instagram },
  { key: 'github', color: '#ffffff', href: ABOUT.links.github },
  { key: 'linkedin', color: '#4aa3ff', href: ABOUT.links.linkedin },
]

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
function wrapLines(ctx, text, maxW) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const t = line ? line + ' ' + w : w
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line)
      line = w
    } else line = t
  }
  if (line) lines.push(line)
  return lines
}

// Vibrant synthwave screen. Returns icon hit-rects (canvas coords).
function drawPanel(ctx, aspect) {
  ctx.clearRect(0, 0, CW, CH)
  ctx.save()
  roundRect(ctx, 0, 0, CW, CH, 24)
  ctx.clip()

  const bg = ctx.createLinearGradient(0, 0, 0, CH)
  bg.addColorStop(0, '#250d57')
  bg.addColorStop(0.55, '#160a3a')
  bg.addColorStop(1, '#06031a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CW, CH)
  const g1 = ctx.createRadialGradient(CW * 0.15, CH * 0.92, 0, CW * 0.15, CH * 0.92, CH)
  g1.addColorStop(0, 'rgba(90,209,255,0.32)')
  g1.addColorStop(1, 'rgba(90,209,255,0)')
  ctx.fillStyle = g1
  ctx.fillRect(0, 0, CW, CH)
  const g2 = ctx.createRadialGradient(CW * 0.86, CH * 0.06, 0, CW * 0.86, CH * 0.06, CH)
  g2.addColorStop(0, 'rgba(255,90,209,0.28)')
  g2.addColorStop(1, 'rgba(255,90,209,0)')
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, CW, CH)
  ctx.strokeStyle = 'rgba(150,120,255,0.13)'
  ctx.lineWidth = 2
  for (let gy = CH * 0.55; gy < CH; gy += 22) {
    ctx.beginPath()
    ctx.moveTo(0, gy)
    ctx.lineTo(CW, gy)
    ctx.stroke()
  }
  ctx.restore()

  // video slot — shaped to the (portrait) intro clip, dark fill behind it as a
  // fallback, framed by the neon border. The actual footage is a WebGL plane.
  const slot = slotRect(aspect)
  ctx.save()
  roundRect(ctx, slot.x, slot.y, slot.w, slot.h, 18)
  ctx.clip()
  ctx.fillStyle = '#1b1140'
  ctx.fillRect(slot.x, slot.y, slot.w, slot.h)
  ctx.restore()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#5ad1ff'
  ctx.shadowColor = '#5ad1ff'
  ctx.shadowBlur = 20
  roundRect(ctx, slot.x, slot.y, slot.w, slot.h, 18)
  ctx.stroke()
  ctx.shadowBlur = 0

  // body
  const bx = slot.x + slot.w + 40
  const bw = CW - bx - 46
  ctx.textBaseline = 'top'

  ctx.font = '700 25px Orbitron, sans-serif'
  ctx.fillStyle = '#5ad1ff'
  ctx.shadowColor = '#5ad1ff'
  ctx.shadowBlur = 14
  ctx.fillText('◆  ' + ABOUT.name.toUpperCase(), bx, 46)
  ctx.shadowBlur = 0

  // title — auto-fit then wrap, big and bold
  let tf = 56
  const setT = () => (ctx.font = `900 ${tf}px Orbitron, sans-serif`)
  setT()
  let lines = wrapLines(ctx, ABOUT.title.toUpperCase(), bw)
  while (lines.length > 2 && tf > 30) {
    tf -= 2
    setT()
    lines = wrapLines(ctx, ABOUT.title.toUpperCase(), bw)
  }
  const tg = ctx.createLinearGradient(bx, 0, bx + bw, 0)
  tg.addColorStop(0, '#7af9ff')
  tg.addColorStop(0.5, '#b388ff')
  tg.addColorStop(1, '#ff7ad6')
  ctx.fillStyle = tg
  ctx.shadowColor = ABOUT.theme.primary
  ctx.shadowBlur = 26
  let ty = 92
  const lh = tf + 10
  for (const ln of lines) {
    ctx.fillText(ln, bx, ty)
    ty += lh
  }
  ctx.shadowBlur = 0

  const subF = 32
  ctx.font = `700 ${subF}px Orbitron, sans-serif`
  ctx.fillStyle = '#ff7ad6'
  ctx.shadowColor = '#ff5ad1'
  ctx.shadowBlur = 16
  ctx.fillText(ABOUT.subtitle.toUpperCase(), bx, ty + 2)
  ctx.shadowBlur = 0
  let cy = ty + subF + 18

  ctx.strokeStyle = ABOUT.theme.primary
  ctx.shadowColor = ABOUT.theme.primary
  ctx.shadowBlur = 14
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(bx, cy)
  ctx.lineTo(bx + bw, cy)
  ctx.stroke()
  ctx.shadowBlur = 0
  cy += 20

  ctx.fillStyle = 'rgba(225,230,255,0.9)'
  ctx.font = '400 27px "Space Grotesk", system-ui, sans-serif'
  for (const ln of wrapLines(ctx, ABOUT.description, bw)) {
    ctx.fillText(ln, bx, cy)
    cy += 36
  }

  const isz = 74
  const gap = 30
  const iy = CH - 112
  let ix = bx
  const hits = []
  for (const lk of LINKS) {
    roundRect(ctx, ix, iy, isz, isz, 15)
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    ctx.fill()
    ctx.lineWidth = 1.6
    ctx.strokeStyle = lk.color
    ctx.shadowColor = lk.color
    ctx.shadowBlur = 15
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.save()
    const inset = isz * 0.21
    const sc = (isz - inset * 2) / 24
    ctx.translate(ix + inset, iy + inset)
    ctx.scale(sc, sc)
    ctx.fillStyle = lk.color
    ctx.shadowColor = lk.color
    ctx.shadowBlur = 12
    ctx.fill(new Path2D(ICONS[lk.key]))
    ctx.restore()
    ctx.shadowBlur = 0
    hits.push({ ...lk, x: ix, y: iy, w: isz, h: isz })
    ix += isz + gap
  }
  return hits
}

function makeFrameMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float edge = min(min(vUv.x,1.0-vUv.x), min(vUv.y,1.0-vUv.y));
        float band = 1.0 - smoothstep(0.0, 0.09, edge);
        float flicker = 0.85 + 0.15*sin(uTime*16.0)*sin(uTime*2.7);
        float a = band * flicker;
        a = a==a?clamp(a,0.0,1.0):0.0;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), band*0.6), a);
      }
    `,
  })
}
function makeScanMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float sweep = fract(uTime*0.12);
        float line = smoothstep(0.04, 0.0, abs(vUv.y - sweep));
        float crt = 0.5 + 0.5*sin(vUv.y*900.0);
        float a = line*0.16 + crt*0.022;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  })
}

// Frosted-glass play/pause control — purely visual (pointer-events:none) so all
// clicks/hover pass through to the WebGL video plane below, which owns the
// interaction. Visibility is driven by React (shown while paused or hovered).
const VPLAYER_CSS = `
.ab-video-wrap{pointer-events:none}
.ab-glass{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;border:1px solid rgba(255,255,255,.5);background:rgba(255,255,255,.14);-webkit-backdrop-filter:blur(8px) saturate(140%);backdrop-filter:blur(8px) saturate(140%);box-shadow:0 6px 20px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.45);transition:opacity .3s ease;pointer-events:none}
.ab-glass svg{width:22px;height:22px;display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.55))}
`

export default function AboutBillboard() {
  const hitsRef = useRef([])
  const frameMat = useMemo(() => makeFrameMaterial(ABOUT.theme.primary), [])
  const scanMat = useMemo(() => makeScanMaterial(ABOUT.theme.accent), [])

  // Matte cartoon grey like the pole. envMapIntensity:0 stops the big flat faces
  // from mirroring the EXR sky (which produced the oil-slick rainbow).
  const boxMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#6c6f76', roughness: 0.85, metalness: 0, envMapIntensity: 0 }),
    [],
  )

  const { texture, canvas } = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = CW
    cv.height = CH
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return { texture: tex, canvas: cv }
  }, [])

  // Inline intro video that replaces the portrait. WebGL VideoTexture so it sits
  // under the neon frame + scanline shaders and shares the sign's tone mapping;
  // the play/pause control is real DOM (for genuine glassmorphism + hover/fade).
  const [playing, setPlaying] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [facing, setFacing] = useState(true) // camera on the billboard's front side
  const facingRef = useRef(true)
  const [videoAspect, setVideoAspect] = useState(9 / 16) // portrait until metadata lands
  const { video, videoTex } = useMemo(() => {
    const v = document.createElement('video')
    v.loop = false
    v.playsInline = true
    v.preload = 'auto'
    const t = new THREE.VideoTexture(v)
    t.colorSpace = THREE.SRGBColorSpace
    return { video: v, videoTex: t }
  }, [])

  useEffect(() => {
    // Assign the source here (not in useMemo): StrictMode mounts → cleans up →
    // mounts again, and a src cleared in cleanup would never be restored,
    // surfacing as "the element has no supported sources".
    if (video.getAttribute('src') !== INTRO_VIDEO) {
      video.src = INTRO_VIDEO
      video.load()
    }
    const onPlay = () => {
      setPlaying(true)
      duckAmbientMusic() // silence the wind / intro theme while the video has the floor
    }
    const onStop = () => {
      setPlaying(false)
      unduckAmbientMusic() // bring the ambience back on pause / end
    }
    const onMeta = () => {
      if (video.videoWidth) setVideoAspect(video.videoWidth / video.videoHeight)
    }
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onStop)
    video.addEventListener('ended', onStop)
    video.addEventListener('loadedmetadata', onMeta)
    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onStop)
      video.removeEventListener('ended', onStop)
      video.removeEventListener('loadedmetadata', onMeta)
      video.pause()
      unduckAmbientMusic()
    }
  }, [video, videoTex])

  const toggleVideo = (e) => {
    if (e) e.stopPropagation()
    if (video.paused) {
      if (video.ended) video.currentTime = 0
      video.play().catch((err) => console.warn('[AboutBillboard] intro video play failed:', err))
    } else {
      video.pause()
    }
  }

  useEffect(() => {
    const ctx = canvas.getContext('2d')
    const redraw = () => {
      // Pass the video aspect so the slot/border match the clip's shape; the
      // footage itself is the WebGL plane drawn below.
      hitsRef.current = drawPanel(ctx, videoAspect)
      texture.needsUpdate = true
    }
    redraw()
    if (document.fonts) {
      document.fonts.load('900 56px Orbitron').then(redraw).catch(() => {})
      document.fonts.ready.then(redraw).catch(() => {})
    }
  }, [canvas, texture, videoAspect])

  useFrame((s) => {
    frameMat.uniforms.uTime.value = s.clock.elapsedTime
    scanMat.uniforms.uTime.value = s.clock.elapsedTime
    // The billboard faces +z (YAW 0); the DOM control is screen-space and would
    // otherwise show through from behind. Hide it once the camera is on the back
    // side, with a 0.6m dead-zone so it doesn't flicker right at the plane.
    const z = s.camera.position.z
    const inFront = facingRef.current ? z > POS.z - 0.6 : z > POS.z + 0.6
    if (inFront !== facingRef.current) {
      facingRef.current = inFront
      setFacing(inFront)
    }
  })

  const hitFromUV = (uv) => {
    const cx = uv.x * CW
    const cy = (1 - uv.y) * CH
    return hitsRef.current.find((h) => cx >= h.x && cx <= h.x + h.w && cy >= h.y && cy <= h.y + h.h)
  }
  const onClick = (e) => {
    if (!e.uv) return
    const hit = hitFromUV(e.uv)
    if (!hit || !hit.href || hit.href === '#') return
    e.stopPropagation()
    if (hit.download) {
      const a = document.createElement('a')
      a.href = hit.href
      a.download = ''
      document.body.appendChild(a)
      a.click()
      a.remove()
    } else window.open(hit.href, '_blank', 'noopener')
  }
  const onMove = (e) => {
    if (e.uv) document.body.style.cursor = hitFromUV(e.uv) ? 'pointer' : 'auto'
  }
  const onOut = () => (document.body.style.cursor = 'auto')

  const front = DEPTH / 2
  const skip = () => null

  // Video plane fills the slot (which already matches the clip's aspect), inset
  // slightly so the neon border shows. Slot is vertically centred → world Y = 0.
  const slot = slotRect(videoAspect)
  const planeX = ((slot.x + slot.w / 2) / CW - 0.5) * SW
  const planeW = (slot.w / CW) * SW * VIDEO_INSET
  const planeH = (slot.h / CH) * SH * VIDEO_INSET

  return (
    <group position={[POS.x, POS.y, POS.z]} rotation-y={YAW}>
      <mesh raycast={skip} material={boxMat}>
        <boxGeometry args={[W, H, DEPTH]} />
      </mesh>
      <mesh raycast={skip} material={frameMat} position={[0, 0, front + 0.012]}>
        <planeGeometry args={[W, H]} />
      </mesh>
      <mesh position={[0, 0, front + 0.02]} onClick={onClick} onPointerMove={onMove} onPointerOut={onOut}>
        <planeGeometry args={[SW, SH]} />
        <meshBasicMaterial map={texture} toneMapped={false} transparent />
      </mesh>
      {/* Intro video in the old portrait slot. This plane owns all interaction
          (click to play/pause, hover to reveal the control) via the raycaster. */}
      <mesh
        position={[planeX, 0, front + 0.025]}
        onClick={toggleVideo}
        onPointerOver={() => {
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <planeGeometry args={[planeW, planeH]} />
        <meshBasicMaterial map={videoTex} toneMapped={false} />
      </mesh>
      <mesh raycast={skip} material={scanMat} position={[0, 0, front + 0.03]}>
        <planeGeometry args={[SW, SH]} />
      </mesh>

      {/* Frosted-glass play/pause indicator — visual only; the plane handles input.
          Shown while paused or hovered, fades out once playing. Only mounted when
          the camera is in front, so it never shows through the back of the sign. */}
      {facing && (
        <Html
          position={[planeX, 0, front + 0.06]}
          center
          wrapperClass="ab-video-wrap"
          style={{ pointerEvents: 'none' }}
          zIndexRange={[20, 0]}
        >
          <div
            className="ab-glass"
            style={{ opacity: !playing || hovered ? 1 : 0 }}
            aria-hidden="true"
          >
            {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
            <style>{VPLAYER_CSS}</style>
          </div>
        </Html>
      )}
    </group>
  )
}
