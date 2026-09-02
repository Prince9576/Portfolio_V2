import * as THREE from 'three'

// Procedural canvas textures for the Project Theatre — drawn once, cached. Keeps
// us off any web-font fetch and gives full control over the neon glow so the
// scene's bloom pass lights it up.

// Neon "PROJECT THEATRE" laid flat on the floor. Transparent background +
// additive blending on the mesh, so only the glowing glyphs show over the dark
// floor. Two-line, wide aspect so it reads when foreshortened on the ground.
export function makeFloorTextTexture() {
  const w = 2048
  const h = 768
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  g.clearRect(0, 0, w, h)
  g.textAlign = 'center'
  g.textBaseline = 'middle'

  const draw = (text, y, size, grad) => {
    g.font = `800 ${size}px 'Space Grotesk', 'Orbitron', system-ui, sans-serif`
    // wide outer halo
    g.shadowColor = 'rgba(123,108,255,0.95)'
    g.shadowBlur = 70
    g.fillStyle = grad
    g.fillText(text, w / 2, y)
    g.fillText(text, w / 2, y)
    // tight bright core
    g.shadowColor = 'rgba(180,220,255,0.9)'
    g.shadowBlur = 18
    g.fillStyle = 'rgba(245,250,255,0.98)'
    g.fillText(text, w / 2, y)
  }

  const grad = g.createLinearGradient(w * 0.18, 0, w * 0.82, 0)
  grad.addColorStop(0, '#7b6cff')
  grad.addColorStop(0.5, '#5ad1ff')
  grad.addColorStop(1, '#ff7ad9')

  draw('PROJECT', h * 0.36, 300, grad)
  draw('THEATRE', h * 0.74, 300, grad)

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// A single rectangular placeholder "image" for a project frame: dark gradient
// keyed off the project accent, a faint grid, and centred labels.
export function makePlaceholderTexture(label, accent) {
  const w = 1024
  const h = 640
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')

  // base gradient
  const bg = g.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, '#15102e')
  bg.addColorStop(1, '#0a0818')
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
  g.fillStyle = hexA('#ffffff', 0.6)
  g.font = `600 30px 'Inter', system-ui, sans-serif`
  g.fillText('IMAGE  PLACEHOLDER', w / 2, h / 2 + 62)

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 8
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
