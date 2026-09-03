import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { QUALITY } from '../../utils/quality.js'
import { getPlayerBody } from '../../stores/playerRef.js'
import { isInside } from '../../stores/theatreStore.js'
import { stormLevel } from '../../stores/weatherStore.js'

// GPU rain: one draw call, every streak animated in the vertex shader
const COUNT = QUALITY.rainCount
const RADIUS = 26
const HEIGHT = 30
const STREAK = 0.55

// Built once at module load (random seeds are impure for React render)
function buildRain() {
  const seeds = new Float32Array(COUNT * 2 * 3)
  const ends = new Float32Array(COUNT * 2)
  for (let i = 0; i < COUNT; i++) {
    const x = (Math.random() * 2 - 1) * RADIUS
    const z = (Math.random() * 2 - 1) * RADIUS
    const phase = Math.random()
    for (let v = 0; v < 2; v++) {
      const j = (i * 2 + v) * 3
      seeds[j] = x
      seeds[j + 1] = phase
      seeds[j + 2] = z
      ends[i * 2 + v] = v
    }
  }

  const geometry = new THREE.BufferGeometry()
  // positions are computed in-shader; the attribute only sets vertex count
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 2 * 3), 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3))
  geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1))

  const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uOpacity: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aSeed;
        attribute float aEnd;
        uniform float uTime;
        uniform vec3 uCenter;
        varying float vAlpha;

        const vec3 DIR = normalize(vec3(0.16, -1.0, 0.10)); // wind slant

        void main() {
          float speed = 24.0 * (0.8 + 0.4 * fract(aSeed.x * 7.31));
          float fall = mod(aSeed.y * ${HEIGHT.toFixed(1)} + uTime * speed, ${HEIGHT.toFixed(1)});
          vec3 p = vec3(aSeed.x, ${(HEIGHT * 0.7).toFixed(1)}, aSeed.z)
                 + DIR * (fall + aEnd * ${STREAK.toFixed(2)});
          vAlpha = (0.35 + 0.65 * fract(aSeed.z * 9.73))
                 * smoothstep(${HEIGHT.toFixed(1)}, ${(HEIGHT - 4).toFixed(1)}, fall);
          gl_Position = projectionMatrix * viewMatrix * vec4(p + uCenter, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(0.62, 0.71, 0.86, vAlpha * uOpacity);
        }
      `,
  })
  return { geometry, material }
}

const { geometry, material } = buildRain()

export default function Rain() {
  const lineRef = useRef()

  useFrame((state) => {
    const k = stormLevel.value
    const line = lineRef.current
    if (!line) return
    line.visible = k > 0.01 && !isInside()
    if (!line.visible) return

    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uOpacity.value = 0.55 * k
    const body = getPlayerBody()
    if (body) {
      const p = body.translation()
      material.uniforms.uCenter.value.set(p.x, p.y, p.z)
    }
  })

  return <lineSegments ref={lineRef} geometry={geometry} material={material} frustumCulled={false} />
}
