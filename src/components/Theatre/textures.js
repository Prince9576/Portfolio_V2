import * as THREE from 'three'

// Procedural canvas textures for the Project Theatre — drawn once, cached

// Neon "PROJECT THEATRE" laid flat on the floor, in Orbitron to match the about billboard
const FLOOR_TEXT_W = 2048
const FLOOR_TEXT_H = 768

export function drawFloorText(canvas) {
  const w = canvas.width
  const h = canvas.height
  const g = canvas.getContext('2d')
  g.clearRect(0, 0, w, h)
  g.textAlign = 'center'
  g.textBaseline = 'middle'

  const grad = g.createLinearGradient(w * 0.2, 0, w * 0.8, 0)
  grad.addColorStop(0, '#8f260b')
  grad.addColorStop(0.5, '#ff4d0a')
  grad.addColorStop(1, '#ffa03d')

  const draw = (text, y, size) => {
    g.font = `800 ${size}px 'Orbitron', system-ui, sans-serif`
    g.shadowColor = 'rgba(255,77,10,0.8)'
    g.shadowBlur = 20
    g.fillStyle = grad
    g.fillText(text, w / 2, y)
    g.shadowColor = 'rgba(255,201,174,0.75)'
    g.shadowBlur = 5
    g.fillStyle = 'rgba(245,250,255,0.97)'
    g.fillText(text, w / 2, y)
  }

  draw('PROJECT', h * 0.37, 250)
  draw('THEATRE', h * 0.74, 250)
}

export function makeFloorTextTexture() {
  const c = document.createElement('canvas')
  c.width = FLOOR_TEXT_W
  c.height = FLOOR_TEXT_H
  drawFloorText(c)
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Placeholder image for a project frame, keyed off its accent colour
export function makePlaceholderTexture(label, accent, sub = '') {
  const w = 1024
  const h = 640
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')

  // base gradient
  const bg = g.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, '#2f1912')
  bg.addColorStop(1, '#0a0806')
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)

  // accent corner wash
  const wash = g.createRadialGradient(w * 0.25, h * 0.2, 0, w * 0.25, h * 0.2, w * 0.7)
  wash.addColorStop(0, hexA(accent, 0.32))
  wash.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = wash
  g.fillRect(0, 0, w, h)

  // faint grid
  g.strokeStyle = hexA(accent, 0.12)
  g.lineWidth = 1
  for (let x = 64; x < w; x += 64) line(g, x, 0, x, h)
  for (let y = 64; y < h; y += 64) line(g, 0, y, w, y)

  // inner border
  g.strokeStyle = hexA(accent, 0.55)
  g.lineWidth = 4
  g.strokeRect(28, 28, w - 56, h - 56)

  // labels
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = hexA(accent, 0.9)
  g.shadowBlur = 26
  g.fillStyle = '#f4f7ff'
  g.font = `800 92px 'Space Grotesk', system-ui, sans-serif`
  g.fillText(label, w / 2, h / 2 - 26)
  g.shadowBlur = 0
  if (sub) {
    g.fillStyle = hexA('#ffffff', 0.55)
    g.font = `600 28px 'Inter', system-ui, sans-serif`
    g.fillText(sub, w / 2, h / 2 + 62)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Generic radial gradient texture (canvas)
export function makeRadialTexture(inner = '#ffffff', outer = '#000000', innerFrac = 0) {
  const s = 512
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(s / 2, s / 2, (s / 2) * innerFrac, s / 2, s / 2, s / 2)
  grad.addColorStop(0, inner)
  grad.addColorStop(1, outer)
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function line(g, x0, y0, x1, y1) {
  g.beginPath()
  g.moveTo(x0, y0)
  g.lineTo(x1, y1)
  g.stroke()
}

// #rrggbb + alpha -> rgba()
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
