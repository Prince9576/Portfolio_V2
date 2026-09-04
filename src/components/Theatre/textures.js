import * as THREE from 'three'

// Procedural canvas textures for the Project Theatre — drawn once, cached

// Placeholder plate for an unfilled project frame. Small on purpose and shared
// by every empty slot — it says "COMING SOON" and nothing more, so resolution
// buys nothing. Each frame's own neon border already carries its accent colour.
// Every size below is a fraction of the canvas, so PLATE_W is the only dial.
const PLATE_W = 320
const PLATE_H = 200
export function makePlaceholderTexture(label, accent, sub = '') {
  const w = PLATE_W
  const h = PLATE_H
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
  const cell = w / 16
  for (let x = cell; x < w; x += cell) line(g, x, 0, x, h)
  for (let y = cell; y < h; y += cell) line(g, 0, y, w, y)

  // inner border
  g.strokeStyle = hexA(accent, 0.55)
  g.lineWidth = w / 256
  const inset = w * 0.027
  g.strokeRect(inset, inset, w - inset * 2, h - inset * 2)

  // labels
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = hexA(accent, 0.9)
  g.shadowBlur = w * 0.025
  g.fillStyle = '#f4f7ff'
  g.font = `800 ${w * 0.09}px 'Space Grotesk', system-ui, sans-serif`
  g.fillText(label, w / 2, h / 2 - h * 0.04)
  g.shadowBlur = 0
  if (sub) {
    g.fillStyle = hexA('#ffffff', 0.55)
    g.font = `600 ${w * 0.027}px 'Inter', system-ui, sans-serif`
    g.fillText(sub, w / 2, h / 2 + h * 0.097)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Generic radial gradient texture (canvas)
// A smooth radial ramp. 64px, not 512: linear filtering makes a gradient this
// gentle look identical either way, at 1/64th the memory.
export function makeRadialTexture(inner = '#ffffff', outer = '#000000', innerFrac = 0) {
  const s = 64
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
